import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { attachUser, requireAuth } from '../../lib/auth.js'
import { deleteFile, getFileStream, saveFile } from '../../lib/file-storage.js'
import { prisma } from '../../lib/prisma.js'
import type { StorageVisibility } from '../../lib/r2-storage.js'
import { transformDates } from '../../lib/transform-dates.js'
import { errorSchema } from '../../schemas/common.js'

// ============================================================================
// SCHEMAS
// ============================================================================

const fileSchema = z.strictObject({
  id: z.string().meta({ example: 'clx1234567890' }),
  ownerId: z.number().int().meta({ example: 1 }),
  storyId: z.string().nullable().meta({ example: 'clx1234567890' }),
  localPath: z.string().nullable().meta({ example: '/uploads/1/2025/12/image-123.jpg' }),
  r2Key: z.string().nullable().meta({ example: '1/2025/12/image-123.jpg' }),
  visibility: z.string().meta({ example: 'private' }),
  path: z.string().meta({ example: '/files/1/2025/12/image-123.jpg' }),
  sha256: z.string().meta({ example: 'abc123...' }),
  width: z.number().int().nullable().meta({ example: 1920 }),
  height: z.number().int().nullable().meta({ example: 1080 }),
  bytes: z.number().int().nullable().meta({ example: 524288 }),
  mimeType: z.string().meta({ example: 'image/jpeg' }),
  createdAt: z.string().datetime().meta({ example: '2025-12-06T12:00:00.000Z' }),
  updatedAt: z.string().datetime().meta({ example: '2025-12-06T12:00:00.000Z' }),
})

const uploadFileResponseSchema = z.strictObject({
  success: z.literal(true),
  file: fileSchema,
})

const listFilesResponseSchema = z.strictObject({
  files: z.array(fileSchema),
  pagination: z.strictObject({
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  }),
})

// Per-relation reference counts. Names mirror the Prisma relation names on
// the File model so the mapping stays obvious. All FKs are `onDelete: SetNull`
// so deleting the file safely nulls every reference rather than cascading.
const fileUsageSchema = z
  .strictObject({
    storyCoverArt: z.number().int().meta({ description: 'Stories using this file as cover art' }),
    bookCoverArt: z.number().int().meta({ description: 'Books using this file as cover art' }),
    bookSpineArt: z.number().int().meta({ description: 'Books using this file as spine art' }),
    characterPicture: z.number().int().meta({ description: 'Characters using this file as their picture' }),
    messageBackground: z.number().int().meta({ description: 'Inline background-message references' }),
    messageAudio: z.number().int().meta({ description: 'Inline audio-message references' }),
    storyDefaultBackground: z.number().int().meta({ description: 'Stories using this as their default background' }),
    bookDefaultBackground: z.number().int().meta({ description: 'Books using this as their default background' }),
    arcDefaultBackground: z.number().int().meta({ description: 'Arcs using this as their default background' }),
    chapterDefaultBackground: z.number().int().meta({ description: 'Chapters using this as their default background' }),
    sceneDefaultBackground: z.number().int().meta({ description: 'Scenes using this as their default background' }),
    mapImage: z.number().int().meta({ description: 'Maps using this file as their background image' }),
    total: z.number().int().meta({ description: 'Sum across all reference types' }),
  })
  .meta({
    description:
      'Counts of every place this file is currently referenced. Deleting the file nulls all of these via SetNull cascades.',
  })

const getFileResponseSchema = z.strictObject({
  file: fileSchema,
  usage: fileUsageSchema,
})

const deleteFileResponseSchema = z.strictObject({
  success: z.literal(true),
  unlinked: fileUsageSchema,
})

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Prisma `_count` selector used by both the GET-by-id and DELETE endpoints.
 * Listed once so the names cannot drift between fetch sites.
 */
const fileUsageCountSelect = {
  storyCoverArt: true,
  bookCoverArt: true,
  bookSpineArt: true,
  characterPicture: true,
  messageBackgrounds: true,
  messageAudio: true,
  storyDefaultBackgrounds: true,
  bookDefaultBackgrounds: true,
  arcDefaultBackgrounds: true,
  chapterDefaultBackgrounds: true,
  sceneDefaultBackgrounds: true,
  mapImages: true,
} as const

type PrismaFileCount = {
  storyCoverArt: number
  bookCoverArt: number
  bookSpineArt: number
  characterPicture: number
  messageBackgrounds: number
  messageAudio: number
  storyDefaultBackgrounds: number
  bookDefaultBackgrounds: number
  arcDefaultBackgrounds: number
  chapterDefaultBackgrounds: number
  sceneDefaultBackgrounds: number
  mapImages: number
}

