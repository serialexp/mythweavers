import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { errorSchema } from '../../schemas/common.js'

// Calendar presets (from Story project)
// These are built-in calendar configurations that users can choose from
// Using z.any() for the complex config structure since it's stored as JSON blob

const listPresetsResponseSchema = z.strictObject({
  presets: z.array(z.any()).meta({ description: 'Available calendar presets (CalendarConfig[])' }),
})

// Hardcoded calendar presets (from @story/shared)
const CORUSCANT_CALENDAR = {
  id: 'coruscant',
  name: 'Coruscant Standard Calendar',
  description: 'Galactic standard timekeeping (368 days, BBY/ABY)',
  minutesPerHour: 60,
  hoursPerDay: 24,
  minutesPerDay: 1440,
  daysPerYear: 368,
  minutesPerYear: 529920,
  subdivisions: [
    {
      id: 'quarter',
      name: 'Quarter',
      pluralName: 'Quarters',
      count: 4,
      daysPerUnitFixed: 92,
      labels: ['Conference Season', 'Gala Season', 'Recess Season', 'Budget Season'],
      subdivisions: [
        {
          id: 'week',
          name: 'Week',
          pluralName: 'Weeks',
          count: 13,
          daysPerUnitFixed: 7,
          labelFormat: 'Week {n}',
        },
      ],
    },
  ],
  eras: {
    positive: 'ABY',
    negative: 'BBY',
  },
  display: {
    defaultFormat: '{dayLabel}, {quarter} (Q{quarterNumber}), {year} {era} at {hour}:{minute}',
    shortFormat: 'Q{quarterNumber} Day {dayOfQuarter}, {year} {era}',
    includeTimeByDefault: true,
    hourFormat: '24' as const,
  },
  specialDays: {
    quarter: {
      '92': 'Festival Day',
    },
  },
}

const SIMPLE_365_CALENDAR = {
  id: 'simple365',
  name: 'Simple 365-Day Calendar',
  description: 'Basic 365-day year, no subdivisions',
  minutesPerHour: 60,
  hoursPerDay: 24,
  minutesPerDay: 1440,
  daysPerYear: 365,
  minutesPerYear: 525600,
  subdivisions: [],
  eras: {
    positive: 'AE',
    negative: 'BE',
  },
  display: {
    defaultFormat: 'Day {dayOfYear}, Year {year} {era} at {hour}:{minute}',
    shortFormat: 'Day {dayOfYear}, Year {year} {era}',
    includeTimeByDefault: true,
    hourFormat: '24' as const,
  },
}

const CALENDAR_PRESETS = [CORUSCANT_CALENDAR, SIMPLE_365_CALENDAR]

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
        presets: CALENDAR_PRESETS,
      })
    },
  )
}

export default calendarPresetsRoutes
