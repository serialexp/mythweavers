import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { prisma } from '../../lib/prisma.js'
import { transformCreatedAt } from '../../lib/transform-dates.js'
import { errorSchema } from '../../schemas/common.js'

// ============================================================================
// SCHEMAS
// ============================================================================

const messageRevisionSchema = z.strictObject({
  id: z.string().meta({ example: 'clx1234567890' }),
  messageId: z.string().meta({ example: 'clx1234567890' }),
  version: z.number().int().meta({ example: 1 }),
  versionType: z
    .enum(['initial', 'regeneration', 'edit', 'rewrite', 'cli_edit', 'auto'])
    .meta({ example: 'initial', description: 'Type of revision' }),
  model: z.string().nullable().meta({ example: 'claude-sonnet-4.5' }),
  tokensPerSecond: z.number().nullable().meta({ example: 42.5 }),
  totalTokens: z.number().int().nullable().meta({ example: 1500 }),
  promptTokens: z.number().int().nullable().meta({ example: 800 }),
  cacheCreationTokens: z.number().int().nullable().meta({ example: 200 }),
  cacheReadTokens: z.number().int().nullable().meta({ example: 500 }),
  think: z.string().nullable().meta({ example: 'The scene should establish...' }),
  showThink: z.boolean().meta({ example: false }),
  createdAt: z.string().datetime().meta({ example: '2025-12-06T12:00:00.000Z' }),
  // Combined paragraph content for display
  content: z.string().meta({ example: 'The story content...', description: 'Combined text from all paragraphs' }),
})

const listMessageRevisionsResponseSchema = z.strictObject({
  revisions: z.array(messageRevisionSchema),
})

// Type for the expected versionType enum values
type VersionType = 'initial' | 'regeneration' | 'edit' | 'rewrite' | 'cli_edit' | 'auto'

// Helper to transform message revision with properly typed versionType
function transformMessageRevision<T extends { versionType: string }>(
  revision: T,
): Omit<T, 'versionType'> & { versionType: VersionType } {
  return {
    ...revision,
    versionType: revision.versionType as VersionType,
  }
}

// ============================================================================
// ROUTES
// ============================================================================

const messageRevisionRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // List all revisions for a message
  fastify.get(
    '/messages/:messageId/revisions',
    {
      preHandler: requireAuth,
      schema: {
        description: 'List all MessageRevisions for a message (ordered by version DESC)',
        tags: ['message-revisions'],
        params: z.strictObject({
          messageId: z.string().meta({
            description: 'Message ID',
            example: 'clx1234567890',
          }),
        }),
        response: {
          200: listMessageRevisionsResponseSchema,
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { messageId } = request.params
      const userId = request.user!.id

      // Verify message exists and user owns it
      const message = await prisma.message.findUnique({
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

      const revisions = await prisma.messageRevision.findMany({
        where: { messageId },
        orderBy: { version: 'desc' },
        include: {
          paragraphs: {
            orderBy: { sortOrder: 'asc' },
            include: {
              currentParagraphRevision: true,
            },
          },
        },
      })

      // Transform revisions and combine paragraph content
      const transformedRevisions = revisions.map((r) => {
        // Combine paragraph bodies into content
        const content = r.paragraphs
          .map((p) => p.currentParagraphRevision?.body ?? '')
          .filter((body) => body.length > 0)
          .join('\n\n')

        const { paragraphs, ...revisionData } = r
        return {
          ...transformMessageRevision(transformCreatedAt(revisionData)),
          content,
        }
      })

      return { revisions: transformedRevisions }
    },
  )

  // Regenerate message (create new MessageRevision)
  fastify.post(
    '/messages/:id/regenerate',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Regenerate message content (creates new MessageRevision with incremented version)',
        tags: ['message-revisions'],
        params: z.strictObject({
          id: z.string().meta({
            description: 'Message ID',
            example: 'clx1234567890',
          }),
        }),
        body: z.strictObject({
          model: z.string().optional().meta({
            description: 'LLM model used for generation',
            example: 'claude-sonnet-4.5',
          }),
          tokensPerSecond: z.number().optional().meta({
            description: 'Generation speed',
            example: 42.5,
          }),
          totalTokens: z.number().int().optional().meta({
            description: 'Total tokens used',
            example: 1500,
          }),
          promptTokens: z.number().int().optional().meta({
            description: 'Prompt tokens',
            example: 800,
          }),
          cacheCreationTokens: z.number().int().optional().meta({
            description: 'Cache creation tokens',
            example: 200,
          }),
          cacheReadTokens: z.number().int().optional().meta({
            description: 'Cache read tokens',
            example: 500,
          }),
          think: z.string().optional().meta({
            description: 'AI thinking/reasoning process',
            example: 'The scene should establish...',
          }),
          showThink: z.boolean().optional().meta({
            description: 'Whether to show thinking to user',
            example: false,
          }),
        }),
        response: {
          201: z.strictObject({
            success: z.literal(true),
            revision: messageRevisionSchema,
          }),
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
          messageRevisions: {
            orderBy: { version: 'desc' },
            take: 1,
          },
        },
      })

      if (!message) {
        return reply.code(404).send({ error: 'Message not found' })
      }

      if (message.scene.chapter.arc.book.story.ownerId !== userId) {
        return reply.code(404).send({ error: 'Message not found' })
      }

      // Get next version number
      const nextVersion = message.messageRevisions.length > 0 ? message.messageRevisions[0].version + 1 : 1

      // Create new MessageRevision
      const revision = await prisma.messageRevision.create({
        data: {
          messageId: id,
          version: nextVersion,
          versionType: 'regeneration',
          model: request.body.model || null,
          tokensPerSecond: request.body.tokensPerSecond || null,
          totalTokens: request.body.totalTokens || null,
          promptTokens: request.body.promptTokens || null,
          cacheCreationTokens: request.body.cacheCreationTokens || null,
          cacheReadTokens: request.body.cacheReadTokens || null,
          think: request.body.think || null,
          showThink: request.body.showThink ?? false,
        },
      })

      // Update message's currentMessageRevisionId
      await prisma.message.update({
        where: { id },
        data: {
          currentMessageRevisionId: revision.id,
        },
      })

      return reply.code(201).send({
        success: true as const,
        revision: {
          ...transformMessageRevision(transformCreatedAt(revision)),
          content: '', // New revision starts with no paragraphs
        },
      })
    },
  )
}

export default messageRevisionRoutes
