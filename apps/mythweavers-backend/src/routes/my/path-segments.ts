import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { CLIENT_ID_CONFLICT_MESSAGE, isUniqueConstraintError, resolveClientId } from '../../lib/client-id.js'
import { prisma } from '../../lib/prisma.js'
import { transformDates } from '../../lib/transform-dates.js'
import { errorSchema } from '../../schemas/common.js'

// Schemas
const createPathSegmentBodySchema = z.strictObject({
  id: z
    .string()
    .min(1)
    .max(64)
    .optional()
    .meta({ description: 'Optional client-provided ID (generated if omitted)', example: 'clx1234567890' }),
  order: z.number().int().min(0).meta({ description: 'Segment order in path', example: 0 }),
  startX: z.number().meta({ description: 'Start X coordinate', example: 100.5 }),
  startY: z.number().meta({ description: 'Start Y coordinate', example: 200.3 }),
  endX: z.number().meta({ description: 'End X coordinate', example: 150.2 }),
  endY: z.number().meta({ description: 'End Y coordinate', example: 250.8 }),
  startLandmarkId: z.string().optional().meta({ description: 'Start landmark ID (optional)', example: 'clx123' }),
  endLandmarkId: z.string().optional().meta({ description: 'End landmark ID (optional)', example: 'clx456' }),
})

/**
 * One segment inside a bulk replace. Unlike the single-segment create this has no
 * `pathId` -- the path comes from the URL, and a segment cannot move between paths.
 */
const replacePathSegmentSchema = z.strictObject({
  id: z
    .string()
    .min(1)
    .max(64)
    .optional()
    .meta({ description: 'Segment ID; existing segments keep theirs, new ones may supply one', example: 'clx123' }),
  order: z.number().int().min(0).meta({ description: 'Segment order in path', example: 0 }),
  startX: z.number().meta({ description: 'Start X coordinate', example: 100.5 }),
  startY: z.number().meta({ description: 'Start Y coordinate', example: 200.3 }),
  endX: z.number().meta({ description: 'End X coordinate', example: 150.2 }),
  endY: z.number().meta({ description: 'End Y coordinate', example: 250.8 }),
  startLandmarkId: z.string().nullish().meta({ description: 'Start landmark ID (optional)', example: 'clx123' }),
  endLandmarkId: z.string().nullish().meta({ description: 'End landmark ID (optional)', example: 'clx456' }),
})

const replacePathSegmentsBodySchema = z.strictObject({
  segments: z
    .array(replacePathSegmentSchema)
    .meta({ description: 'The complete segment list for this path; anything omitted is deleted' }),
})

const updatePathSegmentBodySchema = z.strictObject({
  order: z.number().int().min(0).optional().meta({ description: 'Segment order in path' }),
  startX: z.number().optional().meta({ description: 'Start X coordinate' }),
  startY: z.number().optional().meta({ description: 'Start Y coordinate' }),
  endX: z.number().optional().meta({ description: 'End X coordinate' }),
  endY: z.number().optional().meta({ description: 'End Y coordinate' }),
  startLandmarkId: z.string().nullable().optional().meta({ description: 'Start landmark ID (null to remove)' }),
  endLandmarkId: z.string().nullable().optional().meta({ description: 'End landmark ID (null to remove)' }),
})

const pathSegmentSchema = z.strictObject({
  id: z.string().meta({ description: 'Segment ID', example: 'clx1234567890' }),
  pathId: z.string().meta({ description: 'Path ID', example: 'clx0987654321' }),
  mapId: z.string().meta({ description: 'Map ID', example: 'clx1111111111' }),
  order: z.number().int().meta({ description: 'Segment order', example: 0 }),
  startX: z.number().meta({ description: 'Start X coordinate', example: 100.5 }),
  startY: z.number().meta({ description: 'Start Y coordinate', example: 200.3 }),
  endX: z.number().meta({ description: 'End X coordinate', example: 150.2 }),
  endY: z.number().meta({ description: 'End Y coordinate', example: 250.8 }),
  startLandmarkId: z.string().nullable().meta({ description: 'Start landmark ID' }),
  endLandmarkId: z.string().nullable().meta({ description: 'End landmark ID' }),
  createdAt: z.string().datetime().meta({ description: 'Creation timestamp', example: '2025-12-05T12:00:00.000Z' }),
  updatedAt: z.string().datetime().meta({ description: 'Last update timestamp', example: '2025-12-05T12:00:00.000Z' }),
})

