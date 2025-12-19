import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { prisma } from '../../lib/prisma.js'
import { errorSchema, successSchema } from '../../schemas/common.js'

// ============================================================================
// HELPERS
// ============================================================================

// Helper to transform Prisma dates to ISO strings
function transformDates<T extends { createdAt: Date; updatedAt: Date }>(
  obj: T,
): Omit<T, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string } {
  return {
    ...obj,
    createdAt: obj.createdAt.toISOString(),
    updatedAt: obj.updatedAt.toISOString(),
  }
}

// ============================================================================
// SCHEMAS
// ============================================================================

// Message schemas
const messageSchema = z.strictObject({
  id: z.string().meta({ example: 'clx1234567890' }),
  sceneId: z.string().meta({ example: 'clx1234567890' }),
  sortOrder: z.number().int().meta({ example: 0 }),
  instruction: z.string().nullable().meta({ example: 'Write a dramatic opening' }),
  script: z.string().nullable().meta({ example: 'console.log("hello")' }),
  currentMessageRevisionId: z.string().nullable().meta({ example: 'clx1234567890' }),
  createdAt: z.string().datetime().meta({ example: '2025-12-06T12:00:00.000Z' }),
  updatedAt: z.string().datetime().meta({ example: '2025-12-06T12:00:00.000Z' }),
})

// Create message body
const createMessageBodySchema = z.strictObject({
  id: z.string().optional().meta({
    description: 'Optional client-provided ID (auto-generated if not provided)',
    example: 'clx1234567890',
  }),
  instruction: z.string().optional().meta({
    description: 'Generation instruction for this message',
    example: 'Write a dramatic opening scene',
  }),
  script: z.string().optional().meta({
    description: 'JavaScript to execute',
    example: 'console.log("scene setup")',
  }),
  sortOrder: z.number().int().min(0).optional().meta({
    description: 'Display order (auto-increments if not provided)',
    example: 0,
  }),
})

// Update message body
const updateMessageBodySchema = z.strictObject({
  instruction: z.string().optional().meta({
    description: 'Generation instruction for this message',
  }),
  script: z.string().optional().meta({
    description: 'JavaScript to execute',
  }),
  sortOrder: z.number().int().min(0).optional().meta({
    description: 'Display order',
  }),
})

// Response schemas
const createMessageResponseSchema = z.strictObject({
  success: z.literal(true),
  message: messageSchema,
})

const getMessageResponseSchema = z.strictObject({
  message: messageSchema,
})

const listMessagesResponseSchema = z.strictObject({
  messages: z.array(messageSchema),
})

// ============================================================================
// ROUTES
// ============================================================================

const messageRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // Create message in scene
  fastify.post(
    '/scenes/:sceneId/messages',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Create a new message in a scene (auto-creates initial MessageRevision v1)',
        tags: ['messages'],
        params: z.strictObject({
          sceneId: z.string().meta({
            description: 'Scene ID',
            example: 'clx1234567890',
          }),
        }),
        body: createMessageBodySchema,
        response: {
          201: createMessageResponseSchema,
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { sceneId } = request.params
      const userId = request.user!.id

      // Verify scene exists and user owns it
      const scene = await prisma.scene.findUnique({
        where: { id: sceneId },
        include: {
          chapter: {
            include: {
              arc: {
                include: {
                  book: {
                    include: {
                      story: true,
                    },
                  },
                },
              },
            },
          },
        },
      })

      if (!scene) {
        return reply.code(404).send({ error: 'Scene not found' })
      }

      if (scene.chapter.arc.book.story.ownerId !== userId) {
        return reply.code(404).send({ error: 'Scene not found' })
      }

      // Handle sortOrder: if provided, bump all messages at or after that position
      let sortOrder = request.body.sortOrder
      if (sortOrder !== undefined) {
        // Increment sortOrder for all messages at or after the insertion point
        await prisma.message.updateMany({
          where: {
            sceneId,
            sortOrder: { gte: sortOrder },
          },
          data: {
            sortOrder: { increment: 1 },
          },
        })
      } else {
        // Append to end
        const maxOrder = await prisma.message.findFirst({
          where: { sceneId },
          orderBy: { sortOrder: 'desc' },
          select: { sortOrder: true },
        })
        sortOrder = maxOrder ? maxOrder.sortOrder + 1 : 0
      }

      // Create message with initial MessageRevision (v1)
      const message = await prisma.message.create({
        data: {
          id: request.body.id, // Use client-provided ID if given, otherwise Prisma generates one
          sceneId,
          sortOrder,
          instruction: request.body.instruction || null,
          script: request.body.script || null,
          messageRevisions: {
            create: {
              version: 1,
            },
          },
        },
        include: {
          messageRevisions: true,
        },
      })

      // Set currentMessageRevisionId to the first revision
      const updatedMessage = await prisma.message.update({
        where: { id: message.id },
        data: {
          currentMessageRevisionId: message.messageRevisions[0].id,
        },
      })

      // Transform dates to ISO strings for schema validation
      return reply.code(201).send({
        success: true as const,
        message: transformDates(updatedMessage),
      })
    },
  )

  // List messages in a scene
  fastify.get(
    '/scenes/:sceneId/messages',
    {
      preHandler: requireAuth,
      schema: {
        description: 'List all messages in a scene (ordered by sortOrder)',
        tags: ['messages'],
        params: z.strictObject({
          sceneId: z.string().meta({
            description: 'Scene ID',
            example: 'clx1234567890',
          }),
        }),
        response: {
          200: listMessagesResponseSchema,
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { sceneId } = request.params
      const userId = request.user!.id

      // Verify scene exists and user owns it
      const scene = await prisma.scene.findUnique({
        where: { id: sceneId },
        include: {
          chapter: {
            include: {
              arc: {
                include: {
                  book: {
                    include: {
                      story: true,
                    },
                  },
                },
              },
            },
          },
        },
      })

      if (!scene) {
        return reply.code(404).send({ error: 'Scene not found' })
      }

      if (scene.chapter.arc.book.story.ownerId !== userId) {
        return reply.code(404).send({ error: 'Scene not found' })
      }

      const messages = await prisma.message.findMany({
        where: { sceneId },
        orderBy: { sortOrder: 'asc' },
      })

      return { messages: messages.map(transformDates) }
    },
  )

  // Get single message
  fastify.get(
    '/messages/:id',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Get a single message by ID',
        tags: ['messages'],
        params: z.strictObject({
          id: z.string().meta({
            description: 'Message ID',
            example: 'clx1234567890',
          }),
        }),
        response: {
          200: getMessageResponseSchema,
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params
      const userId = request.user!.id

      const message = await prisma.message.findUnique({
        where: { id },
        include: {
          scene: {
            include: {
              chapter: {
                include: {
                  arc: {
                    include: {
                      book: {
                        include: {
                          story: true,
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
        return reply.code(404).send({ error: 'Message not found' })
      }

      if (message.scene.chapter.arc.book.story.ownerId !== userId) {
        return reply.code(404).send({ error: 'Message not found' })
      }

      // Return without nested scene data
      const { scene, ...messageData } = message

      return { message: transformDates(messageData) }
    },
  )

  // Update message
  fastify.patch(
    '/messages/:id',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Update message metadata (instruction, script, sortOrder)',
        tags: ['messages'],
        params: z.strictObject({
          id: z.string().meta({
            description: 'Message ID',
            example: 'clx1234567890',
          }),
        }),
        body: updateMessageBodySchema,
        response: {
          200: z.strictObject({
            success: z.literal(true),
            message: messageSchema,
          }),
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params
      const userId = request.user!.id

      // Verify message exists and user owns it
      const message = await prisma.message.findUnique({
        where: { id },
        include: {
          scene: {
            include: {
              chapter: {
                include: {
                  arc: {
                    include: {
                      book: {
                        include: {
                          story: true,
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
        return reply.code(404).send({ error: 'Message not found' })
      }

      if (message.scene.chapter.arc.book.story.ownerId !== userId) {
        return reply.code(404).send({ error: 'Message not found' })
      }

      // Update message
      const updated = await prisma.message.update({
        where: { id },
        data: {
          instruction: request.body.instruction,
          script: request.body.script,
          sortOrder: request.body.sortOrder,
        },
      })

      return {
        success: true as const,
        message: transformDates(updated),
      }
    },
  )

  // Delete message
  fastify.delete(
    '/messages/:id',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Delete a message (cascades to all MessageRevisions and Paragraphs)',
        tags: ['messages'],
        params: z.strictObject({
          id: z.string().meta({
            description: 'Message ID',
            example: 'clx1234567890',
          }),
        }),
        response: {
          200: successSchema,
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params
      const userId = request.user!.id

      // Verify message exists and user owns it
      const message = await prisma.message.findUnique({
        where: { id },
        include: {
          scene: {
            include: {
              chapter: {
                include: {
                  arc: {
                    include: {
                      book: {
                        include: {
                          story: true,
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
        return reply.code(404).send({ error: 'Message not found' })
      }

      if (message.scene.chapter.arc.book.story.ownerId !== userId) {
        return reply.code(404).send({ error: 'Message not found' })
      }

      await prisma.message.delete({
        where: { id },
      })

      return { success: true as const }
    },
  )
}

export default messageRoutes
