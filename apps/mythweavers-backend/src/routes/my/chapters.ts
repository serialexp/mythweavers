import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { prisma } from '../../lib/prisma.js'
import { errorSchema } from '../../schemas/common.js'

// Node type schema
const nodeTypeSchema = z.enum(['story', 'non-story', 'context']).meta({
  description: 'Node type (story content, non-story, or context)',
  example: 'story',
})

// Chapter response schema
const chapterSchema = z.strictObject({
  id: z.string().meta({
    description: 'Chapter ID',
    example: 'clx1234567890',
  }),
  name: z.string().meta({
    description: 'Chapter name/title',
    example: 'Chapter 1: The Awakening',
  }),
  summary: z.string().nullable().meta({
    description: 'Chapter summary/description',
    example: 'The hero awakens to a new world...',
  }),
  arcId: z.string().meta({
    description: 'Parent arc ID',
    example: 'clx9876543210',
  }),
  publishedOn: z.string().nullable().meta({
    description: 'Publication date',
    example: '2025-12-05T12:00:00.000Z',
  }),
  sortOrder: z.number().meta({
    description: 'Sort order within arc',
    example: 0,
  }),
  royalRoadId: z.number().nullable().meta({
    description: 'Royal Road chapter ID',
    example: 123456,
  }),
  nodeType: nodeTypeSchema,
  status: z.string().nullable().meta({
    description: 'Chapter status: draft, needs_work, review, done',
    example: 'draft',
  }),
  deleted: z.boolean().meta({
    description: 'Whether the chapter is soft-deleted',
    example: false,
  }),
  deletedAt: z.string().nullable().meta({
    description: 'When the chapter was deleted',
    example: null,
  }),
  createdAt: z.string().meta({
    description: 'Creation timestamp',
    example: '2025-12-05T12:00:00.000Z',
  }),
  updatedAt: z.string().meta({
    description: 'Last update timestamp',
    example: '2025-12-05T12:00:00.000Z',
  }),
})

// Create chapter request body
const createChapterBodySchema = z.strictObject({
  id: z.string().optional().meta({
    description: 'Optional client-provided ID (must be unique)',
    example: 'clx1234567890',
  }),
  name: z.string().min(1).max(200).meta({
    description: 'Chapter name/title',
    example: 'Chapter 1: The Awakening',
  }),
  summary: z.string().optional().meta({
    description: 'Chapter summary/description',
    example: 'The hero awakens to a new world...',
  }),
  nodeType: nodeTypeSchema.optional(),
  sortOrder: z.number().int().optional().meta({
    description: 'Sort order within arc (defaults to end)',
    example: 0,
  }),
  status: z.string().optional().meta({
    description: 'Chapter status: draft, needs_work, review, done',
    example: 'draft',
  }),
})

// Update chapter request body (all fields optional)
const updateChapterBodySchema = z.strictObject({
  name: z.string().min(1).max(200).optional().meta({
    description: 'Chapter name/title',
    example: 'Chapter 1: The Awakening',
  }),
  summary: z.string().nullable().optional().meta({
    description: 'Chapter summary/description',
    example: 'The hero awakens to a new world...',
  }),
  nodeType: nodeTypeSchema.optional(),
  sortOrder: z.number().int().optional().meta({
    description: 'Sort order within arc',
    example: 0,
  }),
  publishedOn: z.string().datetime().nullable().optional().meta({
    description: 'Publication date',
    example: '2025-12-05T12:00:00.000Z',
  }),
  royalRoadId: z.number().nullable().optional().meta({
    description: 'Royal Road chapter ID',
    example: 123456,
  }),
  status: z.string().nullable().optional().meta({
    description: 'Chapter status: draft, needs_work, review, done',
    example: 'draft',
  }),
})

// Path parameters
const arcIdParamSchema = z.strictObject({
  arcId: z.string().meta({
    description: 'Arc ID',
    example: 'clx1234567890',
  }),
})

const chapterIdParamSchema = z.strictObject({
  id: z.string().meta({
    description: 'Chapter ID',
    example: 'clx1234567890',
  }),
})