/**
 * Map Prisma's plural relation names to the (slightly cleaner) singular names
 * exposed in the public API, and compute the running total. Keeping the
 * conversion in one place means the schema and the handlers always agree.
 */
function buildFileUsage(c: PrismaFileCount) {
  const usage = {
    storyCoverArt: c.storyCoverArt,
    bookCoverArt: c.bookCoverArt,
    bookSpineArt: c.bookSpineArt,
    characterPicture: c.characterPicture,
    messageBackground: c.messageBackgrounds,
    messageAudio: c.messageAudio,
    storyDefaultBackground: c.storyDefaultBackgrounds,
    bookDefaultBackground: c.bookDefaultBackgrounds,
    arcDefaultBackground: c.arcDefaultBackgrounds,
    chapterDefaultBackground: c.chapterDefaultBackgrounds,
    sceneDefaultBackground: c.sceneDefaultBackgrounds,
    mapImage: c.mapImages,
  }
  const total = Object.values(usage).reduce((sum, v) => sum + v, 0)
  return { ...usage, total }
}

/**
 * Collect every File.id referenced anywhere inside `storyId`'s content tree
 * for the given user. Used to expand the "this story" file filter beyond the
 * (unreliable) `File.storyId` hint — see the list endpoint for context.
 *
 * Each query joins back to the owning Story (directly or via the parent
 * chain) and gates on `ownerId: userId`, so this cannot be used by user A
 * to peek at user B's files even if they pass user B's storyId.
 */
async function collectFileIdsReferencedByStory(userId: number, storyId: string): Promise<string[]> {
  const ids = new Set<string>()
  const add = (v: string | null | undefined) => {
    if (v) ids.add(v)
  }

  const [story, books, arcs, chapters, scenes, characters, messages] = await Promise.all([
    prisma.story.findFirst({
      where: { id: storyId, ownerId: userId },
      select: { coverArtFileId: true, defaultBackgroundFileId: true },
    }),
    prisma.book.findMany({
      where: { storyId, story: { ownerId: userId } },
      select: { coverArtFileId: true, spineArtFileId: true, defaultBackgroundFileId: true },
    }),
    prisma.arc.findMany({
      where: { book: { storyId, story: { ownerId: userId } } },
      select: { defaultBackgroundFileId: true },
    }),
    prisma.chapter.findMany({
      where: { arc: { book: { storyId, story: { ownerId: userId } } } },
      select: { defaultBackgroundFileId: true },
    }),
    prisma.scene.findMany({
      where: { chapter: { arc: { book: { storyId, story: { ownerId: userId } } } } },
      select: { defaultBackgroundFileId: true },
    }),
    prisma.character.findMany({
      where: { storyId, story: { ownerId: userId } },
      select: { pictureFileId: true },
    }),
    prisma.message.findMany({
      where: {
        scene: { chapter: { arc: { book: { storyId, story: { ownerId: userId } } } } },
      },
      select: { backgroundFileId: true, audioFileId: true },
    }),
  ])

  if (story) {
    add(story.coverArtFileId)
    add(story.defaultBackgroundFileId)
  }
  for (const b of books) {
    add(b.coverArtFileId)
    add(b.spineArtFileId)
    add(b.defaultBackgroundFileId)
  }
  for (const a of arcs) add(a.defaultBackgroundFileId)
  for (const c of chapters) add(c.defaultBackgroundFileId)
  for (const s of scenes) add(s.defaultBackgroundFileId)
  for (const c of characters) add(c.pictureFileId)
  for (const m of messages) {
    add(m.backgroundFileId)
    add(m.audioFileId)
  }

  return Array.from(ids)
}

// ============================================================================
// ROUTES
// ============================================================================

const fileRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // Upload file
  fastify.post(
    '/files',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Upload a file (image for cover art, character pictures, maps, etc.)',
        tags: ['files'],
        // Note: multipart requests don't use body schema
        // File validation happens in the handler
        response: {
          201: uploadFileResponseSchema,
          400: errorSchema,
          401: errorSchema,
          404: errorSchema, // Story not found
          413: errorSchema, // Payload too large
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.id

      try {
        // Get the uploaded file
        const data = await request.file()

        if (!data) {
          return reply.code(400).send({ error: 'No file provided' })
        }

        // Optional storyId and visibility from fields
        const storyId = (data.fields.storyId as { value?: string } | undefined)?.value
        const visibilityField = (data.fields.visibility as { value?: string } | undefined)?.value
        const visibility: StorageVisibility = visibilityField === 'public' ? 'public' : 'private'

        // If storyId provided, verify user owns the story
        if (storyId) {
          const story = await prisma.story.findUnique({
            where: { id: storyId },
            select: { ownerId: true },
          })

          if (!story || story.ownerId !== userId) {
            return reply.code(404).send({ error: 'Story not found' })
          }
        }

        // Save file to storage (R2 or local)
        const fileMetadata = await saveFile(data, userId, visibility)

        // Check if file with same SHA256 already exists for this user
        const existingFile = await prisma.file.findFirst({
          where: {
            ownerId: userId,
            sha256: fileMetadata.sha256,
          },
        })

        if (existingFile) {
          // File already exists (deduplication)
          // Delete the newly uploaded file and return existing.
          await deleteFile(fileMetadata.localPath, fileMetadata.r2Key, visibility)

          // If this upload had a storyId and the existing row is unpinned
          // (storyId is null), pin it to this story. `File.storyId` is a
          // soft hint about the file's primary "home" story used by the
          // file picker's "this story" filter; we only ever upgrade null →
          // value, never overwrite an existing storyId.
          let toReturn = existingFile
          if (storyId && existingFile.storyId === null) {
            toReturn = await prisma.file.update({
              where: { id: existingFile.id },
              data: { storyId },
            })
          }

          return reply.code(201).send({
            success: true as const,
            file: transformDates(toReturn),
          })
        }

        // Create file record in database
        const file = await prisma.file.create({
          data: {
            ownerId: userId,
            storyId: storyId || null,
            localPath: fileMetadata.localPath,
            r2Key: fileMetadata.r2Key,
            visibility: fileMetadata.visibility,
            path: fileMetadata.path,
            sha256: fileMetadata.sha256,
            width: fileMetadata.width,
            height: fileMetadata.height,
            bytes: fileMetadata.bytes,
            mimeType: fileMetadata.mimeType,
          },
        })

        return reply.code(201).send({
          success: true as const,
          file: transformDates(file),
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Upload failed'

        // Determine appropriate status code
        if (errorMessage.includes('too large')) {
          return reply.code(413).send({ error: errorMessage })
        }

        return reply.code(400).send({ error: errorMessage })
      }
    },
  )

  // Serve files (proxies from R2 or local storage). Public files are
  // readable without authentication; private files still require the
  // requesting user to own them. We use `attachUser` (not `requireAuth`)
  // so anonymous readers reach the visibility check rather than bouncing
  // off a 401 — this is what makes chapter backgrounds (locally stored,
  // promoted to public on first use) load in the public reader frontend.
  fastify.get(
    '/files/*',
    {
      preHandler: attachUser,
      schema: {
        description:
          'Get file content. Public files are accessible anonymously; ' +
          'private files require an authenticated owner.',
        tags: ['files'],
        produces: ['image/*', 'application/octet-stream'],
        response: {
          // 200 returns binary file data (no JSON schema)
          200: z.any().meta({ description: 'Binary file content' }),
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      // Get the path from the wildcard
      const filePath = `/my/files/${(request.params as { '*': string })['*']}`

      // Find the file
      const file = await prisma.file.findFirst({
        where: { path: filePath },
      })

      if (!file) {
        return reply.code(404).send({ error: 'File not found' })
      }

      // Access control: public files are readable by anyone. Private files
      // require an authenticated request from the file's owner. We collapse
      // "no session" and "wrong owner" into a single 404 so we don't leak
      // existence to non-owners.
      if (file.visibility === 'private') {
        const userId = request.user?.id
        if (!userId || file.ownerId !== userId) {
          return reply.code(404).send({ error: 'File not found' })
        }
      }

      try {
        // Get file stream from storage. The DB row is the single source of
        // truth — whatever environment uploaded the file is responsible for
        // owning the bytes. We do NOT fall back to other storage backends.
        const { stream, contentType, contentLength } = await getFileStream(
          file.localPath,
          file.r2Key,
          file.visibility as StorageVisibility,
        )

        // Set response headers
        reply.header('Content-Type', contentType || file.mimeType)
        if (contentLength) {
          reply.header('Content-Length', contentLength)
        }
        reply.header('Cache-Control', 'public, max-age=31536000') // 1 year cache

        return reply.send(stream)
      } catch (error) {
        console.error('Error serving file:', error)
        return reply.code(404).send({ error: 'File not found' })
      }
    },
  )

  // List user's files (metadata only)
  fastify.get(
    '/files',
    {
      preHandler: requireAuth,
      schema: {
        description: "List user's files with pagination and optional story filter",
        tags: ['files'],
        querystring: z.strictObject({
          page: z.coerce.number().int().positive().default(1).meta({
            description: 'Page number',
            example: 1,
          }),
          limit: z.coerce.number().int().positive().max(100).default(20).meta({
            description: 'Items per page (max 100)',
            example: 20,
          }),
          storyId: z.string().optional().meta({
            description: 'Filter by story ID',
            example: 'clx1234567890',
          }),
        }),
        response: {
          200: listFilesResponseSchema,
          401: errorSchema,
        },
      },
    },
    async (request, _reply) => {
      const userId = request.user!.id
      const { page, limit, storyId } = request.query

      const skip = (page - 1) * limit

      // Build where clause. When `storyId` is supplied, the filter is "files
      // belonging to this story OR referenced anywhere inside this story's
      // content tree". `File.storyId` alone is unreliable as a scope filter
      // because (a) the SHA256 dedup branch pins storyId to the *first*
      // upload, so a file reused in story B still reports storyId=A, and
      // (b) older files predate the column being populated. So we also
      // collect every fileId actually referenced by Story / Book / Arc /
      // Chapter / Scene defaults, character pictures, and message
      // background/audio embeds under this story. Ownership of the story
      // is enforced by the joined `where` on each query, so this can't be
      // used to discover another user's files.
      const referencedFileIds: string[] = storyId ? await collectFileIdsReferencedByStory(userId, storyId) : []

      const where = {
        ownerId: userId,
        ...(storyId && {
          OR: [{ storyId }, ...(referencedFileIds.length > 0 ? [{ id: { in: referencedFileIds } }] : [])],
        }),
      }

      // Get files and total count
      const [files, total] = await Promise.all([
        prisma.file.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.file.count({ where }),
      ])

      const totalPages = Math.ceil(total / limit)

      return {
        files: files.map(transformDates),
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      }
    },
  )

  // Get single file metadata
  fastify.get(
    '/files/:id',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Get file metadata by ID',
        tags: ['files'],
        params: z.strictObject({
          id: z.string().meta({
            description: 'File ID',
            example: 'clx1234567890',
          }),
        }),
        response: {
          200: getFileResponseSchema,
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params
      const userId = request.user!.id

      const file = await prisma.file.findUnique({
        where: { id },
        include: { _count: { select: fileUsageCountSelect } },
      })

      if (!file) {
        return reply.code(404).send({ error: 'File not found' })
      }

      // User can only access their own files
      if (file.ownerId !== userId) {
        return reply.code(404).send({ error: 'File not found' })
      }

      const { _count, ...rest } = file
      return {
        file: transformDates(rest),
        usage: buildFileUsage(_count),
      }
    },
  )

  // Delete file
  //
  // Deletion is unconditional: every File FK in the schema is `onDelete:
  // SetNull`, so deleting the row safely nulls each `coverArtFileId` /
  // `defaultBackgroundFileId` / `pictureFileId` / `backgroundFileId` /
  // `audioFileId` reference rather than orphaning anything. We return a
  // breakdown of what got nulled so the UI can confirm to the user.
  //
  // The caller is expected to have already shown the user the usage counts
  // (via GET /files/:id) and obtained explicit confirmation before issuing
  // this DELETE.
  fastify.delete(
    '/files/:id',
    {
      preHandler: requireAuth,
      schema: {
        description:
          'Delete a file. Removes the row, deletes the underlying storage object, and nulls all references via SetNull cascades. Returns a per-relation breakdown of references that were nulled so the UI can summarise the impact.',
        tags: ['files'],
        params: z.strictObject({
          id: z.string().meta({
            description: 'File ID',
            example: 'clx1234567890',
          }),
        }),
        response: {
          200: deleteFileResponseSchema,
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params
      const userId = request.user!.id

      // Pull the file together with its reference counts so we can both
      // gate on ownership and report what we're about to unlink.
      const file = await prisma.file.findUnique({
        where: { id },
        include: { _count: { select: fileUsageCountSelect } },
      })

      if (!file) {
        return reply.code(404).send({ error: 'File not found' })
      }

      // User can only delete their own files
      if (file.ownerId !== userId) {
        return reply.code(404).send({ error: 'File not found' })
      }

      const unlinked = buildFileUsage(file._count)

      // Delete file from database (SetNull cascades to all referencing rows)
      await prisma.file.delete({ where: { id } })

      // Delete underlying storage object. Done after the DB delete so a
      // storage failure doesn't leave dangling references — at worst we
      // leak bytes, which `cleanup-unreachable-files.ts` can be re-run to
      // notice (the row is already gone so nothing reaches them anyway).
      await deleteFile(file.localPath, file.r2Key, file.visibility as StorageVisibility)

      return { success: true as const, unlinked }
    },
  )
}

export default fileRoutes
