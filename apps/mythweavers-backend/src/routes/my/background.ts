import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { promoteFileToPublic } from '../../lib/file-storage.js'
import { prisma } from '../../lib/prisma.js'
import { errorSchema } from '../../schemas/common.js'

/**
 * Default background image management for nodes in the story hierarchy.
 *
 * Five sibling endpoints — one per level (Story / Book / Arc / Chapter / Scene)
 * — each set or clear the node's `defaultBackgroundFileId`. The reader resolves
 * the active background by walking the hierarchy at scene boundaries:
 *
 *   active default for a scene = scene → chapter → arc → book → story,
 *                                first non-null wins (else null = no background).
 *
 * A boundary only "fires" (emits a background change to the reader) if the
 * node *itself* has an explicit `defaultBackgroundFileId` set. Inheritance
 * does not fire — it's only the fallback used when computing what default
 * to pick at a firing point. This means inline `type: 'background'` message
 * overrides persist past scene/chapter/arc boundaries that don't explicitly
 * set their own default, and only get reset by a node that does.
 */

// ---------- Schemas ----------

const storyIdParamSchema = z.strictObject({
  storyId: z.string().meta({ description: 'Story ID', example: 'clx1234567890' }),
})
const bookIdParamSchema = z.strictObject({
  bookId: z.string().meta({ description: 'Book ID', example: 'clx1234567890' }),
})
const arcIdParamSchema = z.strictObject({
  arcId: z.string().meta({ description: 'Arc ID', example: 'clx1234567890' }),
})
const chapterIdParamSchema = z.strictObject({
  chapterId: z.string().meta({ description: 'Chapter ID', example: 'clx1234567890' }),
})
const sceneIdParamSchema = z.strictObject({
  sceneId: z.string().meta({ description: 'Scene ID', example: 'clx1234567890' }),
})

const backgroundBodySchema = z.strictObject({
  backgroundFileId: z
    .string()
    .nullable()
    .meta({
      description:
        'File ID to use as the default background for this node, or null to clear. ' +
        'The file must belong to the same story as the target node.',
      example: 'clx1234567890',
    }),
})

const backgroundFileSchema = z
  .strictObject({
    id: z.string().meta({ example: 'clx1234567890' }),
    path: z.string().meta({ example: '/files/1/2025/12/forest.jpg' }),
  })
  .nullable()

const backgroundResponseSchema = z.strictObject({
  success: z.literal(true),
  entityType: z.enum(['story', 'book', 'arc', 'chapter', 'scene']),
  entityId: z.string(),
  storyId: z.string(),
  defaultBackgroundFileId: z.string().nullable(),
  defaultBackgroundFile: backgroundFileSchema,
})

// ---------- Helpers ----------

type EntityType = 'story' | 'book' | 'arc' | 'chapter' | 'scene'

/**
 * Resolve the storyId for a given node id of a given type, *and* verify the
 * caller owns the parent story. Returns the storyId on success, null on
 * "not found / not owned" — collapsed to a single 404 by callers so we don't
 * leak existence to non-owners.
 */
async function resolveOwnedStoryId(
  entityType: EntityType,
  entityId: string,
  userId: number,
): Promise<string | null> {
  switch (entityType) {
    case 'story': {
      const row = await prisma.story.findFirst({
        where: { id: entityId, ownerId: userId },
        select: { id: true },
      })
      return row?.id ?? null
    }
    case 'book': {
      const row = await prisma.book.findFirst({
        where: { id: entityId, deleted: false, story: { ownerId: userId } },
        select: { storyId: true },
      })
      return row?.storyId ?? null
    }
    case 'arc': {
      const row = await prisma.arc.findFirst({
        where: { id: entityId, deleted: false, book: { story: { ownerId: userId } } },
        select: { book: { select: { storyId: true } } },
      })
      return row?.book.storyId ?? null
    }
    case 'chapter': {
      const row = await prisma.chapter.findFirst({
        where: { id: entityId, deleted: false, arc: { book: { story: { ownerId: userId } } } },
        select: { arc: { select: { book: { select: { storyId: true } } } } },
      })
      return row?.arc.book.storyId ?? null
    }
    case 'scene': {
      const row = await prisma.scene.findFirst({
        where: {
          id: entityId,
          deleted: false,
          chapter: { arc: { book: { story: { ownerId: userId } } } },
        },
        select: { chapter: { select: { arc: { select: { book: { select: { storyId: true } } } } } } },
      })
      return row?.chapter.arc.book.storyId ?? null
    }
  }
}

