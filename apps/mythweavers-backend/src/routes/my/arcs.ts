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

// Arc response schema
const arcSchema = z.strictObject({
  id: z.string().meta({
    description: 'Arc ID',
    example: 'clx1234567890',
  }),
  name: z.string().meta({
    description: 'Arc name/title',
    example: 'The Quest Begins',
  }),
  summary: z.string().nullable().meta({
    description: 'Arc summary/description',
    example: 'Our heroes embark on their journey...',
  }),
  bookId: z.string().meta({
    description: 'Parent book ID',
    example: 'clx9876543210',
  }),
  sortOrder: z.number().meta({
    description: 'Sort order within book',
    example: 0,
  }),
  nodeType: nodeTypeSchema,
  createdAt: z.string().meta({
    description: 'Creation timestamp',
    example: '2025-12-05T12:00:00.000Z',
  }),
  updatedAt: z.string().meta({
    description: 'Last update timestamp',
    example: '2025-12-05T12:00:00.000Z',
  }),
})

// Create arc request body
const createArcBodySchema = z.strictObject({
  id: z.string().optional().meta({
    description: 'Optional client-provided ID (must be unique)',
    example: 'clx1234567890',
  }),
  name: z.string().min(1).max(200).meta({
    description: 'Arc name/title',
    example: 'The Quest Begins',
  }),
  summary: z.string().optional().meta({
    description: 'Arc summary/description',
    example: 'Our heroes embark on their journey...',
  }),
  nodeType: nodeTypeSchema.optional(),
  sortOrder: z.number().int().optional().meta({
    description: 'Sort order within book (defaults to end)',
    example: 0,
  }),
})

// Update arc request body (all fields optional)
const updateArcBodySchema = z.strictObject({
  name: z.string().min(1).max(200).optional().meta({
    description: 'Arc name/title',
    example: 'The Quest Begins',
  }),
  summary: z.string().nullable().optional().meta({
    description: 'Arc summary/description',
    example: 'Our heroes embark on their journey...',
  }),
  nodeType: nodeTypeSchema.optional(),
  sortOrder: z.number().int().optional().meta({
    description: 'Sort order within book',
    example: 0,
  }),
})

// Path parameters
const bookIdParamSchema = z.strictObject({
  bookId: z.string().meta({
    description: 'Book ID',
    example: 'clx1234567890',
  }),
})

const arcIdParamSchema = z.strictObject({
  id: z.string().meta({
    description: 'Arc ID',
    example: 'clx1234567890',
  }),
})

// Response schemas
const createArcResponseSchema = z.strictObject({
  success: z.literal(true),
  arc: arcSchema,
})

const listArcsResponseSchema = z.strictObject({
  arcs: z.array(arcSchema),
})

const getArcResponseSchema = z.strictObject({
  arc: arcSchema,
})

const updateArcResponseSchema = z.strictObject({
  success: z.literal(true),
  arc: arcSchema,
})

const deleteArcResponseSchema = z.strictObject({
  success: z.literal(true),
})

// Helper to format arc for response
function formatArc(arc: any) {
  return {
    ...arc,
    createdAt: arc.createdAt.toISOString(),
    updatedAt: arc.updatedAt.toISOString(),
  }
}

const myArcsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // All routes require authentication
  fastify.addHook('preHandler', requireAuth)

  // POST /my/books/:bookId/arcs - Create new arc
  fastify.post(
    '/books/:bookId/arcs',
    {
      schema: {
        description: 'Create a new arc in a book',
        tags: ['my-arcs'],
        security: [{ sessionAuth: [] }],
        params: bookIdParamSchema,
        body: createArcBodySchema,
        response: {
          201: createArcResponseSchema,
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
        const { bookId } = request.params
        const { id, name, summary, nodeType, sortOrder } = request.body

        // Verify book exists and user owns the parent story
        const book = await prisma.book.findFirst({
          where: {
            id: bookId,
            story: {
              ownerId: userId,
            },
          },
        })

        if (!book) {
          return reply.status(404).send({ error: 'Book not found' })
        }

        // Determine sort order if not provided
        let finalSortOrder = sortOrder
        if (finalSortOrder === undefined) {
          const maxArc = await prisma.arc.findFirst({
            where: { bookId },
            orderBy: { sortOrder: 'desc' },
            select: { sortOrder: true },
          })
          finalSortOrder = maxArc ? maxArc.sortOrder + 1 : 0
        }

        const arc = await prisma.arc.create({
          data: {
            ...(id && { id }), // Use client-provided ID if present
            name,
            summary: summary || null,
            bookId,
            sortOrder: finalSortOrder,
            nodeType: nodeType || 'story',
          },
        })

        fastify.log.info({ arcId: arc.id, bookId, userId }, 'Arc created')

        return reply.status(201).send({
          success: true as const,
          arc: formatArc(arc),
        })
      } catch (error) {
        fastify.log.error({ error }, 'Failed to create arc')
        return reply.status(500).send({ error: 'Failed to create arc' })
      }
    },
  )

  // GET /my/books/:bookId/arcs - List arcs in a book
  fastify.get(
    '/books/:bookId/arcs',
    {
      schema: {
        description: 'List all arcs in a book',
        tags: ['my-arcs'],
        security: [{ sessionAuth: [] }],
        params: bookIdParamSchema,
        response: {
          200: listArcsResponseSchema,
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id
        const { bookId } = request.params

        // Verify book exists and user owns the parent story
        const book = await prisma.book.findFirst({
          where: {
            id: bookId,
            story: {
              ownerId: userId,
            },
          },
        })

        if (!book) {
          return reply.status(404).send({ error: 'Book not found' })
        }

        // Get arcs
        const arcs = await prisma.arc.findMany({
          where: { bookId },
          orderBy: { sortOrder: 'asc' },
        })

        return {
          arcs: arcs.map(formatArc),
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to list arcs')
        return reply.status(500).send({ error: 'Failed to list arcs' })
      }
    },
  )

  // GET /my/arcs/:id - Get single arc
  fastify.get(
    '/arcs/:id',
    {
      schema: {
        description: 'Get a single arc by ID (must own the parent story)',
        tags: ['my-arcs'],
        security: [{ sessionAuth: [] }],
        params: arcIdParamSchema,
        response: {
          200: getArcResponseSchema,
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

        const arc = await prisma.arc.findFirst({
          where: {
            id,
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

        return {
          arc: formatArc(arc),
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get arc')
        return reply.status(500).send({ error: 'Failed to get arc' })
      }
    },
  )

  // PATCH /my/arcs/:id - Update arc
  fastify.patch(
    '/arcs/:id',
    {
      schema: {
        description: 'Update an arc (must own the parent story)',
        tags: ['my-arcs'],
        security: [{ sessionAuth: [] }],
        params: arcIdParamSchema,
        body: updateArcBodySchema,
        response: {
          200: updateArcResponseSchema,
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

        // Check if arc exists and user owns the parent story
        const existingArc = await prisma.arc.findFirst({
          where: {
            id,
            book: {
              story: {
                ownerId: userId,
              },
            },
          },
        })

        if (!existingArc) {
          return reply.status(404).send({ error: 'Arc not found' })
        }

        // Update arc
        const arc = await prisma.arc.update({
          where: { id },
          data: updates,
        })

        fastify.log.info({ arcId: arc.id, userId }, 'Arc updated')

        return {
          success: true as const,
          arc: formatArc(arc),
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to update arc')
        return reply.status(500).send({ error: 'Failed to update arc' })
      }
    },
  )

  // DELETE /my/arcs/:id - Delete arc
  fastify.delete(
    '/arcs/:id',
    {
      schema: {
        description: 'Delete an arc (must own the parent story)',
        tags: ['my-arcs'],
        security: [{ sessionAuth: [] }],
        params: arcIdParamSchema,
        response: {
          200: deleteArcResponseSchema,
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

        // Check if arc exists and user owns the parent story
        const existingArc = await prisma.arc.findFirst({
          where: {
            id,
            book: {
              story: {
                ownerId: userId,
              },
            },
          },
        })

        if (!existingArc) {
          return reply.status(404).send({ error: 'Arc not found' })
        }

        // Delete arc (cascade will handle chapters/scenes)
        await prisma.arc.delete({
          where: { id },
        })

        fastify.log.info({ arcId: id, userId }, 'Arc deleted')

        return {
          success: true as const,
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to delete arc')
        return reply.status(500).send({ error: 'Failed to delete arc' })
      }
    },
  )
}

export default myArcsRoutes
