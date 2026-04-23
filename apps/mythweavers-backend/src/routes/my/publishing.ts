import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { prisma } from '../../lib/prisma.js'
import { errorSchema } from '../../schemas/common.js'

/**
 * Publishing endpoints for the story-editor (writer).
 *
 * Visibility rule on the reader side: a chapter is visible iff its own
 * `publishedAt` AND its parent story's `publishedAt` are both non-null and
 * <= now. A null `publishedAt` means draft/unpublished. A future value means
 * scheduled.
 *
 * During the transition period (until the legacy columns are dropped in a
 * follow-up migration) we dual-write:
 *   - Story.published   = (publishedAt != null && publishedAt <= now)
 *   - Chapter.publishedOn = publishedAt (same value)
 * so any existing readers of the legacy fields keep seeing coherent state.
 *
 * Any chapter-level publish mutation also recomputes
 * Story.firstChapterReleasedAt / lastChapterReleasedAt as the min/max of
 * non-null publishedAt across the story's non-deleted chapters. These fields
 * existed on the schema but were never maintained; Phase 2 starts keeping
 * them in sync (see CURRENT_TASK.md / TODO.md).
 */

// ---------- Schemas ----------

const storyIdParamSchema = z.strictObject({
  storyId: z.string().meta({
    description: 'Story ID',
    example: 'clx1234567890',
  }),
})

const chapterIdParamSchema = z.strictObject({
  chapterId: z.string().meta({
    description: 'Chapter ID',
    example: 'clx1234567890',
  }),
})

const publishingBodySchema = z.strictObject({
  publishedAt: z
    .string()
    .datetime()
    .nullable()
    .meta({
      description:
        'ISO-8601 timestamp at which this entity becomes publicly visible. ' +
        'null = unpublished/draft. A future value = scheduled. A past value = live.',
      example: '2026-05-01T00:00:00.000Z',
    }),
})

const storyPublishingResponseSchema = z.strictObject({
  success: z.literal(true),
  storyId: z.string(),
  publishedAt: z.string().nullable().meta({
    description: 'The new publishedAt value (ISO-8601) or null if unpublished.',
    example: '2026-05-01T00:00:00.000Z',
  }),
})

const chapterPublishingResponseSchema = z.strictObject({
  success: z.literal(true),
  chapterId: z.string(),
  storyId: z.string(),
  publishedAt: z.string().nullable().meta({
    description: 'The new publishedAt value (ISO-8601) or null if unpublished.',
    example: '2026-05-01T00:00:00.000Z',
  }),
  firstChapterReleasedAt: z.string().nullable().meta({
    description:
      'Recomputed earliest publishedAt across the parent story\'s non-deleted chapters.',
    example: '2026-04-01T00:00:00.000Z',
  }),
  lastChapterReleasedAt: z.string().nullable().meta({
    description:
      'Recomputed latest publishedAt across the parent story\'s non-deleted chapters.',
    example: '2026-06-01T00:00:00.000Z',
  }),
})

// ---------- Helpers ----------

/**
 * Recompute Story.firstChapterReleasedAt / lastChapterReleasedAt from the
 * min/max of non-null publishedAt across the story's non-deleted chapters.
 * Returns the new values (both may be null if the story has no published
 * chapters yet).
 */
async function recomputeStoryReleaseDates(storyId: string) {
  const agg = await prisma.chapter.aggregate({
    where: {
      arc: { book: { storyId } },
      deleted: false,
      publishedAt: { not: null },
    },
    _min: { publishedAt: true },
    _max: { publishedAt: true },
  })
  const firstChapterReleasedAt = agg._min.publishedAt ?? null
  const lastChapterReleasedAt = agg._max.publishedAt ?? null
  await prisma.story.update({
    where: { id: storyId },
    data: { firstChapterReleasedAt, lastChapterReleasedAt },
  })
  return { firstChapterReleasedAt, lastChapterReleasedAt }
}

/**
 * Apply a publishedAt change to a Story, dual-writing the legacy `published`
 * boolean so existing readers stay consistent.
 */
async function setStoryPublishedAt(storyId: string, publishedAt: Date | null) {
  const now = new Date()
  const legacyPublished =
    publishedAt !== null && publishedAt.getTime() <= now.getTime()
  return prisma.story.update({
    where: { id: storyId },
    data: {
      publishedAt,
      published: legacyPublished,
    },
    select: { id: true, publishedAt: true },
  })
}

