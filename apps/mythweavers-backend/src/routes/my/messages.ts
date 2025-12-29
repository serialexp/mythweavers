import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import type { JsonValue } from '@prisma/client/runtime/library'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { prisma } from '../../lib/prisma.js'
import { errorSchema, successSchema } from '../../schemas/common.js'

// ============================================================================
// TYPES
// ============================================================================

// Branch option type for type casting
type BranchOption = {
  id: string
  label: string
  targetNodeId: string
  targetMessageId: string
  description?: string
}

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

// Helper to transform message from Prisma (dates + options type cast)
function transformMessage<T extends { createdAt: Date; updatedAt: Date; options: JsonValue | null }>(
  obj: T,
): Omit<T, 'createdAt' | 'updatedAt' | 'options'> & { createdAt: string; updatedAt: string; options: BranchOption[] | null } {
  return {
    ...obj,
    createdAt: obj.createdAt.toISOString(),
    updatedAt: obj.updatedAt.toISOString(),
    options: obj.options as BranchOption[] | null,
  }
}

// Helper to convert options for Prisma input (handles null -> Prisma.JsonNull)
function toJsonInput(value: BranchOption[] | null | undefined): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (value === null) {
    return Prisma.JsonNull
  }
  if (value === undefined) {
    return undefined
  }
  return value as unknown as Prisma.InputJsonValue
}

// ============================================================================
// SCHEMAS
// ============================================================================

// Branch option schema (for branch messages)
const branchOptionSchema = z.strictObject({
  id: z.string().meta({ example: 'opt123' }),
  label: z.string().meta({ example: 'Trust the stranger' }),
  targetNodeId: z.string().meta({ example: 'clx9876543210' }),
  targetMessageId: z.string().meta({ example: 'clx1234567890' }),
  description: z.string().optional().meta({ example: 'You decide to take a chance' }),
})

// Message schemas
const messageSchema = z.strictObject({
  id: z.string().meta({ example: 'clx1234567890' }),
  sceneId: z.string().meta({ example: 'clx1234567890' }),
  sortOrder: z.number().int().meta({ example: 0 }),
  instruction: z.string().nullable().meta({ example: 'Write a dramatic opening' }),
  script: z.string().nullable().meta({ example: 'console.log("hello")' }),
  deleted: z.boolean().meta({ example: false, description: 'Soft delete flag' }),
  type: z
    .string()
    .nullable()
    .meta({ example: 'branch', description: 'Message type: null for normal, branch for choices, event for events' }),
  options: z
    .array(branchOptionSchema)
    .nullable()
    .meta({ description: 'Branch options - only present for branch type messages' }),
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
  type: z.string().optional().meta({
    description: 'Message type: null for normal, branch for choices, event for events',
    example: 'branch',
  }),
  options: z.array(branchOptionSchema).optional().meta({
    description: 'Branch options - only for branch type messages',
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
  type: z.string().nullable().optional().meta({
    description: 'Message type: null for normal, branch for choices, event for events',
  }),
  options: z.array(branchOptionSchema).nullable().optional().meta({
    description: 'Branch options - only for branch type messages',
  }),
  deleted: z.boolean().optional().meta({
    description: 'Soft delete flag',
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
          type: request.body.type || null,
          options: toJsonInput(request.body.options), // undefined if not provided, array if provided
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
      const firstRevision = message.messageRevisions[0]
      const updatedMessage = await prisma.message.update({
        where: { id: message.id },
        data: {
          currentMessageRevisionId: firstRevision.id,
        },
      })

      // Transform dates to ISO strings for schema validation
      return reply.code(201).send({
        success: true as const,
        message: transformMessage(updatedMessage),
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

      return { messages: messages.map(transformMessage) }
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

      return { message: transformMessage(messageData) }
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
          type: request.body.type,
          options: toJsonInput(request.body.options),
          deleted: request.body.deleted,
        },
      })

      return {
        success: true as const,
        message: transformMessage(updated),
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

  // Bulk reorder messages (supports moving between scenes)
  fastify.post(
    '/stories/:storyId/messages/reorder',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Bulk reorder messages and optionally move them between scenes',
        tags: ['messages'],
        params: z.strictObject({
          storyId: z.string().meta({
            description: 'Story ID',
            example: 'clx1234567890',
          }),
        }),
        body: z.strictObject({
          storyId: z.string().optional().meta({
            description: 'Story ID (also in path, included for compatibility)',
          }),
          items: z.array(
            z.strictObject({
              messageId: z.string().meta({ description: 'Message ID to update' }),
              nodeId: z.string().meta({ description: 'Target scene/node ID' }),
              order: z.number().int().min(0).meta({ description: 'New sort order' }),
            }),
          ).meta({
            description: 'Array of message updates',
          }),
        }),
        response: {
          200: z.strictObject({
            success: z.literal(true),
            updatedAt: z.string().datetime().meta({ example: '2025-12-06T12:00:00.000Z' }),
          }),
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { storyId } = request.params
      const { items } = request.body
      const userId = request.user!.id

      // Verify story exists and user owns it
      const story = await prisma.story.findUnique({
        where: { id: storyId },
        select: { ownerId: true },
      })

      if (!story) {
        return reply.code(404).send({ error: 'Story not found' })
      }

      if (story.ownerId !== userId) {
        return reply.code(404).send({ error: 'Story not found' })
      }

      if (items.length === 0) {
        return {
          success: true as const,
          updatedAt: new Date().toISOString(),
        }
      }

      // Update all messages in a transaction
      const updatedAt = new Date()
      await prisma.$transaction(
        items.map((item) =>
          prisma.message.update({
            where: { id: item.messageId },
            data: {
              sceneId: item.nodeId,
              sortOrder: item.order,
              updatedAt,
            },
          }),
        ),
      )

      return {
        success: true as const,
        updatedAt: updatedAt.toISOString(),
      }
    },
  )
}

export default messageRoutes
