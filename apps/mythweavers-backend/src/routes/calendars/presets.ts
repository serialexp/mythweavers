import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { listCalendarPresets } from '@mythweavers/shared'
import { errorSchema } from '../../schemas/common.js'

// Calendar presets - imported from shared package
const listPresetsResponseSchema = z.strictObject({
  presets: z.array(z.any()).meta({ description: 'Available calendar presets (CalendarConfig[])' }),
})

const calendarPresetsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // GET /calendars/presets - List all calendar presets (public, no auth)
  fastify.get(
    '/presets',
    {
      schema: {
        description: 'Get all available calendar presets',
        tags: ['calendars'],
        response: {
          200: listPresetsResponseSchema,
          500: errorSchema,
        },
      },
    },
    async (_request, reply) => {
      return reply.code(200).send({
        presets: listCalendarPresets(),
      })
    },
  )
}

export default calendarPresetsRoutes
