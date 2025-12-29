import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { prisma } from '../../lib/prisma.js'
import { errorSchema } from '../../schemas/common.js'

// Schema for a single plot point state
const plotPointStateSchema = z.object({
  id: z.string().meta({
    description: 'Plot point state ID',
    example: 'clx1234567890',
  }),
  storyId: z.string().meta({
    description: 'Story ID',
    example: 'clx1234567890',
  }),
  messageId: z.string().meta({
    description: 'Message ID where this state is set',
    example: 'clx1234567890',
  }),
  key: z.string().meta({
    description: 'Plot point key',
    example: 'ahsokaFeeling',
  }),
  value: z.string().meta({
    description: 'Plot point value (stored as string, parse as needed)',
    example: 'positive',
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

// Path parameters
const storyIdParamSchema = z.object({
  storyId: z.string().meta({
    description: 'Story ID',
    example: 'clx1234567890',
  }),
})

const messageIdParamSchema = z.object({
  messageId: z.string().meta({
    description: 'Message ID',
    example: 'clx1234567890',
  }),
})

const messageKeyParamSchema = z.object({
  messageId: z.string().meta({
    description: 'Message ID',
    example: 'clx1234567890',
  }),
  key: z.string().meta({
    description: 'Plot point key',
    example: 'ahsokaFeeling',
  }),
})

// Request body for setting a plot point state
const setPlotPointStateBodySchema = z.object({
  key: z.string().min(1).meta({
    description: 'Plot point key',
    example: 'ahsokaFeeling',
  }),
  value: z.string().meta({
    description: 'Plot point value (numbers should be stringified)',
    example: 'positive',
  }),
})

// Response schemas
const listPlotPointStatesResponseSchema = z.object({
  plotPointStates: z.array(plotPointStateSchema),
})

const setPlotPointStateResponseSchema = z.object({
  success: z.literal(true),
  plotPointState: plotPointStateSchema,
})

const deletePlotPointStateResponseSchema = z.object({
  success: z.literal(true),
})

// Helper to format state for response
function formatState(state: any) {
  return {
    ...state,
    createdAt: state.createdAt.toISOString(),
    updatedAt: state.updatedAt.toISOString(),
  }
}

const plotPointStatesRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // All routes require authentication
  fastify.addHook('preHandler', requireAuth)

  // GET /my/stories/:storyId/plot-point-states - List all plot point states for a story
  fastify.get(
    '/stories/:storyId/plot-point-states',
    {
      schema: {
        description: 'List all plot point states for a story',
        tags: ['plot-points'],
        security: [{ sessionAuth: [] }],
        params: storyIdParamSchema,
        response: {
          200: listPlotPointStatesResponseSchema,
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

        // Verify story ownership
        const story = await prisma.story.findFirst({
          where: { id: storyId, ownerId: userId },
          select: { id: true },
        })

        if (!story) {
          return reply.status(404).send({ error: 'Story not found' })
        }

        const states = await prisma.plotPointState.findMany({
          where: { storyId },
          orderBy: { createdAt: 'asc' },
        })

        return {
          plotPointStates: states.map(formatState),
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to list plot point states')
        return reply.status(500).send({ error: 'Failed to list plot point states' })
      }
    },
  )

  // POST /my/messages/:messageId/plot-point-states - Set a plot point state at a message (upsert)
  fastify.post(
    '/messages/:messageId/plot-point-states',
    {
      schema: {
        description: 'Set a plot point state at a message (creates or updates)',
        tags: ['plot-points'],
        security: [{ sessionAuth: [] }],
        params: messageIdParamSchema,
        body: setPlotPointStateBodySchema,
        response: {
          200: setPlotPointStateResponseSchema,
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id
        const { messageId } = request.params
        const { key, value } = request.body

        // Verify message exists and user owns the story
        const message = await prisma.message.findFirst({
          where: { id: messageId },
          include: {
            scene: {
              include: {
                chapter: {
                  include: {
                    arc: {
                      include: {
                        book: {
                          include: {
                            story: {
                              select: { id: true, ownerId: true },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        })

        if (!message) {
          return reply.status(404).send({ error: 'Message not found' })
        }

        const story = message.scene.chapter.arc.book.story
        if (story.ownerId !== userId) {
          return reply.status(404).send({ error: 'Message not found' })
        }

        // Upsert the plot point state
        const state = await prisma.plotPointState.upsert({
          where: {
            messageId_key: {
              messageId,
              key,
            },
          },
          create: {
            storyId: story.id,
            messageId,
            key,
            value,
          },
          update: {
            value,
          },
        })

        fastify.log.info({ storyId: story.id, messageId, key }, 'Plot point state set')

        return {
          success: true as const,
          plotPointState: formatState(state),
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to set plot point state')
        return reply.status(500).send({ error: 'Failed to set plot point state' })
      }
    },
  )

  // DELETE /my/messages/:messageId/plot-point-states/:key - Remove a plot point state override
  fastify.delete(
    '/messages/:messageId/plot-point-states/:key',
    {
      schema: {
        description: 'Remove a plot point state override at a message',
        tags: ['plot-points'],
        security: [{ sessionAuth: [] }],
        params: messageKeyParamSchema,
        response: {
          200: deletePlotPointStateResponseSchema,
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id
        const { messageId, key } = request.params

        // Verify message exists and user owns the story
        const message = await prisma.message.findFirst({
          where: { id: messageId },
          include: {
            scene: {
              include: {
                chapter: {
                  include: {
                    arc: {
                      include: {
                        book: {
                          include: {
                            story: {
                              select: { id: true, ownerId: true },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        })

        if (!message) {
          return reply.status(404).send({ error: 'Message not found' })
        }

        const story = message.scene.chapter.arc.book.story
        if (story.ownerId !== userId) {
          return reply.status(404).send({ error: 'Message not found' })
        }

        // Delete the plot point state
        await prisma.plotPointState.deleteMany({
          where: {
            messageId,
            key,
          },
        })

        fastify.log.info({ storyId: story.id, messageId, key }, 'Plot point state deleted')

        return {
          success: true as const,
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to delete plot point state')
        return reply.status(500).send({ error: 'Failed to delete plot point state' })
      }
    },
  )
}

export default plotPointStatesRoutes
