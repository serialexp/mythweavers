import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { prisma } from '../../lib/prisma.js'
import { transformCreatedAt } from '../../lib/transform-dates.js'
import { errorSchema } from '../../schemas/common.js'
import { inventoryActionSchema, plotPointActionSchema } from '../../schemas/paragraph.js'

// ============================================================================
// SCHEMAS
// ============================================================================

const paragraphRevisionSchema = z.strictObject({
  id: z.string().meta({ example: 'clx1234567890' }),
  paragraphId: z.string().meta({ example: 'clx1234567890' }),
  body: z.string().meta({ example: 'The hero awakened to find the world transformed.' }),
  contentSchema: z.string().nullable().meta({ example: '{"type":"doc","content":[...]}' }),
  version: z.number().int().meta({ example: 1 }),
  state: z.enum(['AI', 'DRAFT', 'REVISE', 'FINAL', 'SDT']).nullable().meta({ example: 'DRAFT' }),
  plotPointActions: z
    .array(plotPointActionSchema)
    .nullable()
    .meta({
      description: 'Array of plot point actions',
      example: [{ plot_point_id: 'clx123', action: 'introduce' }],
    }),
  inventoryActions: z
    .array(inventoryActionSchema)
    .nullable()
    .meta({
      description: 'Array of inventory actions',
      example: [{ type: 'add', item_name: 'Magic Sword', item_amount: 1 }],
    }),
  createdAt: z.string().datetime().meta({ example: '2025-12-06T12:00:00.000Z' }),
})

const listParagraphRevisionsResponseSchema = z.strictObject({
  revisions: z.array(paragraphRevisionSchema),
})

// ============================================================================
// ROUTES
// ============================================================================

const paragraphRevisionRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // List all revisions for a paragraph
  fastify.get(
    '/paragraphs/:paragraphId/revisions',
    {
      preHandler: requireAuth,
      schema: {
        description: 'List all ParagraphRevisions for a paragraph (ordered by version DESC)',
        tags: ['paragraph-revisions'],
        params: z.strictObject({
          paragraphId: z.string().meta({
            description: 'Paragraph ID',
            example: 'clx1234567890',
          }),
        }),
        response: {
          200: listParagraphRevisionsResponseSchema,
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { paragraphId } = request.params
      const userId = request.user!.id

      // Verify paragraph exists and user owns it
      const paragraph = await prisma.paragraph.findUnique({
        where: { id: paragraphId },
        include: {
          messageRevision: {
            include: {
              message: {
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
              },
            },
          },
        },
      })

      if (!paragraph) {
        return reply.code(404).send({ error: 'Paragraph not found' })
      }

      if (paragraph.messageRevision.message.scene.chapter.arc.book.story.ownerId !== userId) {
        return reply.code(404).send({ error: 'Paragraph not found' })
      }

      const revisions = await prisma.paragraphRevision.findMany({
        where: { paragraphId },
        orderBy: { version: 'desc' },
      })

      return { revisions: revisions.map(transformCreatedAt) }
    },
  )
}

export default paragraphRevisionRoutes
