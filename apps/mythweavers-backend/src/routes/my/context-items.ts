import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { prisma } from '../../lib/prisma.js'
import { errorSchema } from '../../schemas/common.js'

// Context item type enum
const contextItemTypeSchema = z.enum(['theme', 'location', 'plot']).meta({
  description: 'Context item type',
  example: 'location',
})

// Context item response schema
const contextItemSchema = z.strictObject({
  id: z.string().meta({
    description: 'Context item ID',
    example: 'clx1234567890',
  }),
  storyId: z.string().meta({
    description: 'Parent story ID',
    example: 'clx9876543210',
  }),
  type: contextItemTypeSchema,
  name: z.string().meta({
    description: 'Context item name',
    example: 'The Grand Library',
  }),
  description: z.string().meta({
    description: 'Context item description (for AI generation)',
    example: 'A vast library filled with ancient tomes and scrolls',
  }),
  isGlobal: z.boolean().meta({
    description: 'Whether this context item is active in all chapters',
    example: false,
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

// Create context item request body
const createContextItemBodySchema = z.strictObject({
  type: contextItemTypeSchema,
  name: z.string().min(1).max(200).meta({
    description: 'Context item name',
    example: 'The Grand Library',
  }),
  description: z.string().min(1).meta({
    description: 'Context item description (for AI generation)',
    example: 'A vast library filled with ancient tomes and scrolls',
  }),
  isGlobal: z.boolean().optional().meta({
    description: 'Whether this context item is active in all chapters (defaults to false)',
    example: false,
  }),
})

// Update context item request body (all fields optional)
const updateContextItemBodySchema = z.strictObject({
  type: contextItemTypeSchema.optional(),
  name: z.string().min(1).max(200).optional().meta({
    description: 'Context item name',
    example: 'The Grand Library',
  }),
  description: z.string().min(1).optional().meta({
    description: 'Context item description (for AI generation)',
    example: 'A vast library filled with ancient tomes and scrolls',
  }),
  isGlobal: z.boolean().optional().meta({
    description: 'Whether this context item is active in all chapters',
    example: true,
  }),
})

// Path parameters
const storyIdParamSchema = z.strictObject({
  storyId: z.string().meta({
    description: 'Story ID',
    example: 'clx1234567890',
  }),
})

const contextItemIdParamSchema = z.strictObject({
  id: z.string().meta({
    description: 'Context item ID',
    example: 'clx1234567890',
  }),
})

// Query parameters for list
const listContextItemsQuerySchema = z.strictObject({
  type: contextItemTypeSchema.optional().meta({
    description: 'Filter by context item type',
    example: 'location',
  }),
})

// Response schemas
const createContextItemResponseSchema = z.strictObject({
  success: z.literal(true),
  contextItem: contextItemSchema,
})

const listContextItemsResponseSchema = z.strictObject({
  contextItems: z.array(contextItemSchema),
})

const getContextItemResponseSchema = z.strictObject({
  contextItem: contextItemSchema,
})

const updateContextItemResponseSchema = z.strictObject({
  success: z.literal(true),
  contextItem: contextItemSchema,
})

const deleteContextItemResponseSchema = z.strictObject({
  success: z.literal(true),
})

// Helper to format context item for response
function formatContextItem(item: any) {
  return {
    ...item,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }
}

const myContextItemsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // All routes require authentication
  fastify.addHook('preHandler', requireAuth)

  // POST /my/stories/:storyId/context-items - Create new context item
  fastify.post(
    '/stories/:storyId/context-items',
    {
      schema: {
        description: 'Create a new context item in a story',
        tags: ['my-context-items'],
        security: [{ sessionAuth: [] }],
        params: storyIdParamSchema,
        body: createContextItemBodySchema,
        response: {
          201: createContextItemResponseSchema,
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
        const { type, name, description, isGlobal } = request.body

        // Verify story exists and is owned by user
        const story = await prisma.story.findFirst({
          where: {
            id: storyId,
            ownerId: userId,
          },
        })

        if (!story) {
          return reply.status(404).send({ error: 'Story not found' })
        }

        const contextItem = await prisma.contextItem.create({
          data: {
            storyId,
            type,
            name,
            description,
            isGlobal: isGlobal ?? false,
          },
        })

        fastify.log.info({ contextItemId: contextItem.id, storyId, userId }, 'Context item created')

        return reply.status(201).send({
          success: true as const,
          contextItem: formatContextItem(contextItem),
        })
      } catch (error) {
        fastify.log.error({ error }, 'Failed to create context item')
        return reply.status(500).send({ error: 'Failed to create context item' })
      }
    },
  )

  // GET /my/stories/:storyId/context-items - List context items in a story
  fastify.get(
    '/stories/:storyId/context-items',
    {
      schema: {
        description: 'List all context items in a story (with optional type filter)',
        tags: ['my-context-items'],
        security: [{ sessionAuth: [] }],
        params: storyIdParamSchema,
        querystring: listContextItemsQuerySchema,
        response: {
          200: listContextItemsResponseSchema,
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
        const { type } = request.query

        // Verify story exists and is owned by user
        const story = await prisma.story.findFirst({
          where: {
            id: storyId,
            ownerId: userId,
          },
        })

        if (!story) {
          return reply.status(404).send({ error: 'Story not found' })
        }

        // Get context items with optional type filter
        const contextItems = await prisma.contextItem.findMany({
          where: {
            storyId,
            ...(type ? { type } : {}),
          },
          orderBy: { createdAt: 'asc' },
        })

        return {
          contextItems: contextItems.map(formatContextItem),
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to list context items')
        return reply.status(500).send({ error: 'Failed to list context items' })
      }
    },
  )

  // GET /my/context-items/:id - Get single context item
  fastify.get(
    '/context-items/:id',
    {
      schema: {
        description: 'Get a single context item by ID (must own the parent story)',
        tags: ['my-context-items'],
        security: [{ sessionAuth: [] }],
        params: contextItemIdParamSchema,
        response: {
          200: getContextItemResponseSchema,
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

        const contextItem = await prisma.contextItem.findFirst({
          where: {
            id,
            story: {
              ownerId: userId,
            },
          },
        })

        if (!contextItem) {
          return reply.status(404).send({ error: 'Context item not found' })
        }

        return {
          contextItem: formatContextItem(contextItem),
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get context item')
        return reply.status(500).send({ error: 'Failed to get context item' })
      }
    },
  )

  // PATCH /my/context-items/:id - Update context item
  fastify.patch(
    '/context-items/:id',
    {
      schema: {
        description: 'Update a context item (must own the parent story)',
        tags: ['my-context-items'],
        security: [{ sessionAuth: [] }],
        params: contextItemIdParamSchema,
        body: updateContextItemBodySchema,
        response: {
          200: updateContextItemResponseSchema,
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

        // Check if context item exists and user owns the parent story
        const existingContextItem = await prisma.contextItem.findFirst({
          where: {
            id,
            story: {
              ownerId: userId,
            },
          },
        })

        if (!existingContextItem) {
          return reply.status(404).send({ error: 'Context item not found' })
        }

        // Update context item
        const contextItem = await prisma.contextItem.update({
          where: { id },
          data: updates,
        })

        fastify.log.info({ contextItemId: contextItem.id, userId }, 'Context item updated')

        return {
          success: true as const,
          contextItem: formatContextItem(contextItem),
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to update context item')
        return reply.status(500).send({ error: 'Failed to update context item' })
      }
    },
  )

  // DELETE /my/context-items/:id - Delete context item
  fastify.delete(
    '/context-items/:id',
    {
      schema: {
        description: 'Delete a context item (must own the parent story)',
        tags: ['my-context-items'],
        security: [{ sessionAuth: [] }],
        params: contextItemIdParamSchema,
        response: {
          200: deleteContextItemResponseSchema,
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

        // Check if context item exists and user owns the parent story
        const existingContextItem = await prisma.contextItem.findFirst({
          where: {
            id,
            story: {
              ownerId: userId,
            },
          },
        })

        if (!existingContextItem) {
          return reply.status(404).send({ error: 'Context item not found' })
        }

        // Delete context item
        await prisma.contextItem.delete({
          where: { id },
        })

        fastify.log.info({ contextItemId: id, userId }, 'Context item deleted')

        return {
          success: true as const,
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to delete context item')
        return reply.status(500).send({ error: 'Failed to delete context item' })
      }
    },
  )
}

export default myContextItemsRoutes
