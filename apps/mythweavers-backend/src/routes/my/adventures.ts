import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { prisma } from '../../lib/prisma.js'

// Schemas
const adventureDataSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional(),
  memory: z.string().optional(),
  compactions: z.record(z.string(), z.any()).optional(),
  protagonist: z.string().optional(),
  alwaysInstructions: z.string().optional(),
  pitch: z.string().optional(),
  messagesSinceUpdate: z.number().optional(),
}).passthrough() // Allow additional fields

type AdventureData = z.infer<typeof adventureDataSchema>

const adventureSchema = z.object({
  id: z.string().meta({ example: 'clx1234567890' }),
  name: z.string().meta({ example: 'My Epic Adventure' }),
  data: adventureDataSchema,
  createdAt: z.string().meta({ example: '2025-12-05T12:00:00.000Z' }),
  updatedAt: z.string().meta({ example: '2025-12-05T12:00:00.000Z' }),
})

const adventureListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const createAdventureBodySchema = z.object({
  name: z.string().max(200).optional().meta({
    description: 'Adventure name',
    example: 'The Dragon Quest',
  }),
  data: adventureDataSchema.meta({
    description: 'Full adventure state as JSON',
  }),
})

const updateAdventureBodySchema = z.object({
  name: z.string().max(200).optional().meta({
    description: 'Adventure name',
    example: 'The Dragon Quest',
  }),
  data: adventureDataSchema.optional().meta({
    description: 'Full adventure state as JSON',
  }),
})

const errorSchema = z.object({
  error: z.string().meta({ example: 'Not found' }),
})

const adventuresRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // GET /my/adventures - List user's adventures
  fastify.get(
    '/adventures',
    {
      preHandler: requireAuth,
      schema: {
        description: 'List all adventures for the authenticated user',
        tags: ['adventures'],
        response: {
          200: z.object({
            adventures: z.array(adventureListItemSchema),
          }),
          401: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request) => {
      const adventures = await prisma.adventure.findMany({
        where: { userId: request.user!.id },
        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
      })

      return {
        adventures: adventures.map((a) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
          updatedAt: a.updatedAt.toISOString(),
        })),
      }
    },
  )

  // GET /my/adventures/:id - Get a single adventure
  fastify.get(
    '/adventures/:id',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Get a single adventure by ID',
        tags: ['adventures'],
        params: z.object({
          id: z.string().meta({ description: 'Adventure ID' }),
        }),
        response: {
          200: z.object({ adventure: adventureSchema }),
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }

      const adventure = await prisma.adventure.findFirst({
        where: {
          id,
          userId: request.user!.id,
        },
      })

      if (!adventure) {
        return reply.status(404).send({ error: 'Adventure not found' })
      }

      return {
        adventure: {
          id: adventure.id,
          name: adventure.name,
          data: adventure.data as z.infer<typeof adventureDataSchema>,
          createdAt: adventure.createdAt.toISOString(),
          updatedAt: adventure.updatedAt.toISOString(),
        },
      }
    },
  )

  // POST /my/adventures - Create a new adventure
  fastify.post(
    '/adventures',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Create a new adventure',
        tags: ['adventures'],
        body: createAdventureBodySchema,
        response: {
          201: z.object({ adventure: adventureSchema }),
          400: errorSchema,
          401: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { name, data } = request.body

      // Try to extract name from pitch if not provided
      const adventureName = name || extractNameFromPitch(data.pitch) || 'Untitled Adventure'

      const adventure = await prisma.adventure.create({
        data: {
          userId: request.user!.id,
          name: adventureName,
          data: data as Prisma.InputJsonValue,
        },
      })

      return reply.status(201).send({
        adventure: {
          id: adventure.id,
          name: adventure.name,
          data: adventure.data as z.infer<typeof adventureDataSchema>,
          createdAt: adventure.createdAt.toISOString(),
          updatedAt: adventure.updatedAt.toISOString(),
        },
      })
    },
  )

  // PUT /my/adventures/:id - Update an adventure
  fastify.put(
    '/adventures/:id',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Update an adventure',
        tags: ['adventures'],
        params: z.object({
          id: z.string().meta({ description: 'Adventure ID' }),
        }),
        body: updateAdventureBodySchema,
        response: {
          200: z.object({ adventure: adventureSchema }),
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { name, data } = request.body

      // Check ownership
      const existing = await prisma.adventure.findFirst({
        where: {
          id,
          userId: request.user!.id,
        },
      })

      if (!existing) {
        return reply.status(404).send({ error: 'Adventure not found' })
      }

      const adventure = await prisma.adventure.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(data !== undefined && { data: data as Prisma.InputJsonValue }),
        },
      })

      return {
        adventure: {
          id: adventure.id,
          name: adventure.name,
          data: adventure.data as z.infer<typeof adventureDataSchema>,
          createdAt: adventure.createdAt.toISOString(),
          updatedAt: adventure.updatedAt.toISOString(),
        },
      }
    },
  )

  // DELETE /my/adventures/:id - Delete an adventure
  fastify.delete(
    '/adventures/:id',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Delete an adventure',
        tags: ['adventures'],
        params: z.object({
          id: z.string().meta({ description: 'Adventure ID' }),
        }),
        response: {
          200: z.object({ success: z.literal(true) }),
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }

      // Check ownership
      const existing = await prisma.adventure.findFirst({
        where: {
          id,
          userId: request.user!.id,
        },
      })

      if (!existing) {
        return reply.status(404).send({ error: 'Adventure not found' })
      }

      await prisma.adventure.delete({
        where: { id },
      })

      return { success: true as const }
    },
  )
}

// Helper to extract a name from the adventure pitch
function extractNameFromPitch(pitch?: string): string | null {
  if (!pitch) return null

  // Try to find a title pattern like "**Title:**" or "# Title"
  const titleMatch = pitch.match(/\*\*(?:Title|Name|Adventure):\*\*\s*(.+?)(?:\n|$)/i)
  if (titleMatch) return titleMatch[1].trim().slice(0, 100)

  // Try markdown heading
  const headingMatch = pitch.match(/^#\s+(.+?)$/m)
  if (headingMatch) return headingMatch[1].trim().slice(0, 100)

  // Use first line if short enough
  const firstLine = pitch.split('\n')[0].trim()
  if (firstLine.length <= 60) return firstLine

  return null
}

export default adventuresRoutes
