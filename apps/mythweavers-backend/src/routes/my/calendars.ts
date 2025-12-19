import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { prisma } from '../../lib/prisma.js'
import { transformDates } from '../../lib/transform-dates.js'
import { errorSchema } from '../../schemas/common.js'

// Schemas
const createCalendarBodySchema = z.strictObject({
  name: z.string().min(1).meta({ description: 'Calendar name', example: 'Coruscant Standard Calendar' }),
  config: z.any().meta({ description: 'Calendar configuration (CalendarConfig JSON)', example: {} }),
  setAsDefault: z.boolean().optional().meta({ description: 'Set as default calendar for story', example: false }),
})

const updateCalendarBodySchema = z.strictObject({
  name: z.string().min(1).optional().meta({ description: 'Calendar name', example: 'Updated Calendar' }),
  config: z.any().optional().meta({ description: 'Updated calendar configuration', example: {} }),
})

const calendarSchema = z.strictObject({
  id: z.string().meta({ description: 'Calendar ID', example: 'clx1234567890' }),
  storyId: z.string().meta({ description: 'Story ID', example: 'clx0987654321' }),
  name: z.string().meta({ description: 'Calendar name', example: 'Coruscant Standard Calendar' }),
  config: z.any().meta({ description: 'Calendar configuration (CalendarConfig JSON)' }),
  createdAt: z.string().datetime().meta({ description: 'Creation timestamp', example: '2025-12-05T12:00:00.000Z' }),
  updatedAt: z.string().datetime().meta({ description: 'Last update timestamp', example: '2025-12-05T12:00:00.000Z' }),
})

const calendarListItemSchema = z.strictObject({
  id: z.string().meta({ description: 'Calendar ID', example: 'clx1234567890' }),
  name: z.string().meta({ description: 'Calendar name', example: 'Coruscant Standard Calendar' }),
  description: z.string().meta({ description: 'Calendar description', example: 'Galactic standard timekeeping' }),
  isDefault: z.boolean().meta({ description: 'Is this the default calendar for the story', example: false }),
})

const createCalendarResponseSchema = z.strictObject({
  success: z.literal(true),
  calendar: calendarSchema,
})

const listCalendarsResponseSchema = z.strictObject({
  calendars: z.array(calendarListItemSchema).meta({ description: 'Story calendars (sorted by creation date)' }),
})

const getCalendarResponseSchema = z.strictObject({
  calendar: calendarSchema,
})

const updateCalendarResponseSchema = z.strictObject({
  success: z.literal(true),
  calendar: calendarSchema,
})

const deleteCalendarResponseSchema = z.strictObject({
  success: z.literal(true),
})

const calendarParamsSchema = z.strictObject({
  id: z.string().meta({ description: 'Calendar ID', example: 'clx1234567890' }),
})

const storyIdParamsSchema = z.strictObject({
  storyId: z.string().meta({ description: 'Story ID', example: 'clx1234567890' }),
})

const calendarRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // All routes require authentication
  fastify.addHook('preHandler', requireAuth)

  // POST /my/stories/:storyId/calendars - Create calendar for story
  fastify.post(
    '/stories/:storyId/calendars',
    {
      schema: {
        description: 'Create a new calendar for a story',
        tags: ['calendars'],
        params: storyIdParamsSchema,
        body: createCalendarBodySchema,
        response: {
          201: createCalendarResponseSchema,
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { storyId } = request.params
      const { name, config, setAsDefault } = request.body
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

      // Create calendar
      const calendar = await prisma.calendar.create({
        data: {
          storyId,
          name,
          config,
        },
      })

      // If setAsDefault, update story
      if (setAsDefault) {
        await prisma.story.update({
          where: { id: storyId },
          data: { defaultCalendarId: calendar.id },
        })
      }

      return reply.code(201).send({
        success: true as const,
        calendar: transformDates(calendar),
      })
    },
  )

  // GET /my/stories/:storyId/calendars - List calendars for story
  fastify.get(
    '/stories/:storyId/calendars',
    {
      schema: {
        description: 'List all calendars for a story',
        tags: ['calendars'],
        params: storyIdParamsSchema,
        response: {
          200: listCalendarsResponseSchema,
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
          defaultCalendarId: true,
          calendars: {
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

      // Map calendars to list items
      const calendars = story.calendars.map((calendar) => {
        const config = calendar.config as any
        return {
          id: calendar.id,
          name: config.name || 'Unnamed Calendar',
          description: config.description || '',
          isDefault: calendar.id === story.defaultCalendarId,
        }
      })

      return reply.code(200).send({ calendars })
    },
  )

  // GET /my/calendars/:id - Get single calendar
  fastify.get(
    '/calendars/:id',
    {
      schema: {
        description: 'Get a single calendar by ID',
        tags: ['calendars'],
        params: calendarParamsSchema,
        response: {
          200: getCalendarResponseSchema,
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

      // Get calendar with story ownership check
      const calendar = await prisma.calendar.findUnique({
        where: { id },
        include: {
          story: {
            select: { ownerId: true },
          },
        },
      })

      if (!calendar) {
        return reply.code(404).send({ error: 'Calendar not found' })
      }

      if (calendar.story.ownerId !== userId) {
        return reply.code(403).send({ error: 'Access denied' })
      }

      const { story, ...calendarData } = calendar

      return reply.code(200).send({
        calendar: transformDates(calendarData),
      })
    },
  )

  // PUT /my/calendars/:id - Update calendar
  fastify.put(
    '/calendars/:id',
    {
      schema: {
        description: 'Update a calendar configuration',
        tags: ['calendars'],
        params: calendarParamsSchema,
        body: updateCalendarBodySchema,
        response: {
          200: updateCalendarResponseSchema,
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params
      const { name, config } = request.body
      const userId = request.user!.id

      // Get calendar with story ownership check
      const existingCalendar = await prisma.calendar.findUnique({
        where: { id },
        include: {
          story: {
            select: { ownerId: true },
          },
        },
      })

      if (!existingCalendar) {
        return reply.code(404).send({ error: 'Calendar not found' })
      }

      if (existingCalendar.story.ownerId !== userId) {
        return reply.code(403).send({ error: 'Access denied' })
      }

      // Update calendar
      const calendar = await prisma.calendar.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(config !== undefined && { config }),
        },
      })

      return reply.code(200).send({
        success: true as const,
        calendar: transformDates(calendar),
      })
    },
  )

  // DELETE /my/calendars/:id - Delete calendar
  fastify.delete(
    '/calendars/:id',
    {
      schema: {
        description: 'Delete a calendar',
        tags: ['calendars'],
        params: calendarParamsSchema,
        response: {
          200: deleteCalendarResponseSchema,
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
      const userId = request.user!.id

      // Get calendar with story ownership check
      const calendar = await prisma.calendar.findUnique({
        where: { id },
        include: {
          story: {
            select: { ownerId: true, defaultCalendarId: true },
          },
        },
      })

      if (!calendar) {
        return reply.code(404).send({ error: 'Calendar not found' })
      }

      if (calendar.story.ownerId !== userId) {
        return reply.code(403).send({ error: 'Access denied' })
      }

      // Prevent deleting default calendar
      if (calendar.story.defaultCalendarId === id) {
        return reply.code(400).send({
          error: 'Cannot delete the default calendar. Set a different default calendar first.',
        })
      }

      // Delete calendar
      await prisma.calendar.delete({
        where: { id },
      })

      return reply.code(200).send({
        success: true as const,
      })
    },
  )
}

export default calendarRoutes