/**
 * Apply a publishedAt change to a Chapter, dual-writing the legacy
 * `publishedOn` column. Returns the parent storyId so the caller can also
 * recompute release dates.
 */
async function setChapterPublishedAt(
  chapterId: string,
  publishedAt: Date | null,
) {
  const updated = await prisma.chapter.update({
    where: { id: chapterId },
    data: {
      publishedAt,
      publishedOn: publishedAt, // legacy dual-write
    },
    select: {
      id: true,
      publishedAt: true,
      arc: { select: { book: { select: { storyId: true } } } },
    },
  })
  return {
    chapterId: updated.id,
    publishedAt: updated.publishedAt,
    storyId: updated.arc.book.storyId,
  }
}

/**
 * Ownership check for a story. Returns the story if the user owns it, null
 * otherwise.
 */
async function findOwnedStory(storyId: string, userId: number) {
  return prisma.story.findFirst({
    where: { id: storyId, ownerId: userId },
    select: { id: true },
  })
}

/**
 * Ownership check for a chapter via its parent story. Also filters out
 * soft-deleted chapters — you can't publish what isn't there.
 */
async function findOwnedChapter(chapterId: string, userId: number) {
  return prisma.chapter.findFirst({
    where: {
      id: chapterId,
      deleted: false,
      arc: { book: { story: { ownerId: userId } } },
    },
    select: { id: true },
  })
}

// ---------- Routes ----------

const myPublishingRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook('preHandler', requireAuth)

  // --- Story ---

  fastify.patch(
    '/stories/:storyId/publishing',
    {
      schema: {
        description:
          'Set the publishedAt timestamp for a story. null = unpublish. ' +
          'A future value schedules; a past value makes it immediately live.',
        tags: ['my-publishing'],
        security: [{ sessionAuth: [] }],
        params: storyIdParamSchema,
        body: publishingBodySchema,
        response: {
          200: storyPublishingResponseSchema,
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id
        const { storyId } = request.params
        const { publishedAt } = request.body

        const owned = await findOwnedStory(storyId, userId)
        if (!owned) return reply.status(404).send({ error: 'Story not found' })

        const date = publishedAt === null ? null : new Date(publishedAt)
        const updated = await setStoryPublishedAt(storyId, date)

        fastify.log.info(
          { storyId, userId, publishedAt: updated.publishedAt },
          'Story publishedAt updated',
        )

        return {
          success: true as const,
          storyId: updated.id,
          publishedAt: updated.publishedAt?.toISOString() ?? null,
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to update story publishing')
        return reply.status(500).send({ error: 'Failed to update story publishing' })
      }
    },
  )

  fastify.post(
    '/stories/:storyId/publish-now',
    {
      schema: {
        description: 'Publish a story immediately (sets publishedAt = now).',
        tags: ['my-publishing'],
        security: [{ sessionAuth: [] }],
        params: storyIdParamSchema,
        response: {
          200: storyPublishingResponseSchema,
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id
        const { storyId } = request.params

        const owned = await findOwnedStory(storyId, userId)
        if (!owned) return reply.status(404).send({ error: 'Story not found' })

        const updated = await setStoryPublishedAt(storyId, new Date())

        fastify.log.info({ storyId, userId }, 'Story published (now)')

        return {
          success: true as const,
          storyId: updated.id,
          publishedAt: updated.publishedAt?.toISOString() ?? null,
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to publish story')
        return reply.status(500).send({ error: 'Failed to publish story' })
      }
    },
  )

  fastify.post(
    '/stories/:storyId/unpublish',
    {
      schema: {
        description:
          'Unpublish a story (sets publishedAt = null). All chapters become ' +
          'invisible on the reader regardless of their own publishedAt.',
        tags: ['my-publishing'],
        security: [{ sessionAuth: [] }],
        params: storyIdParamSchema,
        response: {
          200: storyPublishingResponseSchema,
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id
        const { storyId } = request.params

        const owned = await findOwnedStory(storyId, userId)
        if (!owned) return reply.status(404).send({ error: 'Story not found' })

        const updated = await setStoryPublishedAt(storyId, null)

        fastify.log.info({ storyId, userId }, 'Story unpublished')

        return {
          success: true as const,
          storyId: updated.id,
          publishedAt: null,
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to unpublish story')
        return reply.status(500).send({ error: 'Failed to unpublish story' })
      }
    },
  )

  // --- Chapter ---

  fastify.patch(
    '/chapters/:chapterId/publishing',
    {
      schema: {
        description:
          'Set the publishedAt timestamp for a chapter. null = unpublish. ' +
          'A future value schedules; a past value makes it immediately live ' +
          '(subject to the parent story also being published).',
        tags: ['my-publishing'],
        security: [{ sessionAuth: [] }],
        params: chapterIdParamSchema,
        body: publishingBodySchema,
        response: {
          200: chapterPublishingResponseSchema,
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id
        const { chapterId } = request.params
        const { publishedAt } = request.body

        const owned = await findOwnedChapter(chapterId, userId)
        if (!owned) return reply.status(404).send({ error: 'Chapter not found' })

        const date = publishedAt === null ? null : new Date(publishedAt)
        const updated = await setChapterPublishedAt(chapterId, date)
        const release = await recomputeStoryReleaseDates(updated.storyId)

        fastify.log.info(
          {
            chapterId,
            storyId: updated.storyId,
            userId,
            publishedAt: updated.publishedAt,
          },
          'Chapter publishedAt updated',
        )

        return {
          success: true as const,
          chapterId: updated.chapterId,
          storyId: updated.storyId,
          publishedAt: updated.publishedAt?.toISOString() ?? null,
          firstChapterReleasedAt:
            release.firstChapterReleasedAt?.toISOString() ?? null,
          lastChapterReleasedAt:
            release.lastChapterReleasedAt?.toISOString() ?? null,
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to update chapter publishing')
        return reply
          .status(500)
          .send({ error: 'Failed to update chapter publishing' })
      }
    },
  )

  fastify.post(
    '/chapters/:chapterId/publish-now',
    {
      schema: {
        description: 'Publish a chapter immediately (sets publishedAt = now).',
        tags: ['my-publishing'],
        security: [{ sessionAuth: [] }],
        params: chapterIdParamSchema,
        response: {
          200: chapterPublishingResponseSchema,
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id
        const { chapterId } = request.params

        const owned = await findOwnedChapter(chapterId, userId)
        if (!owned) return reply.status(404).send({ error: 'Chapter not found' })

        const updated = await setChapterPublishedAt(chapterId, new Date())
        const release = await recomputeStoryReleaseDates(updated.storyId)

        fastify.log.info(
          { chapterId, storyId: updated.storyId, userId },
          'Chapter published (now)',
        )

        return {
          success: true as const,
          chapterId: updated.chapterId,
          storyId: updated.storyId,
          publishedAt: updated.publishedAt?.toISOString() ?? null,
          firstChapterReleasedAt:
            release.firstChapterReleasedAt?.toISOString() ?? null,
          lastChapterReleasedAt:
            release.lastChapterReleasedAt?.toISOString() ?? null,
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to publish chapter')
        return reply.status(500).send({ error: 'Failed to publish chapter' })
      }
    },
  )

  fastify.post(
    '/chapters/:chapterId/unpublish',
    {
      schema: {
        description: 'Unpublish a chapter (sets publishedAt = null).',
        tags: ['my-publishing'],
        security: [{ sessionAuth: [] }],
        params: chapterIdParamSchema,
        response: {
          200: chapterPublishingResponseSchema,
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id
        const { chapterId } = request.params

        const owned = await findOwnedChapter(chapterId, userId)
        if (!owned) return reply.status(404).send({ error: 'Chapter not found' })

        const updated = await setChapterPublishedAt(chapterId, null)
        const release = await recomputeStoryReleaseDates(updated.storyId)

        fastify.log.info(
          { chapterId, storyId: updated.storyId, userId },
          'Chapter unpublished',
        )

        return {
          success: true as const,
          chapterId: updated.chapterId,
          storyId: updated.storyId,
          publishedAt: null,
          firstChapterReleasedAt:
            release.firstChapterReleasedAt?.toISOString() ?? null,
          lastChapterReleasedAt:
            release.lastChapterReleasedAt?.toISOString() ?? null,
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to unpublish chapter')
        return reply.status(500).send({ error: 'Failed to unpublish chapter' })
      }
    },
  )
}

export default myPublishingRoutes
