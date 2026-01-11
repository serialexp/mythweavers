import type { Prisma } from '@prisma/client'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { createParagraphsBulk } from '../../lib/paragraphHelpers.js'
import { prisma } from '../../lib/prisma.js'
import { transformDates } from '../../lib/transform-dates.js'
import { errorSchema, successSchema } from '../../schemas/common.js'
import { inventoryActionSchema, paragraphScriptSchema, plotPointActionSchema } from '../../schemas/paragraph.js'

// ============================================================================
// SCHEMAS
// ============================================================================

// Paragraph schemas
const paragraphSchema = z.strictObject({
  id: z.string().meta({ example: 'clx1234567890' }),
  messageRevisionId: z.string().meta({ example: 'clx1234567890' }),
  sortOrder: z.number().int().meta({ example: 0 }),
  currentParagraphRevisionId: z.string().nullable().meta({ example: 'clx1234567890' }),
  createdAt: z.string().datetime().meta({ example: '2025-12-06T12:00:00.000Z' }),
  updatedAt: z.string().datetime().meta({ example: '2025-12-06T12:00:00.000Z' }),
})

// Create paragraph body
const createParagraphBodySchema = z.strictObject({
  id: z.string().optional().meta({
    description: 'Optional client-provided ID (auto-generated if not provided)',
    example: 'clx1234567890',
  }),
  body: z.string().min(1).meta({
    description: 'Paragraph content text (plain text)',
    example: 'The hero awakened to find the world transformed.',
  }),
  contentSchema: z.string().nullable().optional().meta({
    description: 'ProseMirror JSON structure for rich text (optional)',
    example: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hello"}]}]}',
  }),
  state: z.enum(['AI', 'DRAFT', 'REVISE', 'FINAL', 'SDT']).optional().meta({
    description: 'Paragraph state (AI, DRAFT, REVISE, FINAL, SDT)',
    example: 'DRAFT',
  }),
  plotPointActions: z
    .array(plotPointActionSchema)
    .optional()
    .meta({
      description: 'Array of plot point actions',
      example: [{ plot_point_id: 'clx123', action: 'introduce' }],
    }),
  inventoryActions: z
    .array(inventoryActionSchema)
    .optional()
    .meta({
      description: 'Array of inventory actions (deprecated, use script instead)',
      example: [{ type: 'add', item_name: 'Magic Sword', item_amount: 1 }],
    }),
  script: paragraphScriptSchema,
  sortOrder: z.number().int().min(0).optional().meta({
    description: 'Display order (auto-increments if not provided)',
    example: 0,
  }),
})

// Update paragraph body (creates new ParagraphRevision)
const updateParagraphBodySchema = z.strictObject({
  body: z.string().optional().meta({
    description: 'Paragraph content text (creates new revision). Empty string allowed as prelude to deletion.',
    example: 'The hero awakened to find the world completely transformed.',
  }),
  contentSchema: z.string().nullable().optional().meta({
    description: 'ProseMirror JSON structure for rich text (optional)',
    example: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hello"}]}]}',
  }),
  state: z.enum(['AI', 'DRAFT', 'REVISE', 'FINAL', 'SDT']).optional().meta({
    description: 'Paragraph state',
  }),
  plotPointActions: z.array(plotPointActionSchema).optional().meta({
    description: 'Array of plot point actions (deprecated, use script instead)',
  }),
  inventoryActions: z.array(inventoryActionSchema).optional().meta({
    description: 'Array of inventory actions (deprecated, use script instead)',
  }),
  script: paragraphScriptSchema,
  sortOrder: z.number().int().min(0).optional().meta({
    description: 'Display order',
  }),
})

// Response schemas
const createParagraphResponseSchema = z.strictObject({
  success: z.literal(true),
  paragraph: paragraphSchema,
})

const getParagraphResponseSchema = z.strictObject({
  paragraph: paragraphSchema,
})

const listParagraphsResponseSchema = z.strictObject({
  paragraphs: z.array(paragraphSchema),
})

// ============================================================================
// ROUTES
// ============================================================================

const paragraphRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // Create paragraph in message revision
  fastify.post(
    '/message-revisions/:revisionId/paragraphs',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Create a new paragraph in a message revision (auto-creates initial ParagraphRevision v1)',
        tags: ['paragraphs'],
        params: z.strictObject({
          revisionId: z.string().meta({
            description: 'MessageRevision ID',
            example: 'clx1234567890',
          }),
        }),
        body: createParagraphBodySchema,
        response: {
          201: createParagraphResponseSchema,
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { revisionId } = request.params
      const userId = request.user!.id

      // Verify message revision exists and user owns it
      const messageRevision = await prisma.messageRevision.findUnique({
        where: { id: revisionId },
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
      })

      if (!messageRevision) {
        return reply.code(404).send({ error: 'Message revision not found' })
      }

      if (messageRevision.message.scene.chapter.arc.book.story.ownerId !== userId) {
        return reply.code(404).send({ error: 'Message revision not found' })
      }

      // Auto-increment sortOrder if not provided
      let sortOrder = request.body.sortOrder
      if (sortOrder === undefined) {
        const maxOrder = await prisma.paragraph.findFirst({
          where: { messageRevisionId: revisionId },
          orderBy: { sortOrder: 'desc' },
          select: { sortOrder: true },
        })
        sortOrder = maxOrder ? maxOrder.sortOrder + 1 : 0
      }

      // Create paragraph with initial ParagraphRevision (v1)
      const paragraph = await prisma.paragraph.create({
        data: {
          id: request.body.id, // Use client-provided ID if given
          messageRevisionId: revisionId,
          sortOrder,
          paragraphRevisions: {
            create: {
              body: request.body.body,
              contentSchema: request.body.contentSchema || null,
              version: 1,
              state: request.body.state || null,
              script: request.body.script || null,
              plotPointActions: (request.body.plotPointActions || null) as Prisma.InputJsonValue,
              inventoryActions: (request.body.inventoryActions || null) as Prisma.InputJsonValue,
            },
          },
        },
        include: {
          paragraphRevisions: true,
        },
      }) as Prisma.ParagraphGetPayload<{ include: { paragraphRevisions: true } }>

      // Set currentParagraphRevisionId to the first revision
      const updatedParagraph = await prisma.paragraph.update({
        where: { id: paragraph.id },
        data: {
          currentParagraphRevisionId: paragraph.paragraphRevisions[0].id,
        },
      })

      return reply.code(201).send({
        success: true as const,
        paragraph: transformDates(updatedParagraph),
      })
    },
  )

  // List paragraphs in a message revision
  fastify.get(
    '/message-revisions/:revisionId/paragraphs',
    {
      preHandler: requireAuth,
      schema: {
        description: 'List all paragraphs in a message revision (ordered by sortOrder)',
        tags: ['paragraphs'],
        params: z.strictObject({
          revisionId: z.string().meta({
            description: 'MessageRevision ID',
            example: 'clx1234567890',
          }),
        }),
        response: {
          200: listParagraphsResponseSchema,
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { revisionId } = request.params
      const userId = request.user!.id

      // Verify message revision exists and user owns it
      const messageRevision = await prisma.messageRevision.findUnique({
        where: { id: revisionId },
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
      })

      if (!messageRevision) {
        return reply.code(404).send({ error: 'Message revision not found' })
      }

      if (messageRevision.message.scene.chapter.arc.book.story.ownerId !== userId) {
        return reply.code(404).send({ error: 'Message revision not found' })
      }

      const paragraphs = await prisma.paragraph.findMany({
        where: { messageRevisionId: revisionId },
        orderBy: { sortOrder: 'asc' },
      })

      return { paragraphs: paragraphs.map(transformDates) }
    },
  )

  // Get single paragraph
  fastify.get(
    '/paragraphs/:id',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Get a single paragraph by ID',
        tags: ['paragraphs'],
        params: z.strictObject({
          id: z.string().meta({
            description: 'Paragraph ID',
            example: 'clx1234567890',
          }),
        }),
        response: {
          200: getParagraphResponseSchema,
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params
      const userId = request.user!.id

      const paragraph = await prisma.paragraph.findUnique({
        where: { id },
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

      // Return without nested data
      const { messageRevision, ...paragraphData } = paragraph

      return { paragraph: transformDates(paragraphData) }
    },
  )

  // Update paragraph (creates new ParagraphRevision if body changes)
  fastify.patch(
    '/paragraphs/:id',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Update paragraph (if body changes, creates new ParagraphRevision)',
        tags: ['paragraphs'],
        params: z.strictObject({
          id: z.string().meta({
            description: 'Paragraph ID',
            example: 'clx1234567890',
          }),
        }),
        body: updateParagraphBodySchema,
        response: {
          200: z.strictObject({
            success: z.literal(true),
            paragraph: paragraphSchema,
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

      // Verify paragraph exists and user owns it
      const paragraph = await prisma.paragraph.findUnique({
        where: { id },
        include: {
          paragraphRevisions: {
            orderBy: { version: 'desc' },
            take: 1,
          },
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

      // If body, contentSchema, or script is being updated, create new ParagraphRevision
      if (request.body.body !== undefined || request.body.contentSchema !== undefined || request.body.script !== undefined) {
        const nextVersion = paragraph.paragraphRevisions.length > 0 ? paragraph.paragraphRevisions[0].version + 1 : 1

        const currentRevision = paragraph.paragraphRevisions[0]
        const newRevision = await prisma.paragraphRevision.create({
          data: {
            paragraphId: id,
            version: nextVersion,
            body: request.body.body ?? currentRevision?.body ?? '',
            contentSchema:
              request.body.contentSchema !== undefined
                ? request.body.contentSchema
                : (currentRevision?.contentSchema ?? null),
            state: request.body.state ?? currentRevision?.state ?? null,
            script: request.body.script !== undefined ? (request.body.script ?? null) : (currentRevision?.script ?? null),
            plotPointActions: (request.body.plotPointActions ??
              currentRevision?.plotPointActions ??
              null) as Prisma.InputJsonValue,
            inventoryActions: (request.body.inventoryActions ??
              currentRevision?.inventoryActions ??
              null) as Prisma.InputJsonValue,
          },
        })

        // Update currentParagraphRevisionId
        await prisma.paragraph.update({
          where: { id },
          data: {
            currentParagraphRevisionId: newRevision.id,
          },
        })
      }

      // Update sortOrder if provided
      const updated = await prisma.paragraph.update({
        where: { id },
        data: {
          sortOrder: request.body.sortOrder,
        },
      })

      return {
        success: true as const,
        paragraph: transformDates(updated),
      }
    },
  )

  // Delete paragraph
  fastify.delete(
    '/paragraphs/:id',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Delete a paragraph (cascades to all ParagraphRevisions)',
        tags: ['paragraphs'],
        params: z.strictObject({
          id: z.string().meta({
            description: 'Paragraph ID',
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

      // Verify paragraph exists and user owns it
      const paragraph = await prisma.paragraph.findUnique({
        where: { id },
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

      await prisma.paragraph.delete({
        where: { id },
      })

      return { success: true as const }
    },
  )

  // Bulk create paragraphs in a message revision
  fastify.post(
    '/message-revisions/:revisionId/paragraphs/batch',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Create multiple paragraphs in a message revision in a single transaction',
        tags: ['paragraphs'],
        params: z.strictObject({
          revisionId: z.string().meta({
            description: 'MessageRevision ID',
            example: 'clx1234567890',
          }),
        }),
        body: z.strictObject({
          paragraphs: z.array(createParagraphBodySchema).meta({
            description: 'Array of paragraphs to create',
          }),
        }),
        response: {
          201: z.strictObject({
            success: z.literal(true),
            created: z.number().int().meta({ description: 'Number of paragraphs created' }),
            paragraphIds: z.array(z.string()).meta({ description: 'IDs of created paragraphs' }),
          }),
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { revisionId } = request.params
      const userId = request.user!.id

      // Verify message revision exists and user owns it
      const messageRevision = await prisma.messageRevision.findUnique({
        where: { id: revisionId },
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
      })

      if (!messageRevision) {
        return reply.code(404).send({ error: 'Message revision not found' })
      }

      if (messageRevision.message.scene.chapter.arc.book.story.ownerId !== userId) {
        return reply.code(404).send({ error: 'Message revision not found' })
      }

      // Create all paragraphs in a transaction using shared helper
      const paragraphIds = await prisma.$transaction(async (tx) => {
        return createParagraphsBulk(tx, revisionId, request.body.paragraphs)
      })

      return reply.code(201).send({
        success: true as const,
        created: paragraphIds.length,
        paragraphIds,
      })
    },
  )
}

export default paragraphRoutes