const createPathSegmentResponseSchema = z.strictObject({
  success: z.literal(true),
  segment: pathSegmentSchema,
})

const replacePathSegmentsResponseSchema = z.strictObject({
  success: z.literal(true),
  segments: z.array(pathSegmentSchema).meta({ description: 'The reconciled segment list (sorted by order)' }),
})

const listPathSegmentsResponseSchema = z.strictObject({
  segments: z.array(pathSegmentSchema).meta({ description: 'Path segments (sorted by order)' }),
})

const getPathSegmentResponseSchema = z.strictObject({
  segment: pathSegmentSchema,
})

const updatePathSegmentResponseSchema = z.strictObject({
  success: z.literal(true),
  segment: pathSegmentSchema,
})

const deletePathSegmentResponseSchema = z.strictObject({
  success: z.literal(true),
})

const pathSegmentIdParamsSchema = z.strictObject({
  id: z.string().meta({ description: 'Path segment ID', example: 'clx1234567890' }),
})

const pathIdParamsSchema = z.strictObject({
  pathId: z.string().meta({ description: 'Path ID', example: 'clx1234567890' }),
})

const pathSegmentRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // All routes require authentication
  fastify.addHook('preHandler', requireAuth)

  // POST /my/paths/:pathId/segments - Create segment for path
  fastify.post(
    '/paths/:pathId/segments',
    {
      schema: {
        description: 'Create a new segment for a path',
        tags: ['maps', 'paths', 'segments'],
        params: pathIdParamsSchema,
        body: createPathSegmentBodySchema,
        response: {
          201: createPathSegmentResponseSchema,
          400: errorSchema,
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { pathId } = request.params
      const { id, ...segmentData } = request.body
      const userId = request.user!.id

      // Verify path exists and user owns it
      const path = await prisma.path.findUnique({
        where: { id: pathId },
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

      // If landmark IDs provided, verify they exist on the same map
      if (segmentData.startLandmarkId) {
        const landmark = await prisma.landmark.findUnique({
          where: { id: segmentData.startLandmarkId },
          select: { mapId: true },
        })
        if (!landmark || landmark.mapId !== path.mapId) {
          return reply.code(400).send({ error: 'Invalid start landmark ID' })
        }
      }

      if (segmentData.endLandmarkId) {
        const landmark = await prisma.landmark.findUnique({
          where: { id: segmentData.endLandmarkId },
          select: { mapId: true },
        })
        if (!landmark || landmark.mapId !== path.mapId) {
          return reply.code(400).send({ error: 'Invalid end landmark ID' })
        }
      }

      // A client-provided ID that already names a segment is a retried create, not
      // an error -- see src/lib/client-id.ts.
      const clientId = await resolveClientId({
        id,
        find: (segmentId) => prisma.pathSegment.findUnique({ where: { id: segmentId } }),
        inScope: (existing) => existing.pathId === pathId,
      })

      if (clientId.status === 'conflict') {
        return reply.code(400).send({ error: CLIENT_ID_CONFLICT_MESSAGE })
      }

      if (clientId.status === 'replay') {
        return reply.code(201).send({
          success: true as const,
          segment: transformDates(clientId.existing),
        })
      }

      // Create segment
      try {
        const segment = await prisma.pathSegment.create({
          data: {
            id,
            pathId,
            mapId: path.mapId,
            ...segmentData,
          },
        })

        return reply.code(201).send({
          success: true as const,
          segment: transformDates(segment),
        })
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          return reply.code(400).send({ error: CLIENT_ID_CONFLICT_MESSAGE })
        }
        throw error
      }
    },
  )

  // PUT /my/paths/:pathId/segments - Replace the whole segment list for a path
  //
  // A path's segments are authored as one shape: the editor builds the entire
  // ordered list and commits it in a single action, and there is no UI for editing
  // an individual segment. Writing them one POST at a time would also make the
  // client's save queue -- which retries a failed operation as a whole -- capable of
  // leaving a half-written path behind and duplicating segments on the retry. So the
  // whole list is one idempotent request.
  //
  // It reconciles by ID rather than deleting and re-inserting, because the client
  // sends the segment list along with every path update (including speed-multiplier
  // tweaks); re-inserting would churn IDs on edits that changed no geometry at all.
  fastify.put(
    '/paths/:pathId/segments',
    {
      schema: {
        description: 'Replace all segments of a path in one request',
        tags: ['maps', 'paths', 'segments'],
        params: pathIdParamsSchema,
        body: replacePathSegmentsBodySchema,
        response: {
          200: replacePathSegmentsResponseSchema,
          400: errorSchema,
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { pathId } = request.params
      const { segments } = request.body
      const userId = request.user!.id

      // Verify path exists and user owns it
      const path = await prisma.path.findUnique({
        where: { id: pathId },
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

      // Every referenced landmark must live on this path's map. Resolved in one
      // query rather than two per segment, since a long lane snaps to many.
      const referencedLandmarkIds = [
        ...new Set(
          segments.flatMap((segment) =>
            [segment.startLandmarkId, segment.endLandmarkId].filter((id): id is string => Boolean(id)),
          ),
        ),
      ]

      if (referencedLandmarkIds.length > 0) {
        const landmarks = await prisma.landmark.findMany({
          where: { id: { in: referencedLandmarkIds } },
          select: { id: true, mapId: true },
        })
        const validLandmarkIds = new Set(landmarks.filter((l) => l.mapId === path.mapId).map((l) => l.id))
        const unknown = referencedLandmarkIds.find((id) => !validLandmarkIds.has(id))
        if (unknown) {
          return reply.code(400).send({ error: `Invalid landmark ID: ${unknown}` })
        }
      }

      // Two segments claiming the same ID would make the upsert loop write one row
      // twice and silently drop the other.
      const providedIds = segments.map((segment) => segment.id).filter((id): id is string => Boolean(id))
      if (new Set(providedIds).size !== providedIds.length) {
        return reply.code(400).send({ error: 'Duplicate segment IDs in request' })
      }

      // An ID belonging to a different path would be stolen by the upsert.
      if (providedIds.length > 0) {
        const foreign = await prisma.pathSegment.findFirst({
          where: { id: { in: providedIds }, NOT: { pathId } },
          select: { id: true },
        })
        if (foreign) {
          return reply.code(400).send({ error: CLIENT_ID_CONFLICT_MESSAGE })
        }
      }

      const reconciled = await prisma.$transaction(async (tx) => {
        // An empty `notIn` deletes every segment, which is exactly right for an
        // empty request body: the path is being emptied, not left alone.
        await tx.pathSegment.deleteMany({
          where: { pathId, id: { notIn: providedIds } },
        })

        for (const { id, startLandmarkId, endLandmarkId, ...geometry } of segments) {
          const data = {
            ...geometry,
            startLandmarkId: startLandmarkId ?? null,
            endLandmarkId: endLandmarkId ?? null,
          }

          if (id) {
            await tx.pathSegment.upsert({
              where: { id },
              create: { id, pathId, mapId: path.mapId, ...data },
              update: data,
            })
          } else {
            await tx.pathSegment.create({
              data: { pathId, mapId: path.mapId, ...data },
            })
          }
        }

        return tx.pathSegment.findMany({
          where: { pathId },
          orderBy: { order: 'asc' },
        })
      })

      return reply.code(200).send({
        success: true as const,
        segments: reconciled.map((segment) => transformDates(segment)),
      })
    },
  )

  // GET /my/paths/:pathId/segments - List segments for path
  fastify.get(
    '/paths/:pathId/segments',
    {
      schema: {
        description: 'List all segments for a path',
        tags: ['maps', 'paths', 'segments'],
        params: pathIdParamsSchema,
        response: {
          200: listPathSegmentsResponseSchema,
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { pathId } = request.params
      const userId = request.user!.id

      // Verify path exists and user owns it
      const path = await prisma.path.findUnique({
        where: { id: pathId },
        include: {
          map: {
            include: {
              story: {
                select: { ownerId: true },
              },
            },
          },
          segments: {
            orderBy: { order: 'asc' },
          },
        },
      })

      if (!path) {
        return reply.code(404).send({ error: 'Path not found' })
      }

      if (path.map.story.ownerId !== userId) {
        return reply.code(403).send({ error: 'Access denied' })
      }

      return reply.code(200).send({
        segments: path.segments.map(transformDates),
      })
    },
  )

  // GET /my/path-segments/:id - Get single segment
  fastify.get(
    '/path-segments/:id',
    {
      schema: {
        description: 'Get a single path segment by ID',
        tags: ['segments'],
        params: pathSegmentIdParamsSchema,
        response: {
          200: getPathSegmentResponseSchema,
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

      // Get segment with path/map/story ownership check
      const segment = await prisma.pathSegment.findUnique({
        where: { id },
        include: {
          path: {
            include: {
              map: {
                include: {
                  story: {
                    select: { ownerId: true },
                  },
                },
              },
            },
          },
        },
      })

      if (!segment) {
        return reply.code(404).send({ error: 'Path segment not found' })
      }

      if (segment.path.map.story.ownerId !== userId) {
        return reply.code(403).send({ error: 'Access denied' })
      }

      const { path, ...segmentData } = segment

      return reply.code(200).send({
        segment: transformDates(segmentData),
      })
    },
  )

  // PUT /my/path-segments/:id - Update segment
  fastify.put(
    '/path-segments/:id',
    {
      schema: {
        description: 'Update a path segment',
        tags: ['segments'],
        params: pathSegmentIdParamsSchema,
        body: updatePathSegmentBodySchema,
        response: {
          200: updatePathSegmentResponseSchema,
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

      // Get segment with path/map/story ownership check
      const existingSegment = await prisma.pathSegment.findUnique({
        where: { id },
        include: {
          path: {
            include: {
              map: {
                include: {
                  story: {
                    select: { ownerId: true },
                  },
                },
              },
            },
          },
        },
      })

      if (!existingSegment) {
        return reply.code(404).send({ error: 'Path segment not found' })
      }

      if (existingSegment.path.map.story.ownerId !== userId) {
        return reply.code(403).send({ error: 'Access denied' })
      }

      // If landmark IDs provided, verify they exist on the same map
      if (updateData.startLandmarkId !== undefined && updateData.startLandmarkId !== null) {
        const landmark = await prisma.landmark.findUnique({
          where: { id: updateData.startLandmarkId },
          select: { mapId: true },
        })
        if (!landmark || landmark.mapId !== existingSegment.mapId) {
          return reply.code(400).send({ error: 'Invalid start landmark ID' })
        }
      }

      if (updateData.endLandmarkId !== undefined && updateData.endLandmarkId !== null) {
        const landmark = await prisma.landmark.findUnique({
          where: { id: updateData.endLandmarkId },
          select: { mapId: true },
        })
        if (!landmark || landmark.mapId !== existingSegment.mapId) {
          return reply.code(400).send({ error: 'Invalid end landmark ID' })
        }
      }

      // Update segment
      const segment = await prisma.pathSegment.update({
        where: { id },
        data: updateData,
      })

      return reply.code(200).send({
        success: true as const,
        segment: transformDates(segment),
      })
    },
  )

  // DELETE /my/path-segments/:id - Delete segment
  fastify.delete(
    '/path-segments/:id',
    {
      schema: {
        description: 'Delete a path segment',
        tags: ['segments'],
        params: pathSegmentIdParamsSchema,
        response: {
          200: deletePathSegmentResponseSchema,
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

      // Get segment with path/map/story ownership check
      const segment = await prisma.pathSegment.findUnique({
        where: { id },
        include: {
          path: {
            include: {
              map: {
                include: {
                  story: {
                    select: { ownerId: true },
                  },
                },
              },
            },
          },
        },
      })

      if (!segment) {
        return reply.code(404).send({ error: 'Path segment not found' })
      }

      if (segment.path.map.story.ownerId !== userId) {
        return reply.code(403).send({ error: 'Access denied' })
      }

      // Delete segment
      await prisma.pathSegment.delete({
        where: { id },
      })

      return reply.code(200).send({
        success: true as const,
      })
    },
  )
}

export default pathSegmentRoutes
