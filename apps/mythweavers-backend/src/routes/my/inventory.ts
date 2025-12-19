import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { prisma } from '../../lib/prisma.js'
import { transformDates } from '../../lib/transform-dates.js'
import { errorSchema, successSchema } from '../../schemas/common.js'

// ============================================================================
// SCHEMAS
// ============================================================================

const itemSchema = z.strictObject({
  id: z.string().meta({ example: 'clx1234567890' }),
  characterId: z.string().meta({ example: 'clx1234567890' }),
  name: z.string().meta({ example: 'Magic Sword' }),
  description: z.string().nullable().meta({ example: 'A legendary blade forged in dragon fire' }),
  amount: z.number().int().meta({ example: 1 }),
  createdAt: z.string().datetime().meta({ example: '2025-12-06T12:00:00.000Z' }),
  updatedAt: z.string().datetime().meta({ example: '2025-12-06T12:00:00.000Z' }),
})

const createItemBodySchema = z.strictObject({
  name: z.string().min(1).max(200).meta({
    description: 'Item name',
    example: 'Magic Sword',
  }),
  description: z.string().optional().meta({
    description: 'Item description (optional)',
    example: 'A legendary blade forged in dragon fire',
  }),
  amount: z.number().int().min(1).default(1).meta({
    description: 'Quantity (defaults to 1)',
    example: 1,
  }),
})

const updateItemBodySchema = z.strictObject({
  name: z.string().min(1).max(200).optional().meta({
    description: 'Item name',
    example: 'Magic Sword of Destiny',
  }),
  description: z.string().nullable().optional().meta({
    description: 'Item description',
    example: 'A legendary blade, now enhanced with ancient runes',
  }),
  amount: z.number().int().min(0).optional().meta({
    description: 'Quantity (0 to remove item)',
    example: 2,
  }),
})

const createItemResponseSchema = z.strictObject({
  success: z.literal(true),
  item: itemSchema,
})

const listItemsResponseSchema = z.strictObject({
  items: z.array(itemSchema),
})

const getItemResponseSchema = z.strictObject({
  item: itemSchema,
})

// ============================================================================
// ROUTES
// ============================================================================

const inventoryRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // List character's inventory
  fastify.get(
    '/characters/:characterId/inventory',
    {
      preHandler: requireAuth,
      schema: {
        description: "List all items in a character's inventory",
        tags: ['inventory'],
        params: z.strictObject({
          characterId: z.string().meta({
            description: 'Character ID',
            example: 'clx1234567890',
          }),
        }),
        response: {
          200: listItemsResponseSchema,
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { characterId } = request.params
      const userId = request.user!.id

      // Verify character exists and user owns it
      const character = await prisma.character.findUnique({
        where: { id: characterId },
        include: {
          story: {
            select: { ownerId: true },
          },
        },
      })

      if (!character) {
        return reply.code(404).send({ error: 'Character not found' })
      }

      if (character.story.ownerId !== userId) {
        return reply.code(404).send({ error: 'Character not found' })
      }

      // Get inventory
      const items = await prisma.item.findMany({
        where: { characterId },
        orderBy: { name: 'asc' },
      })

      return { items: items.map(transformDates) }
    },
  )

  // Add item to character's inventory
  fastify.post(
    '/characters/:characterId/inventory',
    {
      preHandler: requireAuth,
      schema: {
        description: "Add an item to a character's inventory",
        tags: ['inventory'],
        params: z.strictObject({
          characterId: z.string().meta({
            description: 'Character ID',
            example: 'clx1234567890',
          }),
        }),
        body: createItemBodySchema,
        response: {
          201: createItemResponseSchema,
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
          409: errorSchema, // Item already exists
        },
      },
    },
    async (request, reply) => {
      const { characterId } = request.params
      const userId = request.user!.id

      // Verify character exists and user owns it
      const character = await prisma.character.findUnique({
        where: { id: characterId },
        include: {
          story: {
            select: { ownerId: true },
          },
        },
      })

      if (!character) {
        return reply.code(404).send({ error: 'Character not found' })
      }

      if (character.story.ownerId !== userId) {
        return reply.code(404).send({ error: 'Character not found' })
      }

      // Check if item with this name already exists for this character
      const existingItem = await prisma.item.findUnique({
        where: {
          characterId_name: {
            characterId,
            name: request.body.name,
          },
        },
      })

      if (existingItem) {
        return reply.code(409).send({
          error: 'Item with this name already exists in character inventory. Update the existing item instead.',
        })
      }

      // Create item
      const item = await prisma.item.create({
        data: {
          characterId,
          name: request.body.name,
          description: request.body.description || null,
          amount: request.body.amount,
        },
      })

      return reply.code(201).send({
        success: true as const,
        item: transformDates(item),
      })
    },
  )

  // Get single item
  fastify.get(
    '/characters/:characterId/inventory/:id',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Get a single item from character inventory',
        tags: ['inventory'],
        params: z.strictObject({
          characterId: z.string().meta({
            description: 'Character ID',
            example: 'clx1234567890',
          }),
          id: z.string().meta({
            description: 'Item ID',
            example: 'clx1234567890',
          }),
        }),
        response: {
          200: getItemResponseSchema,
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { characterId, id } = request.params
      const userId = request.user!.id

      // Get item with character verification
      const item = await prisma.item.findUnique({
        where: { id },
        include: {
          character: {
            include: {
              story: {
                select: { ownerId: true },
              },
            },
          },
        },
      })

      if (!item) {
        return reply.code(404).send({ error: 'Item not found' })
      }

      // Verify character ID matches
      if (item.characterId !== characterId) {
        return reply.code(404).send({ error: 'Item not found' })
      }

      // Verify user owns the character
      if (item.character.story.ownerId !== userId) {
        return reply.code(404).send({ error: 'Item not found' })
      }

      // Return without nested data
      const { character, ...itemData } = item

      return { item: transformDates(itemData) }
    },
  )

  // Update item
  fastify.patch(
    '/characters/:characterId/inventory/:id',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Update an item in character inventory (set amount to 0 to remove)',
        tags: ['inventory'],
        params: z.strictObject({
          characterId: z.string().meta({
            description: 'Character ID',
            example: 'clx1234567890',
          }),
          id: z.string().meta({
            description: 'Item ID',
            example: 'clx1234567890',
          }),
        }),
        body: updateItemBodySchema,
        response: {
          200: z.strictObject({
            success: z.literal(true),
            item: itemSchema,
          }),
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
          409: errorSchema, // Name conflict
        },
      },
    },
    async (request, reply) => {
      const { characterId, id } = request.params
      const userId = request.user!.id

      // Get item with character verification
      const item = await prisma.item.findUnique({
        where: { id },
        include: {
          character: {
            include: {
              story: {
                select: { ownerId: true },
              },
            },
          },
        },
      })

      if (!item) {
        return reply.code(404).send({ error: 'Item not found' })
      }

      // Verify character ID matches
      if (item.characterId !== characterId) {
        return reply.code(404).send({ error: 'Item not found' })
      }

      // Verify user owns the character
      if (item.character.story.ownerId !== userId) {
        return reply.code(404).send({ error: 'Item not found' })
      }

      // If renaming, check for name conflicts
      if (request.body.name && request.body.name !== item.name) {
        const existingItem = await prisma.item.findUnique({
          where: {
            characterId_name: {
              characterId,
              name: request.body.name,
            },
          },
        })

        if (existingItem) {
          return reply.code(409).send({
            error: 'Item with this name already exists in character inventory',
          })
        }
      }

      // Update item
      const updated = await prisma.item.update({
        where: { id },
        data: {
          name: request.body.name,
          description: request.body.description,
          amount: request.body.amount,
        },
      })

      return {
        success: true as const,
        item: transformDates(updated),
      }
    },
  )

  // Delete item
  fastify.delete(
    '/characters/:characterId/inventory/:id',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Delete an item from character inventory',
        tags: ['inventory'],
        params: z.strictObject({
          characterId: z.string().meta({
            description: 'Character ID',
            example: 'clx1234567890',
          }),
          id: z.string().meta({
            description: 'Item ID',
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
      const { characterId, id } = request.params
      const userId = request.user!.id

      // Get item with character verification
      const item = await prisma.item.findUnique({
        where: { id },
        include: {
          character: {
            include: {
              story: {
                select: { ownerId: true },
              },
            },
          },
        },
      })

      if (!item) {
        return reply.code(404).send({ error: 'Item not found' })
      }

      // Verify character ID matches
      if (item.characterId !== characterId) {
        return reply.code(404).send({ error: 'Item not found' })
      }

      // Verify user owns the character
      if (item.character.story.ownerId !== userId) {
        return reply.code(404).send({ error: 'Item not found' })
      }

      // Delete item
      await prisma.item.delete({ where: { id } })

      return { success: true as const }
    },
  )
}

export default inventoryRoutes