/**
 * Verify a File is owned by the calling user. Returns true if it is (or if
 * fileId is null — that's a clear, no file required). False means we should
 * 400 because the caller is trying to reference someone else's file (or one
 * that doesn't exist).
 *
 * `File.storyId` is intentionally NOT enforced here: users routinely reuse
 * the same image across stories, and the SHA256 dedup branch on upload
 * pins storyId to whichever story the file was first uploaded under, which
 * would otherwise lock a file out of every other story owned by the same
 * user. Ownership is the real security boundary; storyId is a hint.
 */
async function fileOwnedByUser(
  fileId: string | null,
  userId: number,
): Promise<boolean> {
  if (fileId === null) return true
  const file = await prisma.file.findFirst({
    where: { id: fileId, ownerId: userId },
    select: { id: true },
  })
  return file !== null
}

/**
 * Apply the `defaultBackgroundFileId` change to the right table and return
 * the updated row hydrated with the file record (so the client can update
 * its local state without a follow-up fetch).
 */
async function applyBackgroundUpdate(
  entityType: EntityType,
  entityId: string,
  fileId: string | null,
): Promise<{
  defaultBackgroundFileId: string | null
  defaultBackgroundFile: { id: string; path: string } | null
}> {
  const include = {
    defaultBackgroundFile: { select: { id: true, path: true } },
  } as const
  switch (entityType) {
    case 'story': {
      const updated = await prisma.story.update({
        where: { id: entityId },
        data: { defaultBackgroundFileId: fileId },
        include,
      })
      return {
        defaultBackgroundFileId: updated.defaultBackgroundFileId,
        defaultBackgroundFile: updated.defaultBackgroundFile,
      }
    }
    case 'book': {
      const updated = await prisma.book.update({
        where: { id: entityId },
        data: { defaultBackgroundFileId: fileId },
        include,
      })
      return {
        defaultBackgroundFileId: updated.defaultBackgroundFileId,
        defaultBackgroundFile: updated.defaultBackgroundFile,
      }
    }
    case 'arc': {
      const updated = await prisma.arc.update({
        where: { id: entityId },
        data: { defaultBackgroundFileId: fileId },
        include,
      })
      return {
        defaultBackgroundFileId: updated.defaultBackgroundFileId,
        defaultBackgroundFile: updated.defaultBackgroundFile,
      }
    }
    case 'chapter': {
      const updated = await prisma.chapter.update({
        where: { id: entityId },
        data: { defaultBackgroundFileId: fileId },
        include,
      })
      return {
        defaultBackgroundFileId: updated.defaultBackgroundFileId,
        defaultBackgroundFile: updated.defaultBackgroundFile,
      }
    }
    case 'scene': {
      const updated = await prisma.scene.update({
        where: { id: entityId },
        data: { defaultBackgroundFileId: fileId },
        include,
      })
      return {
        defaultBackgroundFileId: updated.defaultBackgroundFileId,
        defaultBackgroundFile: updated.defaultBackgroundFile,
      }
    }
  }
}

/**
 * Build a single PATCH handler for the given entity type. Factored out
 * because all five endpoints share identical control flow — only the
 * route, param schema, and the entity-type discriminator change.
 */
