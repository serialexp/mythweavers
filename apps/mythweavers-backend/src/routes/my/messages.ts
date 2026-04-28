import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import type { JsonValue } from '@prisma/client/runtime/library'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { promoteFileToPublic } from '../../lib/file-storage.js'
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

// Background / audio file shapes exposed on message responses (subset of File)
type FileSummary = { id: string; path: string } | null

// Helper to transform message from Prisma (dates + options type cast + optional backgroundFile / audioFile).
// The return shape is intentionally untyped against T's fields beyond the ones we touch — the
// surrounding route typing (via Zod response schemas) covers the public contract.
function transformMessage<
  T extends {
    createdAt: Date
    updatedAt: Date
    options: JsonValue | null
    backgroundFile?: { id: string; path: string } | null
    audioFile?: { id: string; path: string } | null
  },
>(obj: T) {
  const { backgroundFile, audioFile, ...rest } = obj as T & {
    backgroundFile?: { id: string; path: string } | null
    audioFile?: { id: string; path: string } | null
  }
  return {
    ...rest,
    createdAt: obj.createdAt.toISOString(),
    updatedAt: obj.updatedAt.toISOString(),
    options: obj.options as BranchOption[] | null,
    backgroundFile: (backgroundFile ?? null) as FileSummary,
    audioFile: (audioFile ?? null) as FileSummary,
  }
}

// Reusable include that loads the background + audio file thumbnail data alongside a message.
const messageWithBackgroundFile = {
  backgroundFile: { select: { id: true, path: true } },
  audioFile: { select: { id: true, path: true } },
} as const

/**
 * Verify that a File is owned by the requesting user and is an image.
 *
 * `File.storyId` is treated as a hint about the upload origin, not a hard
 * scope — users routinely reuse the same image across stories, and the
 * dedup-by-sha256 branch in the upload endpoint pins storyId to whichever
 * story the file was first uploaded under. Cross-story access within a
 * single account is allowed; cross-user access is rejected on ownership.
 *
 * Returns null on success, or an error string suitable for a 400 response.
 */
async function validateBackgroundFile(
  fileId: string,
  userId: number,
  _storyId: string | null,
): Promise<string | null> {
  const file = await prisma.file.findUnique({
    where: { id: fileId },
    select: { id: true, ownerId: true, mimeType: true },
  })
  if (!file) return 'Background file not found'
  if (file.ownerId !== userId) return 'Background file not owned by user'
  if (!file.mimeType.startsWith('image/')) return 'Background file must be an image'
  return null
}

/**
 * Same ownership check as validateBackgroundFile, but enforces an audio
 * mime-type. Used when attaching an audio embed to an audio-type message.
 */
