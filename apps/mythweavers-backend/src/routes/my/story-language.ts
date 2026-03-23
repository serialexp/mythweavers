import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { prisma } from '../../lib/prisma.js'
import { errorSchema } from '../../schemas/common.js'

// Schemas
const storyIdParamsSchema = z.strictObject({
  storyId: z.string().meta({ description: 'Story ID', example: 'clx1234567890' }),
})

const setDefaultLanguageBodySchema = z.strictObject({
  languageId: z.string().nullable().meta({ description: 'Language ID to set as primary (null to clear)', example: 'clx0987654321' }),
})

const setDefaultLanguageResponseSchema = z.strictObject({
  success: z.literal(true),
})

const storyLanguageRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // All routes require authentication
  fastify.addHook('preHandler', requireAuth)

  // PUT /my/stories/:storyId/default-language - Set default language for story
  fastify.put(
    '/stories/:storyId/default-language',
    {
      schema: {
        description: 'Set the primary language for a story',
        tags: ['stories', 'languages'],
        params: storyIdParamsSchema,
        body: setDefaultLanguageBodySchema,
        response: {
          200: setDefaultLanguageResponseSchema,
          400: errorSchema,
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { storyId } = request.params
      const { languageId } = request.body
      const userId = request.user!.id

      // Verify story exists and user owns it
      const story = await prisma.story.findUnique({
        where: { id: storyId },
        select: { id: true, ownerId: true },
      })

      if (!story) {
        return reply.code(404).send({ error: 'Story not found' })
      }

      if (story.ownerId !== userId) {
        return reply.code(403).send({ error: 'Access denied' })
      }

      // If setting a language (not clearing), verify it exists and belongs to this story
      if (languageId !== null) {
        const language = await prisma.language.findUnique({
          where: { id: languageId },
          select: { id: true, storyId: true },
        })

        if (!language) {
          return reply.code(404).send({ error: 'Language not found' })
        }

        if (language.storyId !== storyId) {
          return reply.code(400).send({
            error: 'Language does not belong to this story',
          })
        }
      }

      // Set as default
      await prisma.story.update({
        where: { id: storyId },
        data: { defaultLanguageId: languageId },
      })

      return reply.code(200).send({
        success: true as const,
      })
    },
  )
}

export default storyLanguageRoutes
