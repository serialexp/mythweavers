import type { Prisma } from '@prisma/client'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { prisma } from '../../lib/prisma.js'
import { errorSchema } from '../../schemas/common.js'
import { significantActionSchema } from '../../schemas/paragraph.js'

// Character response schema
const characterSchema = z.strictObject({
  id: z.string().meta({
    description: 'Character ID',
    example: 'clx1234567890',
  }),
  storyId: z.string().meta({
    description: 'Parent story ID',
    example: 'clx9876543210',
  }),
  pictureFileId: z.string().nullable().meta({
    description: 'Picture file ID',
    example: 'clx1111111111',
  }),
  firstName: z.string().meta({
    description: 'Character first name',
    example: 'John',
  }),
  middleName: z.string().nullable().meta({
    description: 'Character middle name',
    example: 'Andrew',
  }),
  lastName: z.string().nullable().meta({
    description: 'Character last name',
    example: 'Smith',
  }),
  nickname: z.string().nullable().meta({
    description: 'Character nickname',
    example: 'Johnny',
  }),
  description: z.string().nullable().meta({
    description: 'Character description (dynamic template for AI generation)',
    example: 'A brave warrior seeking redemption',
  }),
  background: z.string().nullable().meta({
    description: 'Character background/history',
    example: 'Born in a small village...',
  }),
  personality: z.string().nullable().meta({
    description: 'Character personality description',
    example: 'Courageous but impulsive',
  }),
  personalityQuirks: z.string().nullable().meta({
    description: 'Character personality quirks',
    example: 'Always whistles when nervous',
  }),
  likes: z.string().nullable().meta({
    description: 'Things the character likes',
    example: 'Swordfighting, stargazing, apple pie',
  }),
  dislikes: z.string().nullable().meta({
    description: 'Things the character dislikes',
    example: 'Dishonesty, crowded places',
  }),
  age: z.string().nullable().meta({
    description: 'Character age',
    example: '28',
  }),
  gender: z.string().nullable().meta({
    description: 'Character gender',
    example: 'male',
  }),
  sexualOrientation: z.string().nullable().meta({
    description: 'Character sexual orientation',
    example: 'heterosexual',
  }),
  height: z.number().nullable().meta({
    description: 'Character height in centimeters',
    example: 180,
  }),
  hairColor: z.string().nullable().meta({
    description: 'Hair color',
    example: 'brown',
  }),
  eyeColor: z.string().nullable().meta({
    description: 'Eye color',
    example: 'blue',
  }),
  distinguishingFeatures: z.string().nullable().meta({
    description: 'Distinguishing physical features',
    example: 'Scar across left cheek',
  }),
  writingStyle: z.string().nullable().meta({
    description: 'Character writing/speaking style',
    example: 'Formal and concise',
  }),
  isMainCharacter: z.boolean().meta({
    description: 'Whether this is a main character',
    example: true,
  }),
  laterVersionOfId: z.string().nullable().meta({
    description: 'ID of earlier version of this character',
    example: 'clx2222222222',
  }),
  significantActions: z
    .array(significantActionSchema)
    .nullable()
    .meta({
      description: 'Array of significant actions the character has taken',
      example: [{ action: 'Found the artifact', sceneId: 'clx123', timestamp: 1440 }],
    }),
  birthdate: z.number().nullable().meta({
    description: 'Birth date in story time',
    example: 1000,
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

// Create character request body
const createCharacterBodySchema = z.strictObject({
  firstName: z.string().min(1).max(100).meta({
    description: 'Character first name (required)',
    example: 'John',
  }),
  middleName: z.string().max(100).optional().meta({
    description: 'Character middle name',
    example: 'Andrew',
  }),
  lastName: z.string().max(100).optional().meta({
    description: 'Character last name',
    example: 'Smith',
  }),
  nickname: z.string().max(100).optional().meta({
    description: 'Character nickname',
    example: 'Johnny',
  }),
  pictureFileId: z.string().optional().meta({
    description: 'Picture file ID',
    example: 'clx1111111111',
  }),
  description: z.string().optional().meta({
    description: 'Character description (dynamic template for AI generation)',
    example: 'A brave warrior seeking redemption',
  }),
  background: z.string().optional().meta({
    description: 'Character background/history',
    example: 'Born in a small village...',
  }),
  personality: z.string().optional().meta({
    description: 'Character personality description',
    example: 'Courageous but impulsive',
  }),
  personalityQuirks: z.string().optional().meta({
    description: 'Character personality quirks',
    example: 'Always whistles when nervous',
  }),
  likes: z.string().optional().meta({
    description: 'Things the character likes',
    example: 'Swordfighting, stargazing, apple pie',
  }),
  dislikes: z.string().optional().meta({
    description: 'Things the character dislikes',
    example: 'Dishonesty, crowded places',
  }),
  age: z.string().optional().meta({
    description: 'Character age',
    example: '28',
  }),
  gender: z.string().optional().meta({
    description: 'Character gender',
    example: 'male',
  }),
  sexualOrientation: z.string().optional().meta({
    description: 'Character sexual orientation',
    example: 'heterosexual',
  }),
  height: z.number().int().optional().meta({
    description: 'Character height in centimeters',
    example: 180,
  }),
  hairColor: z.string().optional().meta({
    description: 'Hair color',
    example: 'brown',
  }),
  eyeColor: z.string().optional().meta({
    description: 'Eye color',
    example: 'blue',
  }),
  distinguishingFeatures: z.string().optional().meta({
    description: 'Distinguishing physical features',
    example: 'Scar across left cheek',
  }),
  writingStyle: z.string().optional().meta({
    description: 'Character writing/speaking style',
    example: 'Formal and concise',
  }),
  isMainCharacter: z.boolean().optional().meta({
    description: 'Whether this is a main character',
    example: true,
  }),
  laterVersionOfId: z.string().optional().meta({
    description: 'ID of earlier version of this character',
    example: 'clx2222222222',
  }),
  significantActions: z
    .array(significantActionSchema)
    .optional()
    .meta({
      description: 'Array of significant actions the character has taken',
      example: [{ action: 'Found the artifact', sceneId: 'clx123', timestamp: 1440 }],
    }),
  birthdate: z.number().int().optional().meta({
    description: 'Birth date in story time',
    example: 1000,
  }),
})

// Update character request body (all fields optional)
const updateCharacterBodySchema = z.strictObject({
  firstName: z.string().min(1).max(100).optional().meta({
    description: 'Character first name',
    example: 'John',
  }),
  middleName: z.string().max(100).nullable().optional().meta({
    description: 'Character middle name',
    example: 'Andrew',
  }),
  lastName: z.string().max(100).nullable().optional().meta({
    description: 'Character last name',
    example: 'Smith',
  }),
  nickname: z.string().max(100).nullable().optional().meta({
    description: 'Character nickname',
    example: 'Johnny',
  }),
  pictureFileId: z.string().nullable().optional().meta({
    description: 'Picture file ID',
    example: 'clx1111111111',
  }),
  description: z.string().nullable().optional().meta({
    description: 'Character description (dynamic template for AI generation)',
    example: 'A brave warrior seeking redemption',
  }),
  background: z.string().nullable().optional().meta({
    description: 'Character background/history',
    example: 'Born in a small village...',
  }),
  personality: z.string().nullable().optional().meta({
    description: 'Character personality description',
    example: 'Courageous but impulsive',
  }),
  personalityQuirks: z.string().nullable().optional().meta({
    description: 'Character personality quirks',
    example: 'Always whistles when nervous',
  }),
  likes: z.string().nullable().optional().meta({
    description: 'Things the character likes',
    example: 'Swordfighting, stargazing, apple pie',
  }),
  dislikes: z.string().nullable().optional().meta({
    description: 'Things the character dislikes',
    example: 'Dishonesty, crowded places',
  }),
  age: z.string().nullable().optional().meta({
    description: 'Character age',
    example: '28',
  }),
  gender: z.string().nullable().optional().meta({
    description: 'Character gender',
    example: 'male',
  }),
  sexualOrientation: z.string().nullable().optional().meta({
    description: 'Character sexual orientation',
    example: 'heterosexual',
  }),
  height: z.number().int().nullable().optional().meta({
    description: 'Character height in centimeters',
    example: 180,
  }),
  hairColor: z.string().nullable().optional().meta({
    description: 'Hair color',
    example: 'brown',
  }),
  eyeColor: z.string().nullable().optional().meta({
    description: 'Eye color',
    example: 'blue',
  }),
  distinguishingFeatures: z.string().nullable().optional().meta({
    description: 'Distinguishing physical features',
    example: 'Scar across left cheek',
  }),
  writingStyle: z.string().nullable().optional().meta({
    description: 'Character writing/speaking style',
    example: 'Formal and concise',
  }),
  isMainCharacter: z.boolean().optional().meta({
    description: 'Whether this is a main character',
    example: true,
  }),
  laterVersionOfId: z.string().nullable().optional().meta({
    description: 'ID of earlier version of this character',
    example: 'clx2222222222',
  }),
  significantActions: z
    .array(significantActionSchema)
    .nullable()
    .optional()
    .meta({
      description: 'Array of significant actions the character has taken',
      example: [{ action: 'Found the artifact', sceneId: 'clx123', timestamp: 1440 }],
    }),
  birthdate: z.number().int().nullable().optional().meta({
    description: 'Birth date in story time',
    example: 1000,
  }),
})

// Path parameters
const storyIdParamSchema = z.strictObject({
  storyId: z.string().meta({
    description: 'Story ID',
    example: 'clx1234567890',
  }),
})

const characterIdParamSchema = z.strictObject({
  id: z.string().meta({
    description: 'Character ID',
    example: 'clx1234567890',
  }),
})

// Response schemas
const createCharacterResponseSchema = z.strictObject({
  success: z.literal(true),
  character: characterSchema,
})

const listCharactersResponseSchema = z.strictObject({
  characters: z.array(characterSchema),
})

const getCharacterResponseSchema = z.strictObject({
  character: characterSchema,
})

const updateCharacterResponseSchema = z.strictObject({
  success: z.literal(true),
  character: characterSchema,
})

const deleteCharacterResponseSchema = z.strictObject({
  success: z.literal(true),
})

// Helper to format character for response
function formatCharacter(character: any) {
  return {
    ...character,
    createdAt: character.createdAt.toISOString(),
    updatedAt: character.updatedAt.toISOString(),
  }
}

const myCharactersRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // All routes require authentication
  fastify.addHook('preHandler', requireAuth)

  // POST /my/stories/:storyId/characters - Create new character
  fastify.post(
    '/stories/:storyId/characters',
    {
      schema: {
        description: 'Create a new character in a story',
        tags: ['my-characters'],
        security: [{ sessionAuth: [] }],
        params: storyIdParamSchema,
        body: createCharacterBodySchema,
        response: {
          201: createCharacterResponseSchema,
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
        const { storyId } = request.params
        const characterData = request.body

        // Verify story exists and is owned by user
        const story = await prisma.story.findFirst({
          where: {
            id: storyId,
            ownerId: userId,
          },
        })

        if (!story) {
          return reply.status(404).send({ error: 'Story not found' })
        }

        // If laterVersionOfId is provided, verify it exists and belongs to same story
        if (characterData.laterVersionOfId) {
          const previousVersion = await prisma.character.findFirst({
            where: {
              id: characterData.laterVersionOfId,
              storyId,
            },
          })

          if (!previousVersion) {
            return reply.status(400).send({ error: 'Previous character version not found in this story' })
          }
        }

        const character = await prisma.character.create({
          data: {
            ...characterData,
            storyId,
            // Convert undefined to null for optional fields
            middleName: characterData.middleName ?? null,
            lastName: characterData.lastName ?? null,
            nickname: characterData.nickname ?? null,
            pictureFileId: characterData.pictureFileId ?? null,
            description: characterData.description ?? null,
            background: characterData.background ?? null,
            personality: characterData.personality ?? null,
            personalityQuirks: characterData.personalityQuirks ?? null,
            likes: characterData.likes ?? null,
            dislikes: characterData.dislikes ?? null,
            age: characterData.age ?? null,
            gender: characterData.gender ?? null,
            sexualOrientation: characterData.sexualOrientation ?? null,
            height: characterData.height ?? null,
            hairColor: characterData.hairColor ?? null,
            eyeColor: characterData.eyeColor ?? null,
            distinguishingFeatures: characterData.distinguishingFeatures ?? null,
            writingStyle: characterData.writingStyle ?? null,
            laterVersionOfId: characterData.laterVersionOfId ?? null,
            significantActions: (characterData.significantActions ?? null) as Prisma.InputJsonValue,
            birthdate: characterData.birthdate ?? null,
          },
        })

        fastify.log.info({ characterId: character.id, storyId, userId }, 'Character created')

        return reply.status(201).send({
          success: true as const,
          character: formatCharacter(character),
        })
      } catch (error) {
        fastify.log.error({ error }, 'Failed to create character')
        return reply.status(500).send({ error: 'Failed to create character' })
      }
    },
  )

  // GET /my/stories/:storyId/characters - List characters in a story
  fastify.get(
    '/stories/:storyId/characters',
    {
      schema: {
        description: 'List all characters in a story',
        tags: ['my-characters'],
        security: [{ sessionAuth: [] }],
        params: storyIdParamSchema,
        response: {
          200: listCharactersResponseSchema,
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id
        const { storyId } = request.params

        // Verify story exists and is owned by user
        const story = await prisma.story.findFirst({
          where: {
            id: storyId,
            ownerId: userId,
          },
        })

        if (!story) {
          return reply.status(404).send({ error: 'Story not found' })
        }

        // Get characters
        const characters = await prisma.character.findMany({
          where: { storyId },
          orderBy: { createdAt: 'asc' },
        })

        return {
          characters: characters.map(formatCharacter),
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to list characters')
        return reply.status(500).send({ error: 'Failed to list characters' })
      }
    },
  )

  // GET /my/characters/:id - Get single character
  fastify.get(
    '/characters/:id',
    {
      schema: {
        description: 'Get a single character by ID (must own the parent story)',
        tags: ['my-characters'],
        security: [{ sessionAuth: [] }],
        params: characterIdParamSchema,
        response: {
          200: getCharacterResponseSchema,
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

        const character = await prisma.character.findFirst({
          where: {
            id,
            story: {
              ownerId: userId,
            },
          },
        })

        if (!character) {
          return reply.status(404).send({ error: 'Character not found' })
        }

        return {
          character: formatCharacter(character),
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get character')
        return reply.status(500).send({ error: 'Failed to get character' })
      }
    },
  )

  // PATCH /my/characters/:id - Update character
  fastify.patch(
    '/characters/:id',
    {
      schema: {
        description: 'Update a character (must own the parent story)',
        tags: ['my-characters'],
        security: [{ sessionAuth: [] }],
        params: characterIdParamSchema,
        body: updateCharacterBodySchema,
        response: {
          200: updateCharacterResponseSchema,
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

        // Check if character exists and user owns the parent story
        const existingCharacter = await prisma.character.findFirst({
          where: {
            id,
            story: {
              ownerId: userId,
            },
          },
        })

        if (!existingCharacter) {
          return reply.status(404).send({ error: 'Character not found' })
        }

        // If laterVersionOfId is being updated, verify it exists and belongs to same story
        if (updates.laterVersionOfId !== undefined && updates.laterVersionOfId !== null) {
          const previousVersion = await prisma.character.findFirst({
            where: {
              id: updates.laterVersionOfId,
              storyId: existingCharacter.storyId,
            },
          })

          if (!previousVersion) {
            return reply.status(400).send({ error: 'Previous character version not found in this story' })
          }
        }

        // Update character
        const character = await prisma.character.update({
          where: { id },
          data: updates as Prisma.CharacterUpdateInput,
        })

        fastify.log.info({ characterId: character.id, userId }, 'Character updated')

        return {
          success: true as const,
          character: formatCharacter(character),
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to update character')
        return reply.status(500).send({ error: 'Failed to update character' })
      }
    },
  )

  // DELETE /my/characters/:id - Delete character
  fastify.delete(
    '/characters/:id',
    {
      schema: {
        description: 'Delete a character (must own the parent story)',
        tags: ['my-characters'],
        security: [{ sessionAuth: [] }],
        params: characterIdParamSchema,
        response: {
          200: deleteCharacterResponseSchema,
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

        // Check if character exists and user owns the parent story
        const existingCharacter = await prisma.character.findFirst({
          where: {
            id,
            story: {
              ownerId: userId,
            },
          },
        })

        if (!existingCharacter) {
          return reply.status(404).send({ error: 'Character not found' })
        }

        // Delete character
        await prisma.character.delete({
          where: { id },
        })

        fastify.log.info({ characterId: id, userId }, 'Character deleted')

        return {
          success: true as const,
        }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to delete character')
        return reply.status(500).send({ error: 'Failed to delete character' })
      }
    },
  )
}

export default myCharactersRoutes
