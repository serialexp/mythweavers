import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { prisma } from '../../lib/prisma.js'
import { errorSchema, successSchema } from '../../schemas/common.js'
import {
  formatPublicStory,
  publicStorySchema,
  savedTypeSchema,
  storyVisibleWhere,
} from '../../schemas/story.js'

/**
 * Bookshelf endpoints — the user's saved stories, grouped under three
 * "kinds" (FAVORITE, FOLLOW, READ_LATER). One Story can be on the shelf
 * under multiple kinds; each (user, story, kind) tuple maps to a single
 * `BookShelfStory` row (enforced by `@@unique` in the schema).
 */

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/**
 * A story on the user's shelf — a `publicStorySchema` plus the set of kinds
 * the user has saved it under. We collapse multiple rows for the same
 * storyId into a single response item so the UI doesn't have to dedupe.
 */
const bookshelfStorySchema = publicStorySchema.extend({
  kinds: z.array(savedTypeSchema).meta({
    description: 'Save categories the current user has set for this story',
    example: ['FAVORITE', 'FOLLOW'],
  }),
})

const listBookshelfQuerySchema = z.strictObject({
  kind: savedTypeSchema.optional().meta({
    description: 'Filter to stories saved under this kind only.',
  }),
})

const listBookshelfResponseSchema = z.strictObject({
  stories: z.array(bookshelfStorySchema),
})

const storyIdParamSchema = z.strictObject({
  storyId: z.string().meta({
    description: 'Story ID',
    example: 'clx1234567890',
  }),
})

const storyIdAndKindParamSchema = z.strictObject({
  storyId: z.string().meta({
    description: 'Story ID',
    example: 'clx1234567890',
  }),
  kind: savedTypeSchema,
})

const bookshelfStatusResponseSchema = z.strictObject({
  FAVORITE: z.boolean(),
  FOLLOW: z.boolean(),
  READ_LATER: z.boolean(),
})

const addBookshelfBodySchema = z.strictObject({
  storyId: z.string().meta({
    description: 'Story to add to the shelf',
    example: 'clx1234567890',
  }),
  kind: savedTypeSchema,
})

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const bookshelfRoutes: FastifyPluginAsyncZod = async (fastify) => {
  /**
   * List the current user's bookshelf, optionally filtered by kind.
   *
   * Stories that have since become unpublished (or were soft-deleted) are
   * excluded — the row in `BookShelfStory` is left intact, since the cascade
   * on Story deletion already cleans up real removals.
   */
  fastify.get(
    '/bookshelf',
    {
      preHandler: requireAuth,
      schema: {
        description: "List the current user's saved stories.",
        tags: ['bookshelf'],
        querystring: listBookshelfQuerySchema,
        response: {
          200: listBookshelfResponseSchema,
          401: errorSchema,
        },
      },
    },
    async (request) => {
      const userId = request.user!.id
      const { kind } = request.query

      const now = new Date()
      const rows = await prisma.bookShelfStory.findMany({
        where: {
          ownerId: userId,
          ...(kind ? { kind } : {}),
          story: storyVisibleWhere(now),
        },
        include: {
          story: {
            include: { owner: true, coverArtFile: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
      })

      // Collapse multiple rows for the same story into one entry.
      const byStoryId = new Map<string, { story: (typeof rows)[number]['story']; kinds: typeof rows[number]['kind'][] }>()
      for (const row of rows) {
        const existing = byStoryId.get(row.storyId)
        if (existing) {
          if (!existing.kinds.includes(row.kind)) existing.kinds.push(row.kind)
        } else {
          byStoryId.set(row.storyId, { story: row.story, kinds: [row.kind] })
        }
      }

      const stories = Array.from(byStoryId.values()).map(({ story, kinds }) => ({
        ...formatPublicStory(story),
        kinds,
      }))

      return { stories }
    },
  )

  /**
   * Per-story status snapshot. Returns booleans for each kind so the UI can
   * render the modal toggles without having to filter the whole shelf.
   */
  fastify.get(
    '/bookshelf/:storyId',
    {
      preHandler: requireAuth,
      schema: {
        description: "Get the current user's saved-state for a single story.",
        tags: ['bookshelf'],
        params: storyIdParamSchema,
        response: {
          200: bookshelfStatusResponseSchema,
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.id
      const { storyId } = request.params

      const story = await prisma.story.findUnique({ where: { id: storyId }, select: { id: true } })
      if (!story) {
        return reply.status(404).send({ error: 'Story not found' })
      }

      const rows = await prisma.bookShelfStory.findMany({
        where: { ownerId: userId, storyId },
        select: { kind: true },
      })
      const kinds = new Set(rows.map((r) => r.kind))
      return {
        FAVORITE: kinds.has('FAVORITE'),
        FOLLOW: kinds.has('FOLLOW'),
        READ_LATER: kinds.has('READ_LATER'),
      }
    },
  )

  /**
   * Add a story to the shelf under a given kind. Idempotent: if the row
   * already exists we return success without erroring — relies on the
   * `@@unique([ownerId, storyId, kind])` constraint to surface duplicates
   * as Prisma P2002.
   */
  fastify.post(
    '/bookshelf',
    {
      preHandler: requireAuth,
      schema: {
        description: "Add a story to the current user's bookshelf under a kind. Idempotent.",
        tags: ['bookshelf'],
        body: addBookshelfBodySchema,
        response: {
          200: successSchema,
          201: successSchema,
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.id
      const { storyId, kind } = request.body

      // Only allow saving stories the user could actually see.
      const now = new Date()
      const story = await prisma.story.findFirst({
        where: { id: storyId, ...storyVisibleWhere(now) },
        select: { id: true },
      })
      if (!story) {
        return reply.status(404).send({ error: 'Story not found' })
      }

      try {
        await prisma.bookShelfStory.create({
          data: { ownerId: userId, storyId, kind },
        })
        return reply.status(201).send({ success: true as const })
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          // Already on the shelf under this kind — treat as success.
          return reply.status(200).send({ success: true as const })
        }
        throw err
      }
    },
  )

  /**
   * Remove a story from the shelf under a single kind. Idempotent — missing
   * rows still return 200 so callers don't have to special-case "already
   * gone".
   */
  fastify.delete(
    '/bookshelf/:storyId/:kind',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Remove one (storyId, kind) entry from the current user\'s bookshelf. Idempotent.',
        tags: ['bookshelf'],
        params: storyIdAndKindParamSchema,
        response: {
          200: successSchema,
          401: errorSchema,
        },
      },
    },
    async (request) => {
      const userId = request.user!.id
      const { storyId, kind } = request.params

      await prisma.bookShelfStory.deleteMany({
        where: { ownerId: userId, storyId, kind },
      })
      return { success: true as const }
    },
  )
}

export default bookshelfRoutes
