import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { prisma } from '../../lib/prisma.js'
import { errorSchema } from '../../schemas/common.js'

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

// Paragraph data for batch creation
const batchParagraphSchema = z.strictObject({
  id: z.string().optional().meta({
    description: 'Optional client-provided ID (auto-generated if not provided)',
    example: 'clx1234567890',
  }),
  body: z.string().min(1).meta({
    description: 'Paragraph content text',
    example: 'The hero awakened to find the world transformed.',
  }),
  contentSchema: z.string().nullable().optional().meta({
    description: 'ProseMirror JSON structure for rich text (optional)',
  }),
  state: z.enum(['AI', 'DRAFT', 'REVISE', 'FINAL', 'SDT']).optional().meta({
    description: 'Paragraph state',
    example: 'DRAFT',
  }),
  sortOrder: z.number().int().min(0).optional().meta({
    description: 'Display order within the message',
    example: 0,
  }),
})

// Message data for batch creation
const batchMessageSchema = z.strictObject({
  id: z.string().optional().meta({
    description: 'Optional client-provided ID (auto-generated if not provided)',
    example: 'clx1234567890',
  }),
  sceneId: z.string().meta({
    description: 'Scene ID where the message belongs',
    example: 'clx1234567890',
  }),
  sortOrder: z.number().int().min(0).meta({
    description: 'Display order within the scene',
    example: 0,
  }),
  instruction: z.string().nullish().meta({
    description: 'Generation instruction for this message',
    example: 'Write a dramatic opening scene',
  }),
  script: z.string().nullish().meta({
    description: 'JavaScript to execute',
    example: 'console.log("scene setup")',
  }),
  type: z.string().nullish().meta({
    description: 'Message type: null for normal, branch for choices, event for events',
    example: 'branch',
  }),
  options: z.array(branchOptionSchema).optional().meta({
    description: 'Branch options - only for branch type messages',
  }),
  paragraphs: z.array(batchParagraphSchema).optional().meta({
    description: 'Paragraphs to create for this message',
  }),
})

// Request body
const batchCreateMessagesBodySchema = z.strictObject({
  messages: z.array(batchMessageSchema).min(1).max(1000).meta({
    description: 'Array of messages to create (max 1000)',
  }),
})

// Response schema
const batchCreateMessagesResponseSchema = z.strictObject({
  success: z.literal(true),
  created: z.number().int().meta({
    description: 'Number of messages created',
    example: 10,
  }),
  messageIds: z.array(z.string()).meta({
    description: 'IDs of created messages in order',
  }),
})

// ============================================================================
// ROUTES
// ============================================================================

const messagesBatchRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // Batch create messages with paragraphs
  fastify.post(
    '/stories/:storyId/messages/batch',
    {
      preHandler: requireAuth,
      schema: {
        description:
          'Batch create messages with their paragraphs in a single transaction. Ideal for importing large amounts of content.',
        tags: ['messages'],
        params: z.strictObject({
          storyId: z.string().meta({
            description: 'Story ID',
            example: 'clx1234567890',
          }),
        }),
        body: batchCreateMessagesBodySchema,
        response: {
          201: batchCreateMessagesResponseSchema,
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { storyId } = request.params
      const { messages } = request.body
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

      // Collect all unique scene IDs to verify ownership
      const sceneIds = [...new Set(messages.map((m) => m.sceneId))]

      // Verify all scenes exist and belong to the story
      const scenes = await prisma.scene.findMany({
        where: { id: { in: sceneIds } },
        include: {
          chapter: {
            include: {
              arc: {
                include: {
                  book: true,
                },
              },
            },
          },
        },
      })

      // Check all scenes were found and belong to this story
      const foundSceneIds = new Set(scenes.map((s) => s.id))
      for (const sceneId of sceneIds) {
        if (!foundSceneIds.has(sceneId)) {
          return reply.code(404).send({ error: `Scene not found: ${sceneId}` })
        }
      }

      // Verify all scenes belong to this story
      for (const scene of scenes) {
        if (scene.chapter.arc.book.storyId !== storyId) {
          return reply.code(400).send({ error: `Scene ${scene.id} does not belong to story ${storyId}` })
        }
      }

      // Create everything in a transaction
      const createdMessageIds: string[] = []

      await prisma.$transaction(async (tx) => {
        for (const messageData of messages) {
          // Create the message with initial revision
          const message = await tx.message.create({
            data: {
              id: messageData.id,
              sceneId: messageData.sceneId,
              sortOrder: messageData.sortOrder,
              instruction: messageData.instruction || null,
              script: messageData.script || null,
              type: messageData.type || null,
              options: messageData.options ? (messageData.options as unknown as Prisma.InputJsonValue) : undefined,
              messageRevisions: {
                create: {
                  version: 1,
                  versionType: 'initial',
                },
              },
            },
            include: {
              messageRevisions: true,
            },
          })

          const revision = message.messageRevisions[0]

          // Update message with currentMessageRevisionId
          await tx.message.update({
            where: { id: message.id },
            data: { currentMessageRevisionId: revision.id },
          })

          // Create paragraphs if provided
          if (messageData.paragraphs && messageData.paragraphs.length > 0) {
            for (let i = 0; i < messageData.paragraphs.length; i++) {
              const paraData = messageData.paragraphs[i]
              const sortOrder = paraData.sortOrder ?? i

              // Create paragraph with initial revision
              const paragraph = await tx.paragraph.create({
                data: {
                  id: paraData.id,
                  messageRevisionId: revision.id,
                  sortOrder,
                  paragraphRevisions: {
                    create: {
                      version: 1,
                      body: paraData.body,
                      contentSchema: paraData.contentSchema || null,
                      state: paraData.state || null,
                    },
                  },
                },
                include: {
                  paragraphRevisions: true,
                },
              })

              // Update paragraph with currentParagraphRevisionId
              await tx.paragraph.update({
                where: { id: paragraph.id },
                data: { currentParagraphRevisionId: paragraph.paragraphRevisions[0].id },
              })
            }
          }

          createdMessageIds.push(message.id)
        }
      })

      return reply.code(201).send({
        success: true as const,
        created: createdMessageIds.length,
        messageIds: createdMessageIds,
      })
    },
  )
}

export default messagesBatchRoutes
