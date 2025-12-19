import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { prisma } from '../../lib/prisma.js'
import { transformDates } from '../../lib/transform-dates.js'
import { errorSchema } from '../../schemas/common.js'

// Schemas
const createPathBodySchema = z.strictObject({
  speedMultiplier: z
    .number()
    .optional()
    .meta({ description: 'Speed multiplier for travel along this path', example: 10.0 }),
})

const updatePathBodySchema = z.strictObject({
  speedMultiplier: z.number().optional().meta({ description: 'Speed multiplier for travel along this path' }),
})

const pathSchema = z.strictObject({
  id: z.string().meta({ description: 'Path ID', example: 'clx1234567890' }),
  mapId: z.string().meta({ description: 'Map ID', example: 'clx0987654321' }),
  speedMultiplier: z.number().meta({ description: 'Speed multiplier', example: 10.0 }),
  createdAt: z.string().meta({ description: 'Creation timestamp', example: '2025-12-05T12:00:00.000Z' }),
  updatedAt: z.string().meta({ description: 'Last update timestamp', example: '2025-12-05T12:00:00.000Z' }),
})

const createPathResponseSchema = z.strictObject({
  success: z.literal(true),
  path: pathSchema,
})

const listPathsResponseSchema = z.strictObject({
  paths: z.array(pathSchema).meta({ description: 'Map paths' }),
})

const getPathResponseSchema = z.strictObject({
  path: pathSchema,
})

const updatePathResponseSchema = z.strictObject({
  success: z.literal(true),
  path: pathSchema,
})

const deletePathResponseSchema = z.strictObject({
  success: z.literal(true),
})

const pathIdParamsSchema = z.strictObject({
  id: z.string().meta({ description: 'Path ID', example: 'clx1234567890' }),
})

const mapIdParamsSchema = z.strictObject({
  mapId: z.string().meta({ description: 'Map ID', example: 'clx1234567890' }),
})

const pathRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // All routes require authentication
  fastify.addHook('preHandler', requireAuth)

  // POST /my/maps/:mapId/paths - Create path for map
  fastify.post(
    '/maps/:mapId/paths',
    {
      schema: {
        description: 'Create a new path on a map',
        tags: ['maps', 'paths'],
        params: mapIdParamsSchema,
        body: createPathBodySchema,
        response: {
          201: createPathResponseSchema,
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { mapId } = request.params
      const { speedMultiplier } = request.body
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

      // Create path
      const path = await prisma.path.create({
        data: {
          mapId,
          speedMultiplier: speedMultiplier ?? 10.0,
        },
      })

      return reply.code(201).send({
        success: true as const,
        path: transformDates(path),
      })
    },
  )

  // GET /my/maps/:mapId/paths - List paths for map
  fastify.get(
    '/maps/:mapId/paths',
    {
      schema: {
        description: 'List all paths on a map',
        tags: ['maps', 'paths'],
        params: mapIdParamsSchema,
        response: {
          200: listPathsResponseSchema,
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
          paths: true,
        },
      })

      if (!map) {
        return reply.code(404).send({ error: 'Map not found' })
      }

      if (map.story.ownerId !== userId) {
        return reply.code(403).send({ error: 'Access denied' })
      }

      return reply.code(200).send({
        paths: map.paths.map(transformDates),
      })
    },
  )

  // GET /my/paths/:id - Get single path
  fastify.get(
    '/paths/:id',
    {
      schema: {
        description: 'Get a single path by ID',
        tags: ['paths'],
        params: pathIdParamsSchema,
        response: {
          200: getPathResponseSchema,
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

      // Get path with map/story ownership check
      const path = await prisma.path.findUnique({
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

      if (!path) {
        return reply.code(404).send({ error: 'Path not found' })
      }

      if (path.map.story.ownerId !== userId) {
        return reply.code(403).send({ error: 'Access denied' })
      }

      const { map, ...pathData } = path

      return reply.code(200).send({
        path: transformDates(pathData),
      })
    },
  )

  // PUT /my/paths/:id - Update path
  fastify.put(
    '/paths/:id',
    {
      schema: {
        description: 'Update a path',
        tags: ['paths'],
        params: pathIdParamsSchema,
        body: updatePathBodySchema,
        response: {
          200: updatePathResponseSchema,
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

      // Get path with map/story ownership check
      const existingPath = await prisma.path.findUnique({
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

      if (!existingPath) {
        return reply.code(404).send({ error: 'Path not found' })
      }

      if (existingPath.map.story.ownerId !== userId) {
        return reply.code(403).send({ error: 'Access denied' })
      }

      // Update path
      const path = await prisma.path.update({
        where: { id },
        data: updateData,
      })

      return reply.code(200).send({
        success: true as const,
        path: transformDates(path),
      })
    },
  )

  // DELETE /my/paths/:id - Delete path
  fastify.delete(
    '/paths/:id',
    {
      schema: {
        description: 'Delete a path',
        tags: ['paths'],
        params: pathIdParamsSchema,
        response: {
          200: deletePathResponseSchema,
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

      // Get path with map/story ownership check
      const path = await prisma.path.findUnique({
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

      if (!path) {
        return reply.code(404).send({ error: 'Path not found' })
      }

      if (path.map.story.ownerId !== userId) {
        return reply.code(403).send({ error: 'Access denied' })
      }

      // Delete path (cascade will delete segments)
      await prisma.path.delete({
        where: { id },
      })

      return reply.code(200).send({
        success: true as const,
      })
    },
  )
}

export default pathRoutes