// Response schemas
const createChapterResponseSchema = z.strictObject({
  success: z.literal(true),
  chapter: chapterSchema,
})

const listChaptersResponseSchema = z.strictObject({
  chapters: z.array(chapterSchema),
})

const getChapterResponseSchema = z.strictObject({
  chapter: chapterSchema,
})

const updateChapterResponseSchema = z.strictObject({
  success: z.literal(true),
  chapter: chapterSchema,
})

const deleteChapterResponseSchema = z.strictObject({
  success: z.literal(true),
})

// Helper to format chapter for response
function formatChapter(chapter: any) {
  return {
    ...chapter,
    publishedOn: chapter.publishedOn?.toISOString() || null,
    createdAt: chapter.createdAt.toISOString(),
    updatedAt: chapter.updatedAt.toISOString(),
  }
}

const myChaptersRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // All routes require authentication
  fastify.addHook('preHandler', requireAuth)

  // POST /my/arcs/:arcId/chapters - Create new chapter
  fastify.post(
    '/arcs/:arcId/chapters',
    {
      schema: {
        description: 'Create a new chapter in an arc',
        tags: ['my-chapters'],
        security: [{ sessionAuth: [] }],
        params: arcIdParamSchema,
        body: createChapterBodySchema,
        response: {
          201: createChapterResponseSchema,
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
        const { arcId } = request.params
        const { id, name, summary, nodeType, sortOrder } = request.body

        // Verify arc exists and user owns the parent story
        const arc = await prisma.arc.findFirst({
          where: {
            id: arcId,
            book: {
              story: {
                ownerId: userId,
              },
            },
          },
        })

        if (!arc) {
          return reply.status(404).send({ error: 'Arc not found' })
        }

        // Determine sort order if not provided
        let finalSortOrder = sortOrder
        if (finalSortOrder === undefined) {
          const maxChapter = await prisma.chapter.findFirst({
            where: { arcId },
            orderBy: { sortOrder: 'desc' },
            select: { sortOrder: true },
          })
          finalSortOrder = maxChapter ? maxChapter.sortOrder + 1 : 0
        }

        const chapter = await prisma.chapter.create({
          data: {
            ...(id && { id }), // Use client-provided ID if present
            name,
            summary: summary || null,
            arcId,
            sortOrder: finalSortOrder,
            nodeType: nodeType || 'story',
          },
        })

        fastify.log.info({ chapterId: chapter.id, arcId, userId }, 'Chapter created')

        return reply.status(201).send({
          success: true as const,
          chapter: formatChapter(chapter),
        })
      } catch (error) {
        fastify.log.error({ error }, 'Failed to create chapter')
        return reply.status(500).send({ error: 'Failed to create chapter' })
      }
    },
  )

  // GET /my/arcs/:arcId/chapters - List chapters in an arc
  fastify.get(
    '/arcs/:arcId/chapters',
    {
      schema: {
        description: 'List all chapters in an arc',
        tags: ['my-chapters'],
        security: [{ sessionAuth: [] }],
        params: arcIdParamSchema,
        response: {
          200: listChaptersResponseSchema,
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id
        const { arcId } = request.params

        // Verify arc exists and user owns the parent story
        const arc = await prisma.arc.findFirst({
          where: {
            id: arcId,
            book: {
              story: {
                ownerId: userId,
              },
            },
          },
        })

        if (!arc) {
          return reply.status(404).send({ error: 'Arc not found' })
        }

        // Get chapters (filter out deleted)
        const chapters = await prisma.chapter.findMany({
          where: { arcId, deleted: false },
          orderBy: { sortOrder: 'asc' },
        })

        return {
          chapters: chapters.map(formatChapter),
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to list chapters')
        return reply.status(500).send({ error: 'Failed to list chapters' })
      }
    },
  )

  // GET /my/chapters/:id - Get single chapter
  fastify.get(
    '/chapters/:id',
    {
      schema: {
        description: 'Get a single chapter by ID (must own the parent story)',
        tags: ['my-chapters'],
        security: [{ sessionAuth: [] }],
        params: chapterIdParamSchema,
        response: {
          200: getChapterResponseSchema,
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id
        const { id } = request.params

        const chapter = await prisma.chapter.findFirst({
          where: {
            id,
            deleted: false,
            arc: {
              book: {
                story: {
                  ownerId: userId,
                },
              },
            },
          },
        })

        if (!chapter) {
          return reply.status(404).send({ error: 'Chapter not found' })
        }

        return {
          chapter: formatChapter(chapter),
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get chapter')
        return reply.status(500).send({ error: 'Failed to get chapter' })
      }
    },
  )

  // PATCH /my/chapters/:id - Update chapter
  fastify.patch(
    '/chapters/:id',
    {
      schema: {
        description: 'Update a chapter (must own the parent story)',
        tags: ['my-chapters'],
        security: [{ sessionAuth: [] }],
        params: chapterIdParamSchema,
        body: updateChapterBodySchema,
        response: {
          200: updateChapterResponseSchema,
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
        const { id } = request.params
        const updates = request.body

        // Check if chapter exists and user owns the parent story
        const existingChapter = await prisma.chapter.findFirst({
          where: {
            id,
            arc: {
              book: {
                story: {
                  ownerId: userId,
                },
              },
            },
          },
        })

        if (!existingChapter) {
          return reply.status(404).send({ error: 'Chapter not found' })
        }

        // Convert publishedOn string to Date if provided
        const data: any = { ...updates }
        if (data.publishedOn !== undefined && data.publishedOn !== null) {
          data.publishedOn = new Date(data.publishedOn)
        }

        // Update chapter
        const chapter = await prisma.chapter.update({
          where: { id },
          data,
        })

        fastify.log.info({ chapterId: chapter.id, userId }, 'Chapter updated')

        return {
          success: true as const,
          chapter: formatChapter(chapter),
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to update chapter')
        return reply.status(500).send({ error: 'Failed to update chapter' })
      }
    },
  )

  // DELETE /my/chapters/:id - Delete chapter
  fastify.delete(
    '/chapters/:id',
    {
      schema: {
        description:
          'Delete a chapter. By default performs soft delete; use ?permanent=true for hard delete.',
        tags: ['my-chapters'],
        security: [{ sessionAuth: [] }],
        params: chapterIdParamSchema,
        querystring: z.strictObject({
          permanent: z
            .enum(['true', 'false'])
            .optional()
            .meta({
              description: 'If true, permanently delete (no recovery possible)',
              example: 'false',
            }),
        }),
        response: {
          200: deleteChapterResponseSchema,
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id
        const { id } = request.params
        const permanent = request.query.permanent === 'true'

        // Check if chapter exists and user owns the parent story
        const existingChapter = await prisma.chapter.findFirst({
          where: {
            id,
            arc: {
              book: {
                story: {
                  ownerId: userId,
                },
              },
            },
          },
          include: {
            scenes: { select: { id: true } },
          },
        })

        if (!existingChapter) {
          return reply.status(404).send({ error: 'Chapter not found' })
        }

        if (permanent) {
          // Hard delete - cascade will handle scenes/messages
          await prisma.chapter.delete({
            where: { id },
          })
          fastify.log.info({ chapterId: id, userId }, 'Chapter permanently deleted')
        } else {
          // Soft delete - mark chapter, its scenes, and their messages as deleted
          const now = new Date()
          const sceneIds = existingChapter.scenes.map((s) => s.id)
          await prisma.$transaction([
            prisma.chapter.update({
              where: { id },
              data: { deleted: true, deletedAt: now },
            }),
            prisma.scene.updateMany({
              where: { chapterId: id },
              data: { deleted: true, deletedAt: now },
            }),
            prisma.message.updateMany({
              where: { sceneId: { in: sceneIds } },
              data: { deleted: true },
            }),
          ])
          fastify.log.info({ chapterId: id, userId }, 'Chapter soft deleted')
        }

        return {
          success: true as const,
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to delete chapter')
        return reply.status(500).send({ error: 'Failed to delete chapter' })
      }
    },
  )
}

export default myChaptersRoutes
