import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { deleteFile as deleteFileFromDisk, saveFile } from '../../lib/file-storage.js'
import { prisma } from '../../lib/prisma.js'
import { transformDates } from '../../lib/transform-dates.js'
import { errorSchema, successSchema } from '../../schemas/common.js'

// ============================================================================
// SCHEMAS
// ============================================================================

const fileSchema = z.strictObject({
  id: z.string().meta({ example: 'clx1234567890' }),
  ownerId: z.number().int().meta({ example: 1 }),
  storyId: z.string().nullable().meta({ example: 'clx1234567890' }),
  localPath: z.string().nullable().meta({ example: '/uploads/1/2025/12/image-123.jpg' }),
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

const getFileResponseSchema = z.strictObject({
  file: fileSchema,
})

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
        description: 'Upload a file (image for cover art, character pictures, etc.)',
        tags: ['files'],
        // Note: multipart requests don't use body schema
        // File validation happens in the handler
        response: {
          201: uploadFileResponseSchema,
          400: errorSchema,
          401: errorSchema,
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

        // Optional storyId from fields
        const storyId = data.fields.storyId?.value as string | undefined

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

        // Save file to disk and get metadata
        const fileMetadata = await saveFile(data, userId)

        // Check if file with same SHA256 already exists for this user
        const existingFile = await prisma.file.findFirst({
          where: {
            ownerId: userId,
            sha256: fileMetadata.sha256,
          },
        })

        if (existingFile) {
          // File already exists (deduplication)
          // Delete the newly uploaded file and return existing
          await deleteFileFromDisk(fileMetadata.localPath)
          return reply.code(201).send({
            success: true as const,
            file: transformDates(existingFile),
          })
        }

        // Create file record in database
        const file = await prisma.file.create({
          data: {
            ownerId: userId,
            storyId: storyId || null,
            localPath: fileMetadata.localPath,
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

  // List user's files
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

      // Build where clause
      const where = {
        ownerId: userId,
        ...(storyId && { storyId }),
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

  // Get single file
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
      })

      if (!file) {
        return reply.code(404).send({ error: 'File not found' })
      }

      // User can only access their own files
      if (file.ownerId !== userId) {
        return reply.code(404).send({ error: 'File not found' })
      }

      return { file: transformDates(file) }
    },
  )

  // Delete file
  fastify.delete(
    '/files/:id',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Delete a file (removes from database and filesystem)',
        tags: ['files'],
        params: z.strictObject({
          id: z.string().meta({
            description: 'File ID',
            example: 'clx1234567890',
          }),
        }),
        response: {
          200: successSchema,
          401: errorSchema,
          404: errorSchema,
          409: errorSchema, // File in use
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params
      const userId = request.user!.id

      // Get file
      const file = await prisma.file.findUnique({
        where: { id },
        include: {
          storyCoverArt: { select: { id: true } },
          bookCoverArt: { select: { id: true } },
          bookSpineArt: { select: { id: true } },
          characterPicture: { select: { id: true } },
        },
      })

      if (!file) {
        return reply.code(404).send({ error: 'File not found' })
      }

      // User can only delete their own files
      if (file.ownerId !== userId) {
        return reply.code(404).send({ error: 'File not found' })
      }

      // Check if file is in use
      const inUse =
        file.storyCoverArt.length > 0 ||
        file.bookCoverArt.length > 0 ||
        file.bookSpineArt.length > 0 ||
        file.characterPicture.length > 0

      if (inUse) {
        return reply.code(409).send({
          error: 'File is in use and cannot be deleted. Remove it from stories/books/characters first.',
        })
      }

      // Delete file from database
      await prisma.file.delete({ where: { id } })

      // Delete file from filesystem
      if (file.localPath) {
        await deleteFileFromDisk(file.localPath)
      }

      return { success: true as const }
    },
  )
}

export default fileRoutes
