import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { prisma } from '../../lib/prisma.js'
import { transformDates } from '../../lib/transform-dates.js'
import { errorSchema, successSchema } from '../../schemas/common.js'

// ============================================================================
// SCHEMAS
// ============================================================================

const tagSchema = z.strictObject({
  id: z.string().meta({ example: 'clx1234567890' }),
  name: z.string().meta({ example: 'fantasy' }),
  createdAt: z.string().datetime().meta({ example: '2025-12-06T12:00:00.000Z' }),
  updatedAt: z.string().datetime().meta({ example: '2025-12-06T12:00:00.000Z' }),
})

const storyTagSchema = z.strictObject({
  id: z.string().meta({ example: 'clx1234567890' }),
  storyId: z.string().meta({ example: 'clx1234567890' }),
  tagId: z.string().meta({ example: 'clx1234567890' }),
  tag: tagSchema,
  createdAt: z.string().datetime().meta({ example: '2025-12-06T12:00:00.000Z' }),
  updatedAt: z.string().datetime().meta({ example: '2025-12-06T12:00:00.000Z' }),
})

const addTagBodySchema = z
  .strictObject({
    tagId: z.string().optional().meta({
      description: 'Existing tag ID (either tagId or tagName must be provided)',
      example: 'clx1234567890',
    }),
    tagName: z.string().optional().meta({
      description: "Tag name (creates new tag if doesn't exist)",
      example: 'fantasy',
    }),
  })
  .refine((data) => data.tagId || data.tagName, {
    message: 'Either tagId or tagName must be provided',
  })

const listStoryTagsResponseSchema = z.strictObject({
  tags: z.array(tagSchema),
})

const addStoryTagResponseSchema = z.strictObject({
  success: z.literal(true),
  storyTag: storyTagSchema,
  tagCreated: z.boolean().meta({
    description: 'Whether the tag was newly created',
    example: false,
  }),
})

// ============================================================================
// ROUTES
// ============================================================================

const storyTagRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // List tags on a story
  fastify.get(
    '/stories/:storyId/tags',
    {
      preHandler: requireAuth,
      schema: {
        description: 'List all tags on a story',
        tags: ['story-tags'],
        params: z.strictObject({
          storyId: z.string().meta({
            description: 'Story ID',
            example: 'clx1234567890',
          }),
        }),
        response: {
          200: listStoryTagsResponseSchema,
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { storyId } = request.params
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

      // Get story tags
      const storyTags = await prisma.storyTag.findMany({
        where: { storyId },
        include: {
          tag: true,
        },
        orderBy: {
          tag: {
            name: 'asc',
          },
        },
      })

      // Return just the tags (not the StoryTag join records)
      const tags = storyTags.map((st) => transformDates(st.tag))

      return { tags }
    },
  )

  // Add tag to story
  fastify.post(
    '/stories/:storyId/tags',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Add a tag to a story (by tagId or tagName)',
        tags: ['story-tags'],
        params: z.strictObject({
          storyId: z.string().meta({
            description: 'Story ID',
            example: 'clx1234567890',
          }),
        }),
        body: addTagBodySchema,
        response: {
          201: addStoryTagResponseSchema,
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
          409: errorSchema, // Tag already on story
        },
      },
    },
    async (request, reply) => {
      const { storyId } = request.params
      const { tagId, tagName } = request.body
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

      let tag
      let tagCreated = false

      // Get or create tag
      if (tagId) {
        // Using existing tag
        tag = await prisma.tag.findUnique({
          where: { id: tagId },
        })

        if (!tag) {
          return reply.code(404).send({ error: 'Tag not found' })
        }
      } else if (tagName) {
        // Create or get tag by name
        const normalizedName = tagName.trim().toLowerCase()

        // Validate format
        if (!/^[a-z0-9-]+$/.test(normalizedName)) {
          return reply.code(400).send({
            error: 'Tag name can only contain lowercase letters, numbers, and hyphens',
          })
        }

        // Try to find existing
        tag = await prisma.tag.findUnique({
          where: { name: normalizedName },
        })

        // Create if doesn't exist
        if (!tag) {
          tag = await prisma.tag.create({
            data: { name: normalizedName },
          })
          tagCreated = true
        }
      }

      // Check if tag already on story
      const existing = await prisma.storyTag.findUnique({
        where: {
          storyId_tagId: {
            storyId,
            tagId: tag!.id,
          },
        },
      })

      if (existing) {
        return reply.code(409).send({
          error: 'Tag already added to this story',
        })
      }

      // Add tag to story
      const storyTag = await prisma.storyTag.create({
        data: {
          storyId,
          tagId: tag!.id,
        },
        include: {
          tag: true,
        },
      })

      // Transform dates
      const transformedStoryTag = {
        ...transformDates(storyTag),
        tag: transformDates(storyTag.tag),
      }

      return reply.code(201).send({
        success: true as const,
        storyTag: transformedStoryTag,
        tagCreated,
      })
    },
  )

  // Remove tag from story
  fastify.delete(
    '/stories/:storyId/tags/:tagId',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Remove a tag from a story',
        tags: ['story-tags'],
        params: z.strictObject({
          storyId: z.string().meta({
            description: 'Story ID',
            example: 'clx1234567890',
          }),
          tagId: z.string().meta({
            description: 'Tag ID',
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
      const { storyId, tagId } = request.params
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

      // Check if tag is on story
      const storyTag = await prisma.storyTag.findUnique({
        where: {
          storyId_tagId: {
            storyId,
            tagId,
          },
        },
      })

      if (!storyTag) {
        return reply.code(404).send({ error: 'Tag not found on this story' })
      }

      // Remove tag from story
      await prisma.storyTag.delete({
        where: {
          storyId_tagId: {
            storyId,
            tagId,
          },
        },
      })

      return { success: true as const }
    },
  )
}

export default storyTagRoutes
