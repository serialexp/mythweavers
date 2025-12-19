import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { prisma } from '../../lib/prisma.js'
import { errorSchema } from '../../schemas/common.js'

// Schemas
const storyIdParamsSchema = z.strictObject({
  storyId: z.string().meta({ description: 'Story ID', example: 'clx1234567890' }),
})

const setDefaultCalendarBodySchema = z.strictObject({
  calendarId: z.string().meta({ description: 'Calendar ID to set as default', example: 'clx0987654321' }),
})

const setDefaultCalendarResponseSchema = z.strictObject({
  success: z.literal(true),
})

const storyCalendarRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // All routes require authentication
  fastify.addHook('preHandler', requireAuth)

  // PUT /my/stories/:storyId/default-calendar - Set default calendar for story
  fastify.put(
    '/stories/:storyId/default-calendar',
    {
      schema: {
        description: 'Set the default calendar for a story',
        tags: ['stories', 'calendars'],
        params: storyIdParamsSchema,
        body: setDefaultCalendarBodySchema,
        response: {
          200: setDefaultCalendarResponseSchema,
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
      const { calendarId } = request.body
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

      // Verify calendar exists and belongs to this story
      const calendar = await prisma.calendar.findUnique({
        where: { id: calendarId },
        select: { id: true, storyId: true },
      })

      if (!calendar) {
        return reply.code(404).send({ error: 'Calendar not found' })
      }

      if (calendar.storyId !== storyId) {
        return reply.code(400).send({
          error: 'Calendar does not belong to this story',
        })
      }

      // Set as default
      await prisma.story.update({
        where: { id: storyId },
        data: { defaultCalendarId: calendarId },
      })

      return reply.code(200).send({
        success: true as const,
      })
    },
  )
}

export default storyCalendarRoutes
