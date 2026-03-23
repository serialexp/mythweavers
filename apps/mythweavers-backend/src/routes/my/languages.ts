import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { prisma } from '../../lib/prisma.js'
import { transformDates } from '../../lib/transform-dates.js'
import { errorSchema } from '../../schemas/common.js'

// Schemas
const createLanguageBodySchema = z.strictObject({
  name: z.string().min(1).meta({ description: 'Language name for LLM prompts', example: 'Scottish Gaelic' }),
  label: z.string().min(1).meta({ description: 'Display label in UI', example: 'Gaelic' }),
  setAsDefault: z.boolean().optional().meta({ description: 'Set as default/primary language for story', example: false }),
})

const updateLanguageBodySchema = z.strictObject({
  name: z.string().min(1).optional().meta({ description: 'Language name for LLM prompts', example: 'Scottish Gaelic' }),
  label: z.string().min(1).optional().meta({ description: 'Display label in UI', example: 'Gaelic' }),
})

const languageSchema = z.strictObject({
  id: z.string().meta({ description: 'Language ID', example: 'clx1234567890' }),
  storyId: z.string().meta({ description: 'Story ID', example: 'clx0987654321' }),
  name: z.string().meta({ description: 'Language name for LLM prompts', example: 'Scottish Gaelic' }),
  label: z.string().meta({ description: 'Display label in UI', example: 'Gaelic' }),
  createdAt: z.string().datetime().meta({ description: 'Creation timestamp', example: '2025-12-05T12:00:00.000Z' }),
  updatedAt: z.string().datetime().meta({ description: 'Last update timestamp', example: '2025-12-05T12:00:00.000Z' }),
})

const languageListItemSchema = z.strictObject({
  id: z.string().meta({ description: 'Language ID', example: 'clx1234567890' }),
  name: z.string().meta({ description: 'Language name for LLM prompts', example: 'Scottish Gaelic' }),
  label: z.string().meta({ description: 'Display label in UI', example: 'Gaelic' }),
  isDefault: z.boolean().meta({ description: 'Is this the primary language for the story', example: false }),
})

const createLanguageResponseSchema = z.strictObject({
  success: z.literal(true),
  language: languageSchema,
})

const listLanguagesResponseSchema = z.strictObject({
  languages: z.array(languageListItemSchema).meta({ description: 'Story languages (sorted by creation date)' }),
})

const getLanguageResponseSchema = z.strictObject({
  language: languageSchema,
})

const updateLanguageResponseSchema = z.strictObject({
  success: z.literal(true),
  language: languageSchema,
})

const deleteLanguageResponseSchema = z.strictObject({
  success: z.literal(true),
})

const languageParamsSchema = z.strictObject({
  id: z.string().meta({ description: 'Language ID', example: 'clx1234567890' }),
})

const storyIdParamsSchema = z.strictObject({
  storyId: z.string().meta({ description: 'Story ID', example: 'clx1234567890' }),
})

const languageRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // All routes require authentication
  fastify.addHook('preHandler', requireAuth)

  // POST /my/stories/:storyId/languages - Create language for story
  fastify.post(
    '/stories/:storyId/languages',
    {
      schema: {
        description: 'Create a new language for a story',
        tags: ['languages'],
        params: storyIdParamsSchema,
        body: createLanguageBodySchema,
        response: {
          201: createLanguageResponseSchema,
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
      const { name, label, setAsDefault } = request.body
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

      // Create language
      const language = await prisma.language.create({
        data: {
          storyId,
          name,
          label,
        },
      })

      // If setAsDefault, update story
      if (setAsDefault) {
        await prisma.story.update({
          where: { id: storyId },
          data: { defaultLanguageId: language.id },
        })
      }

      return reply.code(201).send({
        success: true as const,
        language: transformDates(language),
      })
    },
  )

  // GET /my/stories/:storyId/languages - List languages for story
  fastify.get(
    '/stories/:storyId/languages',
    {
      schema: {
        description: 'List all languages for a story',
        tags: ['languages'],
        params: storyIdParamsSchema,
        response: {
          200: listLanguagesResponseSchema,
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { storyId } = request.params
      const userId = request.user!.id

      // Verify story exists and user owns it
      const story = await prisma.story.findUnique({
        where: { id: storyId },
        select: {
          id: true,
          ownerId: true,
          defaultLanguageId: true,
          languages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      })

      if (!story) {
        return reply.code(404).send({ error: 'Story not found' })
      }

      if (story.ownerId !== userId) {
        return reply.code(403).send({ error: 'Access denied' })
      }

      const languages = story.languages.map((lang) => ({
        id: lang.id,
        name: lang.name,
        label: lang.label,
        isDefault: lang.id === story.defaultLanguageId,
      }))

      return reply.code(200).send({ languages })
    },
  )

  // GET /my/languages/:id - Get single language
  fastify.get(
    '/languages/:id',
    {
      schema: {
        description: 'Get a single language by ID',
        tags: ['languages'],
        params: languageParamsSchema,
        response: {
          200: getLanguageResponseSchema,
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params
      const userId = request.user!.id

      const language = await prisma.language.findUnique({
        where: { id },
        include: {
          story: {
            select: { ownerId: true },
          },
        },
      })

      if (!language) {
        return reply.code(404).send({ error: 'Language not found' })
      }

      if (language.story.ownerId !== userId) {
        return reply.code(403).send({ error: 'Access denied' })
      }

      const { story, ...languageData } = language

      return reply.code(200).send({
        language: transformDates(languageData),
      })
    },
  )

  // PUT /my/languages/:id - Update language
  fastify.put(
    '/languages/:id',
    {
      schema: {
        description: 'Update a language',
        tags: ['languages'],
        params: languageParamsSchema,
        body: updateLanguageBodySchema,
        response: {
          200: updateLanguageResponseSchema,
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params
      const { name, label } = request.body
      const userId = request.user!.id

      const existingLanguage = await prisma.language.findUnique({
        where: { id },
        include: {
          story: {
            select: { ownerId: true },
          },
        },
      })

      if (!existingLanguage) {
        return reply.code(404).send({ error: 'Language not found' })
      }

      if (existingLanguage.story.ownerId !== userId) {
        return reply.code(403).send({ error: 'Access denied' })
      }

      const language = await prisma.language.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(label !== undefined && { label }),
        },
      })

      return reply.code(200).send({
        success: true as const,
        language: transformDates(language),
      })
    },
  )

  // DELETE /my/languages/:id - Delete language
  fastify.delete(
    '/languages/:id',
    {
      schema: {
        description: 'Delete a language',
        tags: ['languages'],
        params: languageParamsSchema,
        response: {
          200: deleteLanguageResponseSchema,
          400: errorSchema,
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params
      const userId = request.user!.id

      const language = await prisma.language.findUnique({
        where: { id },
        include: {
          story: {
            select: { ownerId: true, defaultLanguageId: true },
          },
        },
      })

      if (!language) {
        return reply.code(404).send({ error: 'Language not found' })
      }

      if (language.story.ownerId !== userId) {
        return reply.code(403).send({ error: 'Access denied' })
      }

      // If deleting the default language, clear the default first
      if (language.story.defaultLanguageId === id) {
        await prisma.story.update({
          where: { id: language.storyId },
          data: { defaultLanguageId: null },
        })
      }

      await prisma.language.delete({
        where: { id },
      })

      return reply.code(200).send({
        success: true as const,
      })
    },
  )
}

export default languageRoutes
