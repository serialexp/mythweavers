import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { prisma } from '../../lib/prisma.js'
import { errorSchema, successSchema } from '../../schemas/common.js'
import { formatPublicStory, publicStorySchema, storyVisibleWhere } from '../../schemas/story.js'

/**
 * Reading-history endpoints. The reader records the last chapter the user
 * actually opened so we can offer a "Continue reading" surface and resume
 * the right chapter when the user reopens a story.
 *
 * State strategy:
 *   - One row per (user, story) — upsert on the unique constraint.
 *   - `lastChapterId` is the chapter the user *opened*, not necessarily the
 *     one they finished. Cheap and good enough for a "where was I" feature.
 *   - `lastChapterReadAt` is set to `now()` on each upsert so the Continue
 *     Reading list can sort by recency without scanning chapter rows.
 *   - Story deletion cascades; chapter deletion sets `lastChapterId` to null
 *     (the user keeps their position-of-record).
 */

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const recordReadStatusBodySchema = z.strictObject({
  storyId: z.string().meta({
    description: 'Story whose reading position is being updated.',
    example: 'clx1234567890',
  }),
  chapterId: z.string().meta({
    description: 'Chapter the user just opened (must belong to the story).',
    example: 'clx1234567891',
  }),
})

const readingStatusEntrySchema = z.strictObject({
  story: publicStorySchema,
  lastChapterId: z.string().nullable().meta({
    description: 'ID of the most recently opened chapter, or null if no chapters are visible.',
    example: 'clx1234567891',
  }),
  lastChapterReadAt: z.string().nullable().meta({
    description: 'Timestamp of the last recorded read (ISO-8601).',
    example: '2026-04-28T12:00:00.000Z',
  }),
})

const listReadingStatusResponseSchema = z.strictObject({
  entries: z.array(readingStatusEntrySchema),
})

const storyIdParamSchema = z.strictObject({
  storyId: z.string().meta({
    description: 'Story ID',
    example: 'clx1234567890',
  }),
})

const readingStatusForStorySchema = z.strictObject({
  lastChapterId: z.string().nullable().meta({
    description: 'ID of the most recently opened chapter, or null if no read recorded.',
    example: 'clx1234567891',
  }),
  lastChapterReadAt: z.string().nullable().meta({
    description: 'Timestamp of the last recorded read (ISO-8601).',
    example: '2026-04-28T12:00:00.000Z',
  }),
})

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const readingStatusRoutes: FastifyPluginAsyncZod = async (fastify) => {
  /**
   * Record (or update) the reader's position in a story. Idempotent — calling
   * it again with the same chapter just bumps `lastChapterReadAt`.
   *
   * Validates that the chapter actually belongs to the story to avoid storing
   * orphaned positions (and to give callers a clear 400 instead of a silent
   * mis-record).
   */
  fastify.post(
    '/reading-status',
    {
      preHandler: requireAuth,
      schema: {
        description: "Record the user's last-read chapter for a story.",
        tags: ['reading-status'],
        body: recordReadStatusBodySchema,
        response: {
          200: successSchema,
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.id
      const { storyId, chapterId } = request.body
      const now = new Date()

      // Story must be publicly visible — we don't track reads against drafts.
      const story = await prisma.story.findFirst({
        where: { id: storyId, ...storyVisibleWhere(now) },
        select: { id: true },
      })
      if (!story) {
        return reply.status(404).send({ error: 'Story not found' })
      }

      // Chapter must belong to the story (regardless of visibility — e.g. a
      // chapter could have been opened just before unpublishing; preserve the
      // record). If the chapter has been hard-deleted, the FK SetNull
      // semantics will eventually null out `lastChapterId` anyway.
      const chapter = await prisma.chapter.findFirst({
        where: {
          id: chapterId,
          arc: { book: { storyId } },
        },
        select: { id: true },
      })
      if (!chapter) {
        return reply.status(400).send({ error: 'Chapter does not belong to story' })
      }

      await prisma.storyReadStatus.upsert({
        where: { userId_storyId: { userId, storyId } },
        update: { lastChapterId: chapterId, lastChapterReadAt: now },
        create: { userId, storyId, lastChapterId: chapterId, lastChapterReadAt: now },
      })

      return { success: true as const }
    },
  )

  /**
   * The "Continue reading" feed — every story the user has opened, ordered
   * most-recent first. We filter out stories that have since become
   * unpublished or deleted (hidden, but row preserved in case the story
   * comes back).
   */
  fastify.get(
    '/reading-status',
    {
      preHandler: requireAuth,
      schema: {
        description: "List the user's reading history (most-recent first).",
        tags: ['reading-status'],
        response: {
          200: listReadingStatusResponseSchema,
          401: errorSchema,
        },
      },
    },
    async (request) => {
      const userId = request.user!.id
      const now = new Date()

      const rows = await prisma.storyReadStatus.findMany({
        where: {
          userId,
          story: storyVisibleWhere(now),
        },
        include: {
          story: {
            include: { owner: { select: { id: true, username: true } }, coverArtFile: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
      })

      return {
        entries: rows.map((r) => ({
          story: formatPublicStory(r.story),
          lastChapterId: r.lastChapterId,
          lastChapterReadAt: r.lastChapterReadAt ? r.lastChapterReadAt.toISOString() : null,
        })),
      }
    },
  )

  /**
   * Resume helper — given a storyId, what chapter should we drop the user
   * back into? Returns nulls if no read has been recorded yet (caller should
   * fall back to the first chapter).
   */
  fastify.get(
    '/reading-status/:storyId',
    {
      preHandler: requireAuth,
      schema: {
        description: "Get the user's last-read position for a single story.",
        tags: ['reading-status'],
        params: storyIdParamSchema,
        response: {
          200: readingStatusForStorySchema,
          401: errorSchema,
        },
      },
    },
    async (request) => {
      const userId = request.user!.id
      const { storyId } = request.params

      const row = await prisma.storyReadStatus.findUnique({
        where: { userId_storyId: { userId, storyId } },
        select: { lastChapterId: true, lastChapterReadAt: true },
      })
      if (!row) {
        return { lastChapterId: null, lastChapterReadAt: null }
      }
      return {
        lastChapterId: row.lastChapterId,
        lastChapterReadAt: row.lastChapterReadAt ? row.lastChapterReadAt.toISOString() : null,
      }
    },
  )
}

export default readingStatusRoutes
