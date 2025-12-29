import type { Prisma } from '@prisma/client'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { prisma } from '../../lib/prisma.js'
import { errorSchema } from '../../schemas/common.js'

// Perspective schema
const perspectiveSchema = z.enum(['FIRST', 'THIRD']).meta({
  description: 'Narrative perspective',
  example: 'THIRD',
})

// Scene response schema
const sceneSchema = z.strictObject({
  id: z.string().meta({
    description: 'Scene ID',
    example: 'clx1234567890',
  }),
  name: z.string().meta({
    description: 'Scene name/title',
    example: 'The Hero Awakens',
  }),
  summary: z.string().nullable().meta({
    description: 'Scene summary/description',
    example: 'The hero wakes up in a strange place...',
  }),
  chapterId: z.string().meta({
    description: 'Parent chapter ID',
    example: 'clx9876543210',
  }),
  sortOrder: z.number().meta({
    description: 'Sort order within chapter',
    example: 0,
  }),
  status: z.string().nullable().meta({
    description: 'Scene status: draft, needs_work, review, done',
    example: 'draft',
  }),
  includeInFull: z.number().meta({
    description: 'Include mode: 0=not included, 1=summary only, 2=full content',
    example: 1,
  }),
  perspective: perspectiveSchema.nullable().meta({
    description: 'Narrative perspective for this scene',
    example: 'THIRD',
  }),
  viewpointCharacterId: z.string().nullable().meta({
    description: 'POV character ID',
    example: 'clx111',
  }),
  activeCharacterIds: z
    .array(z.string())
    .nullable()
    .meta({
      description: 'Active character IDs in this scene',
      example: ['clx111', 'clx222'],
    }),
  activeContextItemIds: z
    .array(z.string())
    .nullable()
    .meta({
      description: 'Active context item IDs in this scene',
      example: ['clx333'],
    }),
  goal: z.string().nullable().meta({
    description: 'Scene goal for generation',
    example: 'Introduce the hero and establish the conflict',
  }),
  storyTime: z.number().nullable().meta({
    description: 'When this scene occurs in story timeline (minutes)',
    example: 1440,
  }),
  deleted: z.boolean().meta({
    description: 'Whether the scene is soft-deleted',
    example: false,
  }),
  deletedAt: z.string().nullable().meta({
    description: 'When the scene was deleted',
    example: null,
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

// Create scene request body
const createSceneBodySchema = z.strictObject({
  id: z.string().optional().meta({
    description: 'Optional client-provided ID',
    example: 'clx1234567890',
  }),
  name: z.string().min(1).max(200).meta({
    description: 'Scene name/title',
    example: 'The Hero Awakens',
  }),
  summary: z.string().optional().meta({
    description: 'Scene summary/description',
    example: 'The hero wakes up in a strange place...',
  }),
  sortOrder: z.number().int().optional().meta({
    description: 'Sort order within chapter (defaults to end)',
    example: 0,
  }),
  status: z.string().optional().meta({
    description: 'Scene status: draft, needs_work, review, done',
    example: 'draft',
  }),
  includeInFull: z.number().int().optional().meta({
    description: 'Include mode: 0=not included, 1=summary only, 2=full content',
    example: 1,
  }),
  perspective: perspectiveSchema.optional().meta({
    description: 'Narrative perspective for this scene',
    example: 'THIRD',
  }),
  viewpointCharacterId: z.string().optional().meta({
    description: 'POV character ID',
    example: 'clx111',
  }),
  activeCharacterIds: z
    .array(z.string())
    .optional()
    .meta({
      description: 'Active character IDs in this scene',
      example: ['clx111', 'clx222'],
    }),
  activeContextItemIds: z
    .array(z.string())
    .optional()
    .meta({
      description: 'Active context item IDs in this scene',
      example: ['clx333'],
    }),
  goal: z.string().optional().meta({
    description: 'Scene goal for generation',
    example: 'Introduce the hero and establish the conflict',
  }),
  storyTime: z.number().int().optional().meta({
    description: 'When this scene occurs in story timeline (minutes)',
    example: 1440,
  }),
})

// Update scene request body (all fields optional)
const updateSceneBodySchema = z.strictObject({
  name: z.string().min(1).max(200).optional().meta({
    description: 'Scene name/title',
    example: 'The Hero Awakens',
  }),
  summary: z.string().nullable().optional().meta({
    description: 'Scene summary/description',
    example: 'The hero wakes up in a strange place...',
  }),
  sortOrder: z.number().int().optional().meta({
    description: 'Sort order within chapter',
    example: 0,
  }),
  status: z.string().nullable().optional().meta({
    description: 'Scene status: draft, needs_work, review, done',
    example: 'draft',
  }),
  includeInFull: z.number().int().optional().meta({
    description: 'Include mode: 0=not included, 1=summary only, 2=full content',
    example: 1,
  }),
  perspective: perspectiveSchema.nullable().optional().meta({
    description: 'Narrative perspective for this scene',
    example: 'THIRD',
  }),
  viewpointCharacterId: z.string().nullable().optional().meta({
    description: 'POV character ID',
    example: 'clx111',
  }),
  activeCharacterIds: z
    .array(z.string())
    .nullable()
    .optional()
    .meta({
      description: 'Active character IDs in this scene',
      example: ['clx111', 'clx222'],
    }),
  activeContextItemIds: z
    .array(z.string())
    .nullable()
    .optional()
    .meta({
      description: 'Active context item IDs in this scene',
      example: ['clx333'],
    }),
  goal: z.string().nullable().optional().meta({
    description: 'Scene goal for generation',
    example: 'Introduce the hero and establish the conflict',
  }),
  storyTime: z.number().int().nullable().optional().meta({
    description: 'When this scene occurs in story timeline (minutes)',
    example: 1440,
  }),
})

// Path parameters
const chapterIdParamSchema = z.strictObject({
  chapterId: z.string().meta({
    description: 'Chapter ID',
    example: 'clx1234567890',
  }),
})

const sceneIdParamSchema = z.strictObject({
  id: z.string().meta({
    description: 'Scene ID',
    example: 'clx1234567890',
  }),
})

// Response schemas
const createSceneResponseSchema = z.strictObject({
  success: z.literal(true),
  scene: sceneSchema,
})

const listScenesResponseSchema = z.strictObject({
  scenes: z.array(sceneSchema),
})

const getSceneResponseSchema = z.strictObject({
  scene: sceneSchema,
})

const updateSceneResponseSchema = z.strictObject({
  success: z.literal(true),
  scene: sceneSchema,
})

const deleteSceneResponseSchema = z.strictObject({
  success: z.literal(true),
})

// Helper to format scene for response
function formatScene(scene: any) {
  return {
    ...scene,
    createdAt: scene.createdAt.toISOString(),
    updatedAt: scene.updatedAt.toISOString(),
  }
}

const myScenesRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // All routes require authentication
  fastify.addHook('preHandler', requireAuth)

  // POST /my/chapters/:chapterId/scenes - Create new scene
  fastify.post(
    '/chapters/:chapterId/scenes',
    {
      schema: {
        description: 'Create a new scene in a chapter',
        tags: ['my-scenes'],
        security: [{ sessionAuth: [] }],
        params: chapterIdParamSchema,
        body: createSceneBodySchema,
        response: {
          201: createSceneResponseSchema,
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
        const { chapterId } = request.params
        const {
          id,
          name,
          summary,
          sortOrder,
          perspective,
          viewpointCharacterId,
          activeCharacterIds,
          activeContextItemIds,
          goal,
          storyTime,
        } = request.body

        // Verify chapter exists and user owns the parent story
        const chapter = await prisma.chapter.findFirst({
          where: {
            id: chapterId,
            arc: {
              book: {
                story: {
                  ownerId: userId,
                },
              },
            },
          },
        })

        if (!chapter) {
          return reply.status(404).send({ error: 'Chapter not found' })
        }

        // Determine sort order if not provided
        let finalSortOrder = sortOrder
        if (finalSortOrder === undefined) {
          const maxScene = await prisma.scene.findFirst({
            where: { chapterId },
            orderBy: { sortOrder: 'desc' },
            select: { sortOrder: true },
          })
          finalSortOrder = maxScene ? maxScene.sortOrder + 1 : 0
        }

        const scene = await prisma.scene.create({
          data: {
            id, // Use client-provided ID if given
            name,
            summary: summary || null,
            chapterId,
            sortOrder: finalSortOrder,
            perspective: perspective || null,
            viewpointCharacterId: viewpointCharacterId || null,
            activeCharacterIds: (activeCharacterIds || null) as Prisma.InputJsonValue,
            activeContextItemIds: (activeContextItemIds || null) as Prisma.InputJsonValue,
            goal: goal || null,
            storyTime: storyTime || null,
          },
        })

        fastify.log.info({ sceneId: scene.id, chapterId, userId }, 'Scene created')

        return reply.status(201).send({
          success: true as const,
          scene: formatScene(scene),
        })
      } catch (error) {
        fastify.log.error({ error }, 'Failed to create scene')
        return reply.status(500).send({ error: 'Failed to create scene' })
      }
    },
  )

  // GET /my/chapters/:chapterId/scenes - List scenes in a chapter
  fastify.get(
    '/chapters/:chapterId/scenes',
    {
      schema: {
        description: 'List all scenes in a chapter',
        tags: ['my-scenes'],
        security: [{ sessionAuth: [] }],
        params: chapterIdParamSchema,
        response: {
          200: listScenesResponseSchema,
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id
        const { chapterId } = request.params

        // Verify chapter exists and user owns the parent story
        const chapter = await prisma.chapter.findFirst({
          where: {
            id: chapterId,
            arc: {
              book: {
                story: {
                  ownerId: userId,
                },
              },
            },
          },
        })

        if (!chapter) {
          return reply.status(404).send({ error: 'Chapter not found' })
        }

        // Get scenes (filter out deleted)
        const scenes = await prisma.scene.findMany({
          where: { chapterId, deleted: false },
          orderBy: { sortOrder: 'asc' },
        })

        return {
          scenes: scenes.map(formatScene),
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to list scenes')
        return reply.status(500).send({ error: 'Failed to list scenes' })
      }
    },
  )

  // GET /my/scenes/:id - Get single scene
  fastify.get(
    '/scenes/:id',
    {
      schema: {
        description: 'Get a single scene by ID (must own the parent story)',
        tags: ['my-scenes'],
        security: [{ sessionAuth: [] }],
        params: sceneIdParamSchema,
        response: {
          200: getSceneResponseSchema,
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

        const scene = await prisma.scene.findFirst({
          where: {
            id,
            deleted: false,
            chapter: {
              arc: {
                book: {
                  story: {
                    ownerId: userId,
                  },
                },
              },
            },
          },
        })

        if (!scene) {
          return reply.status(404).send({ error: 'Scene not found' })
        }

        return {
          scene: formatScene(scene),
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get scene')
        return reply.status(500).send({ error: 'Failed to get scene' })
      }
    },
  )

  // PATCH /my/scenes/:id - Update scene
  fastify.patch(
    '/scenes/:id',
    {
      schema: {
        description: 'Update a scene (must own the parent story)',
        tags: ['my-scenes'],
        security: [{ sessionAuth: [] }],
        params: sceneIdParamSchema,
        body: updateSceneBodySchema,
        response: {
          200: updateSceneResponseSchema,
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

        // Check if scene exists and user owns the parent story
        const existingScene = await prisma.scene.findFirst({
          where: {
            id,
            chapter: {
              arc: {
                book: {
                  story: {
                    ownerId: userId,
                  },
                },
              },
            },
          },
        })

        if (!existingScene) {
          return reply.status(404).send({ error: 'Scene not found' })
        }

        // Update scene
        const scene = await prisma.scene.update({
          where: { id },
          data: updates as Prisma.SceneUpdateInput,
        })

        fastify.log.info({ sceneId: scene.id, userId }, 'Scene updated')

        return {
          success: true as const,
          scene: formatScene(scene),
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to update scene')
        return reply.status(500).send({ error: 'Failed to update scene' })
      }
    },
  )

  // DELETE /my/scenes/:id - Delete scene
  fastify.delete(
    '/scenes/:id',
    {
      schema: {
        description:
          'Delete a scene. By default performs soft delete; use ?permanent=true for hard delete.',
        tags: ['my-scenes'],
        security: [{ sessionAuth: [] }],
        params: sceneIdParamSchema,
        querystring: z.strictObject({
          permanent: z
            .enum(['true', 'false'])
            .optional()
            .meta({
              description: 'If true, permanently delete (no recovery possible)',
              example: 'false',
            }),
        }),
        response: {
          200: deleteSceneResponseSchema,
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
        const permanent = request.query.permanent === 'true'

        // Check if scene exists and user owns the parent story
        const existingScene = await prisma.scene.findFirst({
          where: {
            id,
            chapter: {
              arc: {
                book: {
                  story: {
                    ownerId: userId,
                  },
                },
              },
            },
          },
        })

        if (!existingScene) {
          return reply.status(404).send({ error: 'Scene not found' })
        }

        if (permanent) {
          // Hard delete - cascade will handle messages/paragraphs
          await prisma.scene.delete({
            where: { id },
          })
          fastify.log.info({ sceneId: id, userId }, 'Scene permanently deleted')
        } else {
          // Soft delete - mark scene and its messages as deleted
          const now = new Date()
          await prisma.$transaction([
            prisma.scene.update({
              where: { id },
              data: { deleted: true, deletedAt: now },
            }),
            prisma.message.updateMany({
              where: { sceneId: id },
              data: { deleted: true },
            }),
          ])
          fastify.log.info({ sceneId: id, userId }, 'Scene soft deleted')
        }

        return {
          success: true as const,
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to delete scene')
        return reply.status(500).send({ error: 'Failed to delete scene' })
      }
    },
  )
}

export default myScenesRoutes
