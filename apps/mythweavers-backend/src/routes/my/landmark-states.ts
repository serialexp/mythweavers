import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { prisma } from '../../lib/prisma.js'
import { transformDates } from '../../lib/transform-dates.js'
import { errorSchema } from '../../schemas/common.js'

// Schemas
const landmarkStateSchema = z.strictObject({
  id: z.string().meta({ description: 'State ID', example: 'clx1234567890' }),
  storyId: z.string().meta({ description: 'Story ID', example: 'clx0987654321' }),
  mapId: z.string().meta({ description: 'Map ID', example: 'clx111222333' }),
  landmarkId: z.string().meta({ description: 'Landmark ID', example: 'clx444555666' }),
  storyTime: z.number().nullable().meta({ description: 'Timeline position (minutes from epoch)', example: 0 }),
  field: z.string().meta({ description: 'State field name', example: 'allegiance' }),
  value: z.string().meta({ description: 'State value', example: 'republic' }),
  createdAt: z.string().datetime().meta({ description: 'Creation timestamp', example: '2025-12-05T12:00:00.000Z' }),
  updatedAt: z.string().datetime().meta({ description: 'Last update timestamp', example: '2025-12-05T12:00:00.000Z' }),
})

const upsertLandmarkStateBodySchema = z.strictObject({
  storyTime: z.number().meta({ description: 'Timeline position (minutes from epoch)', example: 0 }),
  field: z.string().min(1).meta({ description: 'State field name', example: 'allegiance' }),
  value: z.string().nullable().meta({ description: 'State value (null to delete)', example: 'republic' }),
})

const storyIdParamsSchema = z.strictObject({
  storyId: z.string().meta({ description: 'Story ID', example: 'clx1234567890' }),
})

const landmarkIdParamsSchema = z.strictObject({
  landmarkId: z.string().meta({ description: 'Landmark ID', example: 'clx1234567890' }),
})

const storyTimeParamsSchema = z.strictObject({
  storyId: z.string().meta({ description: 'Story ID', example: 'clx1234567890' }),
  storyTime: z.coerce.number().meta({ description: 'Timeline position (minutes from epoch)', example: '0' }),
})

const deleteStateParamsSchema = z.strictObject({
  landmarkId: z.string().meta({ description: 'Landmark ID', example: 'clx1234567890' }),
  field: z.string().meta({ description: 'State field name', example: 'allegiance' }),
  storyTime: z.coerce.number().meta({ description: 'Timeline position', example: '0' }),
})

const listStatesQuerySchema = z.strictObject({
  mapId: z.string().optional().meta({ description: 'Filter by map ID', example: 'clx1234567890' }),
})

const listLandmarkStatesResponseSchema = z.strictObject({
  states: z.array(landmarkStateSchema).meta({ description: 'Landmark states' }),
})

const accumulatedStatesResponseSchema = z.strictObject({
  states: z.array(landmarkStateSchema).meta({ description: 'Accumulated states at the specified storyTime' }),
})

const upsertStateResponseSchema = z.strictObject({
  success: z.literal(true),
  state: landmarkStateSchema.optional(),
  deleted: z.boolean().optional(),
})

const deleteStateResponseSchema = z.strictObject({
  success: z.literal(true),
})

const landmarkStateRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // All routes require authentication
  fastify.addHook('preHandler', requireAuth)

  // GET /my/stories/:storyId/landmark-states - Get all landmark states for a story
  fastify.get(
    '/stories/:storyId/landmark-states',
    {
      schema: {
        description: 'Get all landmark states for a story',
        tags: ['landmark-states'],
        params: storyIdParamsSchema,
        querystring: listStatesQuerySchema,
        response: {
          200: listLandmarkStatesResponseSchema,
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { storyId } = request.params
      const { mapId } = request.query
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

      // Get all states for the story
      const states = await prisma.landmarkState.findMany({
        where: {
          storyId,
          ...(mapId && { mapId }),
        },
        orderBy: [{ storyTime: 'asc' }, { field: 'asc' }],
      })

      return reply.code(200).send({
        states: states.map(transformDates),
      })
    },
  )

  // GET /my/stories/:storyId/landmark-states/at/:storyTime - Get accumulated states at a storyTime
  fastify.get(
    '/stories/:storyId/landmark-states/at/:storyTime',
    {
      schema: {
        description: 'Get accumulated landmark states at a specific story time',
        tags: ['landmark-states'],
        params: storyTimeParamsSchema,
        querystring: listStatesQuerySchema,
        response: {
          200: accumulatedStatesResponseSchema,
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { storyId, storyTime } = request.params
      const { mapId } = request.query
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

      // Get all states at or before the specified storyTime
      // Then accumulate by taking the latest one for each (mapId, landmarkId, field)
      const allStates = await prisma.landmarkState.findMany({
        where: {
          storyId,
          ...(mapId && { mapId }),
          OR: [{ storyTime: null }, { storyTime: { lte: storyTime } }],
        },
        orderBy: [{ storyTime: 'desc' }],
      })

      // Accumulate: keep only the latest state for each (mapId, landmarkId, field) combination
      const accumulated = new Map<string, (typeof allStates)[0]>()
      for (const state of allStates) {
        const key = `${state.mapId}:${state.landmarkId}:${state.field}`
        if (!accumulated.has(key)) {
          accumulated.set(key, state)
        }
      }
      const states = Array.from(accumulated.values())

      return reply.code(200).send({
        states: states.map(transformDates),
      })
    },
  )

  // POST /my/landmarks/:landmarkId/states - Create or update a landmark state
  fastify.post(
    '/landmarks/:landmarkId/states',
    {
      schema: {
        description: 'Create or update a landmark state at a specific story time',
        tags: ['landmark-states'],
        params: landmarkIdParamsSchema,
        body: upsertLandmarkStateBodySchema,
        response: {
          200: upsertStateResponseSchema,
          201: upsertStateResponseSchema,
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { landmarkId } = request.params
      const { storyTime, field, value } = request.body
      const userId = request.user!.id

      // Get landmark with map/story ownership check
      const landmark = await prisma.landmark.findUnique({
        where: { id: landmarkId },
        include: {
          map: {
            include: {
              story: {
                select: { id: true, ownerId: true },
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

      const storyId = landmark.map.story.id
      const mapId = landmark.mapId

      // If value is null, delete the state
      if (value === null) {
        await prisma.landmarkState.deleteMany({
          where: {
            mapId,
            landmarkId,
            storyTime,
            field,
          },
        })

        return reply.code(200).send({
          success: true as const,
          deleted: true,
        })
      }

      // Upsert the state
      const state = await prisma.landmarkState.upsert({
        where: {
          mapId_landmarkId_storyTime_field: {
            mapId,
            landmarkId,
            storyTime,
            field,
          },
        },
        update: {
          value,
        },
        create: {
          storyId,
          mapId,
          landmarkId,
          storyTime,
          field,
          value,
        },
      })

      return reply.code(201).send({
        success: true as const,
        state: transformDates(state),
      })
    },
  )

  // DELETE /my/landmarks/:landmarkId/states/:field/:storyTime - Delete a landmark state
  fastify.delete(
    '/landmarks/:landmarkId/states/:field/:storyTime',
    {
      schema: {
        description: 'Delete a landmark state at a specific story time',
        tags: ['landmark-states'],
        params: deleteStateParamsSchema,
        response: {
          200: deleteStateResponseSchema,
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { landmarkId, field, storyTime } = request.params
      const userId = request.user!.id

      // Get landmark with map/story ownership check
      const landmark = await prisma.landmark.findUnique({
        where: { id: landmarkId },
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

      // Delete the state
      await prisma.landmarkState.deleteMany({
        where: {
          mapId: landmark.mapId,
          landmarkId,
          storyTime,
          field,
        },
      })

      return reply.code(200).send({
        success: true as const,
      })
    },
  )
}

export default landmarkStateRoutes
