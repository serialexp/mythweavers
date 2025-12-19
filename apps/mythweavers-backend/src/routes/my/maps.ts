import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { prisma } from '../../lib/prisma.js'
import { transformDates } from '../../lib/transform-dates.js'
import { errorSchema } from '../../schemas/common.js'

// Schemas
const createMapBodySchema = z.strictObject({
  name: z.string().min(1).meta({ description: 'Map name', example: 'Galaxy Map' }),
  fileId: z.string().optional().meta({ description: 'File ID for map image', example: 'clx123' }),
  borderColor: z.string().optional().meta({ description: 'Border color (hex)', example: '#FF0000' }),
})

const updateMapBodySchema = z.strictObject({
  name: z.string().min(1).optional().meta({ description: 'Map name' }),
  fileId: z.string().nullable().optional().meta({ description: 'File ID for map image (null to remove)' }),
  borderColor: z.string().nullable().optional().meta({ description: 'Border color (null to remove)' }),
})

const mapSchema = z.strictObject({
  id: z.string().meta({ description: 'Map ID', example: 'clx1234567890' }),
  storyId: z.string().meta({ description: 'Story ID', example: 'clx0987654321' }),
  name: z.string().meta({ description: 'Map name', example: 'Galaxy Map' }),
  fileId: z.string().nullable().meta({ description: 'File ID for map image', example: 'clx123' }),
  borderColor: z.string().nullable().meta({ description: 'Border color', example: '#FF0000' }),
  createdAt: z.string().datetime().meta({ description: 'Creation timestamp', example: '2025-12-05T12:00:00.000Z' }),
  updatedAt: z.string().datetime().meta({ description: 'Last update timestamp', example: '2025-12-05T12:00:00.000Z' }),
})

const createMapResponseSchema = z.strictObject({
  success: z.literal(true),
  map: mapSchema,
})

const listMapsResponseSchema = z.strictObject({
  maps: z.array(mapSchema).meta({ description: 'Story maps (sorted by creation date)' }),
})

const getMapResponseSchema = z.strictObject({
  map: mapSchema,
})

const updateMapResponseSchema = z.strictObject({
  success: z.literal(true),
  map: mapSchema,
})

const deleteMapResponseSchema = z.strictObject({
  success: z.literal(true),
})

const mapIdParamsSchema = z.strictObject({
  id: z.string().meta({ description: 'Map ID', example: 'clx1234567890' }),
})

const storyIdParamsSchema = z.strictObject({
  storyId: z.string().meta({ description: 'Story ID', example: 'clx1234567890' }),
})

const mapRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // All routes require authentication
  fastify.addHook('preHandler', requireAuth)

  // POST /my/stories/:storyId/maps - Create map for story
  fastify.post(
    '/stories/:storyId/maps',
    {
      schema: {
        description: 'Create a new map for a story',
        tags: ['maps'],
        params: storyIdParamsSchema,
        body: createMapBodySchema,
        response: {
          201: createMapResponseSchema,
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
      const { name, fileId, borderColor } = request.body
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

      // If fileId provided, verify it exists and belongs to user
      if (fileId) {
        const file = await prisma.file.findUnique({
          where: { id: fileId },
          select: { id: true, ownerId: true },
        })

        if (!file || file.ownerId !== userId) {
          return reply.code(400).send({ error: 'Invalid file ID' })
        }
      }

      // Create map
      const map = await prisma.map.create({
        data: {
          storyId,
          name,
          fileId,
          borderColor,
        },
      })

      return reply.code(201).send({
        success: true as const,
        map: transformDates(map),
      })
    },
  )

  // GET /my/stories/:storyId/maps - List maps for story
  fastify.get(
    '/stories/:storyId/maps',
    {
      schema: {
        description: 'List all maps for a story',
        tags: ['maps'],
        params: storyIdParamsSchema,
        response: {
          200: listMapsResponseSchema,
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
          maps: {
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

      return reply.code(200).send({
        maps: story.maps.map(transformDates),
      })
    },
  )

  // GET /my/maps/:id - Get single map
  fastify.get(
    '/maps/:id',
    {
      schema: {
        description: 'Get a single map by ID',
        tags: ['maps'],
        params: mapIdParamsSchema,
        response: {
          200: getMapResponseSchema,
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

      // Get map with story ownership check
      const map = await prisma.map.findUnique({
        where: { id },
        include: {
          story: {
            select: { ownerId: true },
          },
        },
      })

      if (!map) {
        return reply.code(404).send({ error: 'Map not found' })
      }

      if (map.story.ownerId !== userId) {
        return reply.code(403).send({ error: 'Access denied' })
      }

      const { story, ...mapData } = map

      return reply.code(200).send({
        map: transformDates(mapData),
      })
    },
  )

  // PUT /my/maps/:id - Update map
  fastify.put(
    '/maps/:id',
    {
      schema: {
        description: 'Update a map',
        tags: ['maps'],
        params: mapIdParamsSchema,
        body: updateMapBodySchema,
        response: {
          200: updateMapResponseSchema,
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
      const { name, fileId, borderColor } = request.body
      const userId = request.user!.id

      // Get map with story ownership check
      const existingMap = await prisma.map.findUnique({
        where: { id },
        include: {
          story: {
            select: { ownerId: true },
          },
        },
      })

      if (!existingMap) {
        return reply.code(404).send({ error: 'Map not found' })
      }

      if (existingMap.story.ownerId !== userId) {
        return reply.code(403).send({ error: 'Access denied' })
      }

      // If fileId provided, verify it exists and belongs to user
      if (fileId !== undefined && fileId !== null) {
        const file = await prisma.file.findUnique({
          where: { id: fileId },
          select: { id: true, ownerId: true },
        })

        if (!file || file.ownerId !== userId) {
          return reply.code(400).send({ error: 'Invalid file ID' })
        }
      }

      // Build update data
      const updateData: any = {}
      if (name !== undefined) updateData.name = name
      if (fileId !== undefined) updateData.fileId = fileId
      if (borderColor !== undefined) updateData.borderColor = borderColor

      // Update map
      const map = await prisma.map.update({
        where: { id },
        data: updateData,
      })

      return reply.code(200).send({
        success: true as const,
        map: transformDates(map),
      })
    },
  )

  // DELETE /my/maps/:id - Delete map
  fastify.delete(
    '/maps/:id',
    {
      schema: {
        description: 'Delete a map',
        tags: ['maps'],
        params: mapIdParamsSchema,
        response: {
          200: deleteMapResponseSchema,
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

      // Get map with story ownership check
      const map = await prisma.map.findUnique({
        where: { id },
        include: {
          story: {
            select: { ownerId: true },
          },
        },
      })

      if (!map) {
        return reply.code(404).send({ error: 'Map not found' })
      }

      if (map.story.ownerId !== userId) {
        return reply.code(403).send({ error: 'Access denied' })
      }

      // Delete map (cascade will delete landmarks, pawns, paths)
      await prisma.map.delete({
        where: { id },
      })

      return reply.code(200).send({
        success: true as const,
      })
    },
  )
}

export default mapRoutes