async function validateAudioFile(
  fileId: string,
  userId: number,
  _storyId: string | null,
): Promise<string | null> {
  const file = await prisma.file.findUnique({
    where: { id: fileId },
    select: { id: true, ownerId: true, mimeType: true },
  })
  if (!file) return 'Audio file not found'
  if (file.ownerId !== userId) return 'Audio file not owned by user'
  if (!file.mimeType.startsWith('audio/')) return 'Audio file must be an audio file'
  return null
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
  isQuery: z.boolean().meta({ example: false, description: 'True for meta/query messages not visible to content generation' }),
  type: z
    .string()
    .nullable()
    .meta({ example: 'branch', description: 'Message type: null for normal, branch for choices, event for events, background for reader background-image changes, audio for inline reader audio embeds' }),
  options: z
    .array(branchOptionSchema)
    .nullable()
    .meta({ description: 'Branch options - only present for branch type messages' }),
  backgroundFileId: z.string().nullable().meta({
    description: 'File ID of the background image — only present for background type messages',
    example: 'clx1234567890',
  }),
  backgroundFile: z
    .strictObject({
      id: z.string().meta({ example: 'clx1234567890' }),
      path: z.string().meta({ example: '/files/abc123.jpg' }),
    })
    .nullable()
    .meta({ description: 'Hydrated background image file (id + URL path) — only for background type messages' }),
  audioFileId: z.string().nullable().meta({
    description: 'File ID of the audio embed — only present for audio type messages',
    example: 'clx1234567890',
  }),
  audioFile: z
    .strictObject({
      id: z.string().meta({ example: 'clx1234567890' }),
      path: z.string().meta({ example: '/files/abc123.mp3' }),
    })
    .nullable()
    .meta({ description: 'Hydrated audio file (id + URL path) — only for audio type messages' }),
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
  isQuery: z.boolean().optional().meta({
    description: 'True for meta/query messages not visible to content generation',
    example: false,
  }),
  type: z.string().optional().meta({
    description: 'Message type: null for normal, branch for choices, event for events, background for reader background-image changes',
    example: 'branch',
  }),
  options: z.array(branchOptionSchema).optional().meta({
    description: 'Branch options - only for branch type messages',
  }),
  backgroundFileId: z.string().optional().meta({
    description: 'File ID for the background image — required when type is "background"',
    example: 'clx1234567890',
  }),
  audioFileId: z.string().optional().meta({
    description: 'File ID for the audio embed — required when type is "audio"',
    example: 'clx1234567890',
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
  nodeId: z.string().optional().meta({
    description: 'Move message to a different scene (sceneId)',
  }),
  isQuery: z.boolean().optional().meta({
    description: 'True for meta/query messages not visible to content generation',
  }),
  type: z.string().nullable().optional().meta({
    description: 'Message type: null for normal, branch for choices, event for events',
  }),
  options: z.array(branchOptionSchema).nullable().optional().meta({
    description: 'Branch options - only for branch type messages',
  }),
  backgroundFileId: z.string().nullable().optional().meta({
    description: 'File ID for the background image — set/replace for background type messages, null to clear',
  }),
  audioFileId: z.string().nullable().optional().meta({
    description: 'File ID for the audio embed — set/replace for audio type messages, null to clear',
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

      // Background-message validation: require & verify the file when type === 'background'.
      const storyId = scene.chapter.arc.book.story.id
      if (request.body.type === 'background') {
        if (!request.body.backgroundFileId) {
          return reply.code(400).send({ error: 'backgroundFileId is required for type=background' })
        }
        const err = await validateBackgroundFile(request.body.backgroundFileId, userId, storyId)
        if (err) return reply.code(400).send({ error: err })
        // Inline backgrounds are surfaced by the public reader, so the file
        // needs to be publicly fetchable. One-way promotion — see
        // promoteFileToPublic for rationale.
        await promoteFileToPublic(request.body.backgroundFileId)
      } else if (request.body.backgroundFileId !== undefined) {
        return reply.code(400).send({ error: 'backgroundFileId only allowed when type=background' })
      }

      // Audio-message validation: parallel rules for type === 'audio'.
      if (request.body.type === 'audio') {
        if (!request.body.audioFileId) {
          return reply.code(400).send({ error: 'audioFileId is required for type=audio' })
        }
        const err = await validateAudioFile(request.body.audioFileId, userId, storyId)
        if (err) return reply.code(400).send({ error: err })
      } else if (request.body.audioFileId !== undefined) {
        return reply.code(400).send({ error: 'audioFileId only allowed when type=audio' })
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
          isQuery: request.body.isQuery ?? false,
          type: request.body.type || null,
          options: toJsonInput(request.body.options), // undefined if not provided, array if provided
          backgroundFileId: request.body.backgroundFileId ?? null,
          audioFileId: request.body.audioFileId ?? null,
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
        include: messageWithBackgroundFile,
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
        include: messageWithBackgroundFile,
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
          ...messageWithBackgroundFile,
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

      // Compute the resulting type after this patch (body wins, otherwise existing).
      // Only validate the background file when the patch actually sets/changes it
      // (request.body.backgroundFileId !== undefined). null is "clear", a string is "set".
      const storyId = message.scene.chapter.arc.book.story.id
      const resultingType = request.body.type !== undefined ? request.body.type : message.type
      if (request.body.backgroundFileId !== undefined && request.body.backgroundFileId !== null) {
        if (resultingType !== 'background') {
          return reply.code(400).send({ error: 'backgroundFileId only allowed when type=background' })
        }
        const err = await validateBackgroundFile(request.body.backgroundFileId, userId, storyId)
        if (err) return reply.code(400).send({ error: err })
        // Inline backgrounds are surfaced by the public reader — promote so
        // the file can be fetched without auth. See promoteFileToPublic.
        await promoteFileToPublic(request.body.backgroundFileId)
      }
      // Same rule for audio: validate only when the patch sets a non-null id.
      if (request.body.audioFileId !== undefined && request.body.audioFileId !== null) {
        if (resultingType !== 'audio') {
          return reply.code(400).send({ error: 'audioFileId only allowed when type=audio' })
        }
        const err = await validateAudioFile(request.body.audioFileId, userId, storyId)
        if (err) return reply.code(400).send({ error: err })
      }

      // Update message
      const updated = await prisma.message.update({
        where: { id },
        data: {
          instruction: request.body.instruction,
          script: request.body.script,
          sortOrder: request.body.sortOrder,
          sceneId: request.body.nodeId, // nodeId on API = sceneId in database
          isQuery: request.body.isQuery,
          type: request.body.type,
          options: toJsonInput(request.body.options),
          backgroundFileId: request.body.backgroundFileId,
          audioFileId: request.body.audioFileId,
          deleted: request.body.deleted,
        },
        include: messageWithBackgroundFile,
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
