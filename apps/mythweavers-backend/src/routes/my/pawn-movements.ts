import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { CLIENT_ID_CONFLICT_MESSAGE, isUniqueConstraintError, resolveClientId } from '../../lib/client-id.js'
import { prisma } from '../../lib/prisma.js'
import { transformDates } from '../../lib/transform-dates.js'
import { errorSchema } from '../../schemas/common.js'

// Schemas

/**
 * Note the absence of `storyId`: a movement's story is whatever story owns the
 * pawn's map, so it is derived server-side rather than accepted from the client.
 * Taking it from the body would let a caller file a movement under a story it has
 * nothing to do with, and the column is what the story-scoped queries index on.
 */
const createPawnMovementBodySchema = z
  .strictObject({
    id: z
      .string()
      .min(1)
      .max(64)
      .optional()
      .meta({ description: 'Optional client-provided ID (generated if omitted)', example: 'clx1234567890' }),
    startStoryTime: z.number().int().meta({ description: 'Departure time in story minutes', example: 0 }),
    endStoryTime: z.number().int().meta({ description: 'Arrival time in story minutes', example: 120 }),
    startX: z.number().meta({ description: 'Start X coordinate (0-1 normalized)', example: 0.25 }),
    startY: z.number().meta({ description: 'Start Y coordinate (0-1 normalized)', example: 0.4 }),
    endX: z.number().meta({ description: 'End X coordinate (0-1 normalized)', example: 0.75 }),
    endY: z.number().meta({ description: 'End Y coordinate (0-1 normalized)', example: 0.6 }),
  })
  .refine((body) => body.endStoryTime >= body.startStoryTime, {
    message: 'endStoryTime must be greater than or equal to startStoryTime',
    path: ['endStoryTime'],
  })

/**
 * Partial, so the start/end ordering cannot be checked here -- the handler checks it
 * against the merged values. Neither `pawnId` nor `storyId` is updatable: moving a
 * movement to another pawn is a delete plus a create, not an edit.
 */
const updatePawnMovementBodySchema = z.strictObject({
  startStoryTime: z.number().int().optional().meta({ description: 'Departure time in story minutes' }),
  endStoryTime: z.number().int().optional().meta({ description: 'Arrival time in story minutes' }),
  startX: z.number().optional().meta({ description: 'Start X coordinate (0-1 normalized)' }),
  startY: z.number().optional().meta({ description: 'Start Y coordinate (0-1 normalized)' }),
  endX: z.number().optional().meta({ description: 'End X coordinate (0-1 normalized)' }),
  endY: z.number().optional().meta({ description: 'End Y coordinate (0-1 normalized)' }),
})

const pawnMovementSchema = z.strictObject({
  id: z.string().meta({ description: 'Movement ID', example: 'clx1234567890' }),
  storyId: z.string().meta({ description: 'Story ID (derived from the pawn)', example: 'clx0987654321' }),
  mapId: z.string().meta({ description: 'Map ID', example: 'clx1111111111' }),
  pawnId: z.string().meta({ description: 'Pawn ID', example: 'clx2222222222' }),
  startStoryTime: z.number().int().meta({ description: 'Departure time in story minutes', example: 0 }),
  endStoryTime: z.number().int().meta({ description: 'Arrival time in story minutes', example: 120 }),
  startX: z.number().meta({ description: 'Start X coordinate (0-1 normalized)', example: 0.25 }),
  startY: z.number().meta({ description: 'Start Y coordinate (0-1 normalized)', example: 0.4 }),
  endX: z.number().meta({ description: 'End X coordinate (0-1 normalized)', example: 0.75 }),
  endY: z.number().meta({ description: 'End Y coordinate (0-1 normalized)', example: 0.6 }),
  createdAt: z.string().datetime().meta({ description: 'Creation timestamp', example: '2025-12-05T12:00:00.000Z' }),
  updatedAt: z.string().datetime().meta({ description: 'Last update timestamp', example: '2025-12-05T12:00:00.000Z' }),
})

const createPawnMovementResponseSchema = z.strictObject({
  success: z.literal(true),
  movement: pawnMovementSchema,
})

