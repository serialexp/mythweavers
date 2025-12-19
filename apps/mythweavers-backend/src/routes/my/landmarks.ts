import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { prisma } from '../../lib/prisma.js'
import { errorSchema } from '../../schemas/common.js'

// Schemas
const createLandmarkBodySchema = z.strictObject({
  x: z.number().meta({ description: 'X coordinate', example: 100.5 }),
  y: z.number().meta({ description: 'Y coordinate', example: 200.3 }),
  name: z.string().min(1).meta({ description: 'Landmark name', example: 'Coruscant' }),
  description: z.string().meta({ description: 'Landmark description', example: 'Capital of the Republic' }),
  type: z.string().optional().meta({ description: 'Landmark type', example: 'system' }),
  population: z.string().optional().meta({ description: 'Population', example: '1 trillion' }),
  industry: z.string().optional().meta({ description: 'Industry type', example: 'political' }),
  color: z.string().optional().meta({ description: 'Display color (hex)', example: '#00FF00' }),
  size: z.string().optional().meta({ description: 'Size category', example: 'large' }),
  region: z.string().optional().meta({ description: 'Region name', example: 'Core Worlds' }),
  sector: z.string().optional().meta({ description: 'Sector name', example: 'Coruscant Sector' }),
  planetaryBodies: z.string().optional().meta({ description: 'Planetary bodies info', example: '4 moons' }),
})

const updateLandmarkBodySchema = z.strictObject({
  x: z.number().optional().meta({ description: 'X coordinate' }),
  y: z.number().optional().meta({ description: 'Y coordinate' }),
  name: z.string().min(1).optional().meta({ description: 'Landmark name' }),
  description: z.string().optional().meta({ description: 'Landmark description' }),
  type: z.string().optional().meta({ description: 'Landmark type' }),
  population: z.string().nullable().optional().meta({ description: 'Population (null to remove)' }),
  industry: z.string().nullable().optional().meta({ description: 'Industry type (null to remove)' }),
  color: z.string().nullable().optional().meta({ description: 'Display color (null to remove)' }),
  size: z.string().nullable().optional().meta({ description: 'Size category (null to remove)' }),
  region: z.string().nullable().optional().meta({ description: 'Region name (null to remove)' }),
  sector: z.string().nullable().optional().meta({ description: 'Sector name (null to remove)' }),
  planetaryBodies: z.string().nullable().optional().meta({ description: 'Planetary bodies info (null to remove)' }),
})

const landmarkSchema = z.strictObject({
  id: z.string().meta({ description: 'Landmark ID', example: 'clx1234567890' }),
  mapId: z.string().meta({ description: 'Map ID', example: 'clx0987654321' }),
  x: z.number().meta({ description: 'X coordinate', example: 100.5 }),
  y: z.number().meta({ description: 'Y coordinate', example: 200.3 }),
  name: z.string().meta({ description: 'Landmark name', example: 'Coruscant' }),
  description: z.string().meta({ description: 'Landmark description' }),
  type: z.string().meta({ description: 'Landmark type', example: 'system' }),
  population: z.string().nullable().meta({ description: 'Population' }),
  industry: z.string().nullable().meta({ description: 'Industry type' }),
  color: z.string().nullable().meta({ description: 'Display color' }),
  size: z.string().nullable().meta({ description: 'Size category' }),
  region: z.string().nullable().meta({ description: 'Region name' }),
  sector: z.string().nullable().meta({ description: 'Sector name' }),
  planetaryBodies: z.string().nullable().meta({ description: 'Planetary bodies info' }),
})

const createLandmarkResponseSchema = z.strictObject({
  success: z.literal(true),
  landmark: landmarkSchema,
})

const listLandmarksResponseSchema = z.strictObject({
  landmarks: z.array(landmarkSchema).meta({ description: 'Map landmarks' }),
})

const getLandmarkResponseSchema = z.strictObject({
  landmark: landmarkSchema,
})

const updateLandmarkResponseSchema = z.strictObject({
  success: z.literal(true),
  landmark: landmarkSchema,
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
      const landmarkData = request.body
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
          ...landmarkData,
          type: landmarkData.type || 'system',
        },
      })

      return reply.code(201).send({
        success: true as const,
        landmark,
      })
    },
  )

  // GET /my/maps/:mapId/landmarks - List landmarks for map
  fastify.get(
    '/maps/:mapId/landmarks',
    {
      schema: {
        description: 'List all landmarks on a map',
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
          landmarks: true,
        },
      })

      if (!map) {
        return reply.code(404).send({ error: 'Map not found' })
      }

      if (map.story.ownerId !== userId) {
        return reply.code(403).send({ error: 'Access denied' })
      }

      return reply.code(200).send({
        landmarks: map.landmarks,
      })
    },
  )

  // GET /my/landmarks/:id - Get single landmark
  fastify.get(
    '/landmarks/:id',
    {
      schema: {
        description: 'Get a single landmark by ID',
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
        landmark: landmarkData,
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
      const updateData = request.body
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

      // Update landmark
      const landmark = await prisma.landmark.update({
        where: { id },
        data: updateData,
      })

      return reply.code(200).send({
        success: true as const,
        landmark,
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
