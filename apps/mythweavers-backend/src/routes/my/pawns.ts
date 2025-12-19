import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { prisma } from '../../lib/prisma.js'
import { errorSchema } from '../../schemas/common.js'

// Schemas
const createPawnBodySchema = z.strictObject({
  name: z.string().min(1).meta({ description: 'Pawn name', example: 'Millennium Falcon' }),
  description: z.string().optional().meta({ description: 'Pawn description', example: 'Fast freighter' }),
  designation: z.string().optional().meta({ description: 'Designation/callsign', example: 'YT-1300' }),
  speed: z.number().optional().meta({ description: 'Speed rating (higher = faster)', example: 2.0 }),
  defaultX: z.number().meta({ description: 'Default X coordinate', example: 100.5 }),
  defaultY: z.number().meta({ description: 'Default Y coordinate', example: 200.3 }),
  color: z.string().optional().meta({ description: 'Display color (hex)', example: '#FFFF00' }),
  size: z.string().optional().meta({ description: 'Size category', example: 'small' }),
})

const updatePawnBodySchema = z.strictObject({
  name: z.string().min(1).optional().meta({ description: 'Pawn name' }),
  description: z.string().nullable().optional().meta({ description: 'Pawn description (null to remove)' }),
  designation: z.string().nullable().optional().meta({ description: 'Designation (null to remove)' }),
  speed: z.number().optional().meta({ description: 'Speed rating' }),
  defaultX: z.number().optional().meta({ description: 'Default X coordinate' }),
  defaultY: z.number().optional().meta({ description: 'Default Y coordinate' }),
  color: z.string().nullable().optional().meta({ description: 'Display color (null to remove)' }),
  size: z.string().nullable().optional().meta({ description: 'Size category (null to remove)' }),
})

const pawnSchema = z.strictObject({
  id: z.string().meta({ description: 'Pawn ID', example: 'clx1234567890' }),
  mapId: z.string().meta({ description: 'Map ID', example: 'clx0987654321' }),
  name: z.string().meta({ description: 'Pawn name', example: 'Millennium Falcon' }),
  description: z.string().nullable().meta({ description: 'Pawn description' }),
  designation: z.string().nullable().meta({ description: 'Designation/callsign' }),
  speed: z.number().meta({ description: 'Speed rating', example: 2.0 }),
  defaultX: z.number().meta({ description: 'Default X coordinate', example: 100.5 }),
  defaultY: z.number().meta({ description: 'Default Y coordinate', example: 200.3 }),
  color: z.string().nullable().meta({ description: 'Display color' }),
  size: z.string().nullable().meta({ description: 'Size category' }),
})

const createPawnResponseSchema = z.strictObject({
  success: z.literal(true),
  pawn: pawnSchema,
})

const listPawnsResponseSchema = z.strictObject({
  pawns: z.array(pawnSchema).meta({ description: 'Map pawns' }),
})

const getPawnResponseSchema = z.strictObject({
  pawn: pawnSchema,
})

const updatePawnResponseSchema = z.strictObject({
  success: z.literal(true),
  pawn: pawnSchema,
})

const deletePawnResponseSchema = z.strictObject({
  success: z.literal(true),
})

const pawnIdParamsSchema = z.strictObject({
  id: z.string().meta({ description: 'Pawn ID', example: 'clx1234567890' }),
})

const mapIdParamsSchema = z.strictObject({
  mapId: z.string().meta({ description: 'Map ID', example: 'clx1234567890' }),
})

const pawnRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // All routes require authentication
  fastify.addHook('preHandler', requireAuth)

  // POST /my/maps/:mapId/pawns - Create pawn for map
  fastify.post(
    '/maps/:mapId/pawns',
    {
      schema: {
        description: 'Create a new pawn on a map',
        tags: ['maps', 'pawns'],
        params: mapIdParamsSchema,
        body: createPawnBodySchema,
        response: {
          201: createPawnResponseSchema,
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { mapId } = request.params
      const pawnData = request.body
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

      // Create pawn
      const pawn = await prisma.pawn.create({
        data: {
          mapId,
          ...pawnData,
          speed: pawnData.speed ?? 1.0,
        },
      })

      return reply.code(201).send({
        success: true as const,
        pawn,
      })
    },
  )

  // GET /my/maps/:mapId/pawns - List pawns for map
  fastify.get(
    '/maps/:mapId/pawns',
    {
      schema: {
        description: 'List all pawns on a map',
        tags: ['maps', 'pawns'],
        params: mapIdParamsSchema,
        response: {
          200: listPawnsResponseSchema,
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
          pawns: true,
        },
      })

      if (!map) {
        return reply.code(404).send({ error: 'Map not found' })
      }

      if (map.story.ownerId !== userId) {
        return reply.code(403).send({ error: 'Access denied' })
      }

      return reply.code(200).send({
        pawns: map.pawns,
      })
    },
  )

  // GET /my/pawns/:id - Get single pawn
  fastify.get(
    '/pawns/:id',
    {
      schema: {
        description: 'Get a single pawn by ID',
        tags: ['pawns'],
        params: pawnIdParamsSchema,
        response: {
          200: getPawnResponseSchema,
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

      // Get pawn with map/story ownership check
      const pawn = await prisma.pawn.findUnique({
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

      if (!pawn) {
        return reply.code(404).send({ error: 'Pawn not found' })
      }

      if (pawn.map.story.ownerId !== userId) {
        return reply.code(403).send({ error: 'Access denied' })
      }

      const { map, ...pawnData } = pawn

      return reply.code(200).send({
        pawn: pawnData,
      })
    },
  )

  // PUT /my/pawns/:id - Update pawn
  fastify.put(
    '/pawns/:id',
    {
      schema: {
        description: 'Update a pawn',
        tags: ['pawns'],
        params: pawnIdParamsSchema,
        body: updatePawnBodySchema,
        response: {
          200: updatePawnResponseSchema,
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

      // Get pawn with map/story ownership check
      const existingPawn = await prisma.pawn.findUnique({
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

      if (!existingPawn) {
        return reply.code(404).send({ error: 'Pawn not found' })
      }

      if (existingPawn.map.story.ownerId !== userId) {
        return reply.code(403).send({ error: 'Access denied' })
      }

      // Update pawn
      const pawn = await prisma.pawn.update({
        where: { id },
        data: updateData,
      })

      return reply.code(200).send({
        success: true as const,
        pawn,
      })
    },
  )

  // DELETE /my/pawns/:id - Delete pawn
  fastify.delete(
    '/pawns/:id',
    {
      schema: {
        description: 'Delete a pawn',
        tags: ['pawns'],
        params: pawnIdParamsSchema,
        response: {
          200: deletePawnResponseSchema,
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

      // Get pawn with map/story ownership check
      const pawn = await prisma.pawn.findUnique({
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

      if (!pawn) {
        return reply.code(404).send({ error: 'Pawn not found' })
      }

      if (pawn.map.story.ownerId !== userId) {
        return reply.code(403).send({ error: 'Access denied' })
      }

      // Delete pawn (cascade will delete movements)
      await prisma.pawn.delete({
        where: { id },
      })

      return reply.code(200).send({
        success: true as const,
      })
    },
  )
}

export default pawnRoutes
