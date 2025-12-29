import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { prisma } from '../../lib/prisma.js'
import { errorSchema } from '../../schemas/common.js'

// Schemas
const createLandmarkBodySchema = z.strictObject({
  x: z.number().meta({ description: 'X coordinate (0-1 normalized)', example: 0.5 }),
  y: z.number().meta({ description: 'Y coordinate (0-1 normalized)', example: 0.3 }),
  name: z.string().min(1).meta({ description: 'Landmark name', example: 'Capital City' }),
  description: z.string().meta({ description: 'Landmark description', example: 'The main capital' }),
  type: z.string().optional().meta({ description: 'Landmark type', example: 'point' }),
  color: z.string().optional().meta({ description: 'Display color (hex)', example: '#00FF00' }),
  size: z.string().optional().meta({ description: 'Size category', example: 'large' }),
  properties: z.record(z.string(), z.any()).optional().meta({ description: 'Custom properties', example: { population: '1 million', faction: 'alliance' } }),
})

const updateLandmarkBodySchema = z.strictObject({
  x: z.number().optional().meta({ description: 'X coordinate (0-1 normalized)' }),
  y: z.number().optional().meta({ description: 'Y coordinate (0-1 normalized)' }),
  name: z.string().min(1).optional().meta({ description: 'Landmark name' }),
  description: z.string().optional().meta({ description: 'Landmark description' }),
  type: z.string().optional().meta({ description: 'Landmark type' }),
  color: z.string().nullable().optional().meta({ description: 'Display color (null to remove)' }),
  size: z.string().nullable().optional().meta({ description: 'Size category (null to remove)' }),
  properties: z.record(z.string(), z.any()).optional().meta({ description: 'Custom properties (merged with existing)' }),
})

// List view schema - minimal data for rendering pins
const landmarkListItemSchema = z.strictObject({
  id: z.string().meta({ description: 'Landmark ID', example: 'clx1234567890' }),
  mapId: z.string().meta({ description: 'Map ID', example: 'clx0987654321' }),
  x: z.number().meta({ description: 'X coordinate', example: 0.5 }),
  y: z.number().meta({ description: 'Y coordinate', example: 0.3 }),
  name: z.string().meta({ description: 'Landmark name', example: 'Capital City' }),
  type: z.string().meta({ description: 'Landmark type', example: 'point' }),
  color: z.string().nullable().meta({ description: 'Display color' }),
  size: z.string().nullable().meta({ description: 'Size category' }),
})

// Detail view schema - full data including properties
const landmarkDetailSchema = z.strictObject({
  id: z.string().meta({ description: 'Landmark ID', example: 'clx1234567890' }),
  mapId: z.string().meta({ description: 'Map ID', example: 'clx0987654321' }),
  x: z.number().meta({ description: 'X coordinate', example: 0.5 }),
  y: z.number().meta({ description: 'Y coordinate', example: 0.3 }),
  name: z.string().meta({ description: 'Landmark name', example: 'Capital City' }),
  description: z.string().meta({ description: 'Landmark description' }),
  type: z.string().meta({ description: 'Landmark type', example: 'point' }),
  color: z.string().nullable().meta({ description: 'Display color' }),
  size: z.string().nullable().meta({ description: 'Size category' }),
  properties: z.record(z.string(), z.any()).meta({ description: 'Custom properties' }),
})

const createLandmarkResponseSchema = z.strictObject({
  success: z.literal(true),
  landmark: landmarkDetailSchema,
})

const listLandmarksResponseSchema = z.strictObject({
  landmarks: z.array(landmarkListItemSchema).meta({ description: 'Map landmarks (minimal data)' }),
})

const getLandmarkResponseSchema = z.strictObject({
  landmark: landmarkDetailSchema,
})

const updateLandmarkResponseSchema = z.strictObject({
  success: z.literal(true),
  landmark: landmarkDetailSchema,
})

const deleteLandmarkResponseSchema = z.strictObject({
  success: z.literal(true),
})

const landmarkIdParamsSchema = z.strictObject({
  id: z.string().meta({ description: 'Landmark ID', example: 'clx1234567890' }),
})

const mapIdParamsSchema = z.strictObject({
  mapId: z.string().meta({ description: 'Map ID', example: 'clx1234567890' }),
})

const landmarkRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // All routes require authentication
  fastify.addHook('preHandler', requireAuth)

  // POST /my/maps/:mapId/landmarks - Create landmark for map
  fastify.post(
    '/maps/:mapId/landmarks',
    {
      schema: {
        description: 'Create a new landmark on a map',
        tags: ['maps', 'landmarks'],
        params: mapIdParamsSchema,
        body: createLandmarkBodySchema,
        response: {
          201: createLandmarkResponseSchema,
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { mapId } = request.params
      const { properties, ...coreData } = request.body
      const userId = request.user!.id

      // Verify map exists and user owns it
      const map = await prisma.map.findUnique({
        where: { id: mapId },
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

      // Create landmark
      const landmark = await prisma.landmark.create({
        data: {
          mapId,
          ...coreData,
          type: coreData.type || 'point',
          properties: properties || {},
        },
      })

      return reply.code(201).send({
        success: true as const,
        landmark: landmark as z.infer<typeof landmarkDetailSchema>,
      })
    },
  )

  // GET /my/maps/:mapId/landmarks - List landmarks for map (minimal data)
  fastify.get(
    '/maps/:mapId/landmarks',
    {
      schema: {
        description: 'List all landmarks on a map (minimal data for rendering)',
        tags: ['maps', 'landmarks'],
        params: mapIdParamsSchema,
        response: {
          200: listLandmarksResponseSchema,
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { mapId } = request.params
      const userId = request.user!.id

      // Verify map exists and user owns it
      const map = await prisma.map.findUnique({
        where: { id: mapId },
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

      // Get landmarks with minimal fields (no properties/description)
      const landmarks = await prisma.landmark.findMany({
        where: { mapId },
        select: {
          id: true,
          mapId: true,
          x: true,
          y: true,
          name: true,
          type: true,
          color: true,
          size: true,
        },
      })

      return reply.code(200).send({
        landmarks,
      })
    },
  )

  // GET /my/landmarks/:id - Get single landmark (full data)
  fastify.get(
    '/landmarks/:id',
    {
      schema: {
        description: 'Get a single landmark by ID (full data including properties)',
        tags: ['landmarks'],
        params: landmarkIdParamsSchema,
        response: {
          200: getLandmarkResponseSchema,
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

      // Get landmark with map/story ownership check
      const landmark = await prisma.landmark.findUnique({
        where: { id },
        include: {
          map: {
            include: {
              story: {
                select: { ownerId: true },
              },
            },
          },
        },
      })

      if (!landmark) {
        return reply.code(404).send({ error: 'Landmark not found' })
      }

      if (landmark.map.story.ownerId !== userId) {
        return reply.code(403).send({ error: 'Access denied' })
      }

      const { map, ...landmarkData } = landmark

      return reply.code(200).send({
        landmark: landmarkData as z.infer<typeof landmarkDetailSchema>,
      })
    },
  )

  // PUT /my/landmarks/:id - Update landmark
  fastify.put(
    '/landmarks/:id',
    {
      schema: {
        description: 'Update a landmark',
        tags: ['landmarks'],
        params: landmarkIdParamsSchema,
        body: updateLandmarkBodySchema,
        response: {
          200: updateLandmarkResponseSchema,
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params
      const { properties, ...coreData } = request.body
      const userId = request.user!.id

      // Get landmark with map/story ownership check
      const existingLandmark = await prisma.landmark.findUnique({
        where: { id },
        include: {
          map: {
            include: {
              story: {
                select: { ownerId: true },
              },
            },
          },
        },
      })

      if (!existingLandmark) {
        return reply.code(404).send({ error: 'Landmark not found' })
      }

      if (existingLandmark.map.story.ownerId !== userId) {
        return reply.code(403).send({ error: 'Access denied' })
      }

      // Merge properties if provided
      const existingProperties = (existingLandmark.properties as Record<string, unknown>) || {}
      const updatedProperties = properties ? { ...existingProperties, ...properties } : undefined

      // Update landmark
      const landmark = await prisma.landmark.update({
        where: { id },
        data: {
          ...coreData,
          ...(updatedProperties !== undefined && { properties: updatedProperties }),
        },
      })

      return reply.code(200).send({
        success: true as const,
        landmark: landmark as z.infer<typeof landmarkDetailSchema>,
      })
    },
  )

  // DELETE /my/landmarks/:id - Delete landmark
  fastify.delete(
    '/landmarks/:id',
    {
      schema: {
        description: 'Delete a landmark',
        tags: ['landmarks'],
        params: landmarkIdParamsSchema,
        response: {
          200: deleteLandmarkResponseSchema,
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

      // Get landmark with map/story ownership check
      const landmark = await prisma.landmark.findUnique({
        where: { id },
        include: {
          map: {
            include: {
              story: {
                select: { ownerId: true },
              },
            },
          },
        },
      })

      if (!landmark) {
        return reply.code(404).send({ error: 'Landmark not found' })
      }

      if (landmark.map.story.ownerId !== userId) {
        return reply.code(403).send({ error: 'Access denied' })
      }

      // Delete landmark
      await prisma.landmark.delete({
        where: { id },
      })

      return reply.code(200).send({
        success: true as const,
      })
    },
  )
}

export default landmarkRoutes