function makeHandler(
  entityType: EntityType,
  pickEntityId: (params: any) => string,
  fastify: any,
) {
  return async (request: any, reply: any) => {
    try {
      const userId = request.user!.id
      const entityId = pickEntityId(request.params)
      const { backgroundFileId } = request.body as { backgroundFileId: string | null }

      const storyId = await resolveOwnedStoryId(entityType, entityId, userId)
      if (!storyId) {
        return reply.status(404).send({ error: `${entityType} not found` })
      }

      // Cross-user file references are rejected so the file picker can't be
      // tricked into pointing the reader at someone else's image. Cross-story
      // within the same account is allowed — users reuse images, and the
      // upload dedup branch pins File.storyId to whichever story uploaded it
      // first, which would otherwise lock the file out of every other story.
      const ok = await fileOwnedByUser(backgroundFileId, userId)
      if (!ok) {
        return reply
          .status(400)
          .send({ error: 'Background file not found or not owned by user' })
      }

      // Setting a file as a default background means the user has explicitly
      // chosen for it to be visible in the public reader frontend, so promote
      // it from the private bucket / private flag to public BEFORE we update
      // the entity — `applyBackgroundUpdate` includes `defaultBackgroundFile`
      // in its return, and we want that to surface the post-promotion path.
      // No-op when clearing the background or when the file is already public.
      if (backgroundFileId !== null) {
        await promoteFileToPublic(backgroundFileId)
      }

      const result = await applyBackgroundUpdate(entityType, entityId, backgroundFileId)

      fastify.log.info(
        { entityType, entityId, storyId, userId, backgroundFileId },
        'Default background updated',
      )

      return {
        success: true as const,
        entityType,
        entityId,
        storyId,
        defaultBackgroundFileId: result.defaultBackgroundFileId,
        defaultBackgroundFile: result.defaultBackgroundFile,
      }
    } catch (error) {
      fastify.log.error({ error, entityType }, 'Failed to update default background')
      return reply
        .status(500)
        .send({ error: 'Failed to update default background' })
    }
  }
}

// ---------- Routes ----------

const myBackgroundRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook('preHandler', requireAuth)

  fastify.patch(
    '/stories/:storyId/background',
    {
      schema: {
        description:
          'Set or clear the default background image for a story. ' +
          'Inherited downward by all books/arcs/chapters/scenes that do not set their own.',
        tags: ['my-background'],
        security: [{ sessionAuth: [] }],
        params: storyIdParamSchema,
        body: backgroundBodySchema,
        response: {
          200: backgroundResponseSchema,
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    makeHandler('story', (p) => p.storyId, fastify),
  )

  fastify.patch(
    '/books/:bookId/background',
    {
      schema: {
        description: 'Set or clear the default background image for a book.',
        tags: ['my-background'],
        security: [{ sessionAuth: [] }],
        params: bookIdParamSchema,
        body: backgroundBodySchema,
        response: {
          200: backgroundResponseSchema,
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    makeHandler('book', (p) => p.bookId, fastify),
  )

  fastify.patch(
    '/arcs/:arcId/background',
    {
      schema: {
        description: 'Set or clear the default background image for an arc.',
        tags: ['my-background'],
        security: [{ sessionAuth: [] }],
        params: arcIdParamSchema,
        body: backgroundBodySchema,
        response: {
          200: backgroundResponseSchema,
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    makeHandler('arc', (p) => p.arcId, fastify),
  )

  fastify.patch(
    '/chapters/:chapterId/background',
    {
      schema: {
        description: 'Set or clear the default background image for a chapter.',
        tags: ['my-background'],
        security: [{ sessionAuth: [] }],
        params: chapterIdParamSchema,
        body: backgroundBodySchema,
        response: {
          200: backgroundResponseSchema,
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    makeHandler('chapter', (p) => p.chapterId, fastify),
  )

  fastify.patch(
    '/scenes/:sceneId/background',
    {
      schema: {
        description: 'Set or clear the default background image for a scene.',
        tags: ['my-background'],
        security: [{ sessionAuth: [] }],
        params: sceneIdParamSchema,
        body: backgroundBodySchema,
        response: {
          200: backgroundResponseSchema,
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    makeHandler('scene', (p) => p.sceneId, fastify),
  )
}

export default myBackgroundRoutes