const listPawnMovementsResponseSchema = z.strictObject({
  movements: z.array(pawnMovementSchema).meta({ description: 'Pawn movements (sorted by start time)' }),
})

const getPawnMovementResponseSchema = z.strictObject({
  movement: pawnMovementSchema,
})

const updatePawnMovementResponseSchema = z.strictObject({
  success: z.literal(true),
  movement: pawnMovementSchema,
})

const deletePawnMovementResponseSchema = z.strictObject({
  success: z.literal(true),
})

const movementIdParamsSchema = z.strictObject({
  id: z.string().meta({ description: 'Pawn movement ID', example: 'clx1234567890' }),
})

const pawnIdParamsSchema = z.strictObject({
  pawnId: z.string().meta({ description: 'Pawn ID', example: 'clx1234567890' }),
})

const mapIdParamsSchema = z.strictObject({
  mapId: z.string().meta({ description: 'Map ID', example: 'clx1234567890' }),
})

const START_TIME_ORDER_MESSAGE = 'endStoryTime must be greater than or equal to startStoryTime'

const pawnMovementRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // All routes require authentication
  fastify.addHook('preHandler', requireAuth)

  // POST /my/pawns/:pawnId/movements - Create a movement for a pawn
  //
  // Deliberately does NOT reject movements that overlap existing ones. Whether a
  // pawn may be given a new leg while it is already in transit is an authoring
  // policy, and it lives in the editor (which offers shift-to-chain and refuses
  // otherwise). Chained legs share an instant -- one ends exactly where the next
  // begins -- so a naive interval check would reject the very shape the editor
  // produces, and would also make a valid story export un-importable.
  fastify.post(
    '/pawns/:pawnId/movements',
    {
      schema: {
        description: 'Create a movement for a pawn',
        tags: ['maps', 'pawns', 'movements'],
        params: pawnIdParamsSchema,
        body: createPawnMovementBodySchema,
        response: {
          201: createPawnMovementResponseSchema,
          400: errorSchema,
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { pawnId } = request.params
      const { id, ...movementData } = request.body
      const userId = request.user!.id

      const pawn = await prisma.pawn.findUnique({
        where: { id: pawnId },
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

      if (!pawn) {
        return reply.code(404).send({ error: 'Pawn not found' })
      }

      if (pawn.map.story.ownerId !== userId) {
        return reply.code(403).send({ error: 'Access denied' })
      }

      // A client-provided ID that already names a movement is a retried create, not
      // an error -- see src/lib/client-id.ts.
      const clientId = await resolveClientId({
        id,
        find: (movementId) => prisma.pawnMovement.findUnique({ where: { id: movementId } }),
        inScope: (existing) => existing.pawnId === pawnId,
      })

      if (clientId.status === 'conflict') {
        return reply.code(400).send({ error: CLIENT_ID_CONFLICT_MESSAGE })
      }

      if (clientId.status === 'replay') {
        return reply.code(201).send({
          success: true as const,
          movement: transformDates(clientId.existing),
        })
      }

      try {
        const movement = await prisma.pawnMovement.create({
          data: {
            id,
            pawnId,
            mapId: pawn.mapId,
            storyId: pawn.map.storyId,
            ...movementData,
          },
        })

        return reply.code(201).send({
          success: true as const,
          movement: transformDates(movement),
        })
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          return reply.code(400).send({ error: CLIENT_ID_CONFLICT_MESSAGE })
        }
        throw error
      }
    },
  )

  // GET /my/pawns/:pawnId/movements - List movements for a pawn
  fastify.get(
    '/pawns/:pawnId/movements',
    {
      schema: {
        description: 'List all movements for a pawn',
        tags: ['maps', 'pawns', 'movements'],
        params: pawnIdParamsSchema,
        response: {
          200: listPawnMovementsResponseSchema,
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { pawnId } = request.params
      const userId = request.user!.id

      const pawn = await prisma.pawn.findUnique({
        where: { id: pawnId },
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

      if (!pawn) {
        return reply.code(404).send({ error: 'Pawn not found' })
      }

      if (pawn.map.story.ownerId !== userId) {
        return reply.code(403).send({ error: 'Access denied' })
      }

      const movements = await prisma.pawnMovement.findMany({
        where: { pawnId },
        orderBy: { startStoryTime: 'asc' },
      })

      return reply.code(200).send({
        movements: movements.map((movement) => transformDates(movement)),
      })
    },
  )

  // GET /my/maps/:mapId/pawn-movements - List movements for every pawn on a map
  //
  // This is what the editor calls when it opens a map: one request for the whole
  // board, rather than one per pawn.
  fastify.get(
    '/maps/:mapId/pawn-movements',
    {
      schema: {
        description: 'List all pawn movements on a map',
        tags: ['maps', 'pawns', 'movements'],
        params: mapIdParamsSchema,
        response: {
          200: listPawnMovementsResponseSchema,
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

      const movements = await prisma.pawnMovement.findMany({
        where: { mapId },
        orderBy: [{ pawnId: 'asc' }, { startStoryTime: 'asc' }],
      })

      return reply.code(200).send({
        movements: movements.map((movement) => transformDates(movement)),
      })
    },
  )

  // GET /my/pawn-movements/:id - Get a single movement
  fastify.get(
    '/pawn-movements/:id',
    {
      schema: {
        description: 'Get a single pawn movement by ID',
        tags: ['movements'],
        params: movementIdParamsSchema,
        response: {
          200: getPawnMovementResponseSchema,
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

      const movement = await prisma.pawnMovement.findUnique({ where: { id } })

      if (!movement) {
        return reply.code(404).send({ error: 'Pawn movement not found' })
      }

      if (!(await ownsMovement(movement.mapId, userId))) {
        return reply.code(403).send({ error: 'Access denied' })
      }

      return reply.code(200).send({
        movement: transformDates(movement),
      })
    },
  )

  // PUT /my/pawn-movements/:id - Update a movement
  fastify.put(
    '/pawn-movements/:id',
    {
      schema: {
        description: 'Update a pawn movement',
        tags: ['movements'],
        params: movementIdParamsSchema,
        body: updatePawnMovementBodySchema,
        response: {
          200: updatePawnMovementResponseSchema,
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
      const updateData = request.body
      const userId = request.user!.id

      const existing = await prisma.pawnMovement.findUnique({ where: { id } })

      if (!existing) {
        return reply.code(404).send({ error: 'Pawn movement not found' })
      }

      if (!(await ownsMovement(existing.mapId, userId))) {
        return reply.code(403).send({ error: 'Access denied' })
      }

      // The body is partial, so the invariant has to be checked against what the row
      // will actually look like -- moving only the start time can invert the pair.
      const startStoryTime = updateData.startStoryTime ?? existing.startStoryTime
      const endStoryTime = updateData.endStoryTime ?? existing.endStoryTime
      if (endStoryTime < startStoryTime) {
        return reply.code(400).send({ error: START_TIME_ORDER_MESSAGE })
      }

      const movement = await prisma.pawnMovement.update({
        where: { id },
        data: updateData,
      })

      return reply.code(200).send({
        success: true as const,
        movement: transformDates(movement),
      })
    },
  )

  // DELETE /my/pawn-movements/:id - Delete a movement
  fastify.delete(
    '/pawn-movements/:id',
    {
      schema: {
        description: 'Delete a pawn movement',
        tags: ['movements'],
        params: movementIdParamsSchema,
        response: {
          200: deletePawnMovementResponseSchema,
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

      const movement = await prisma.pawnMovement.findUnique({ where: { id } })

      if (!movement) {
        return reply.code(404).send({ error: 'Pawn movement not found' })
      }

      if (!(await ownsMovement(movement.mapId, userId))) {
        return reply.code(403).send({ error: 'Access denied' })
      }

      await prisma.pawnMovement.delete({ where: { id } })

      return reply.code(200).send({
        success: true as const,
      })
    },
  )
}

/**
 * PawnMovement has no relation to Map (it points at its pawn through a composite
 * key), so ownership is resolved through the movement's own mapId.
 */
async function ownsMovement(mapId: string, userId: number): Promise<boolean> {
  const map = await prisma.map.findUnique({
    where: { id: mapId },
    include: { story: { select: { ownerId: true } } },
  })

  return map?.story.ownerId === userId
}

export default pawnMovementRoutes
