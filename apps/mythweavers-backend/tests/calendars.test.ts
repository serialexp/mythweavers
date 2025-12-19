import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { buildApp, cleanDatabase } from './helpers.js'

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp()
})

afterAll(async () => {
  await app.close()
})

beforeEach(async () => {
  await cleanDatabase()
})

// Helper to register user and get session cookie
async function registerUser(email: string, username: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: {
      email,
      username,
      password: 'Password123!',
    },
  })
  const sessionCookie = response.cookies[0]
  return {
    userId: response.json().user.id,
    cookies: { [sessionCookie.name]: sessionCookie.value },
  }
}

const SAMPLE_CALENDAR_CONFIG = {
  id: 'custom',
  name: 'Custom Calendar',
  description: 'A custom calendar for testing',
  minutesPerHour: 60,
  hoursPerDay: 24,
  minutesPerDay: 1440,
  daysPerYear: 360,
  minutesPerYear: 518400,
  subdivisions: [],
  eras: { positive: 'CE', negative: 'BCE' },
  display: {
    defaultFormat: 'Day {dayOfYear}, Year {year} {era}',
    shortFormat: 'Day {dayOfYear}, Year {year}',
    includeTimeByDefault: false,
    hourFormat: '24' as const,
  },
}

describe('Calendar Endpoints', () => {
  describe('GET /calendars/presets', () => {
    test('should return calendar presets without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/calendars/presets',
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.presets).toBeArray()
      expect(body.presets.length).toBeGreaterThan(0)

      // Check Coruscant calendar exists
      const coruscant = body.presets.find((p: any) => p.id === 'coruscant')
      expect(coruscant).toBeDefined()
      expect(coruscant.name).toBe('Coruscant Standard Calendar')
      expect(coruscant.daysPerYear).toBe(368)
      expect(coruscant.eras.positive).toBe('ABY')
      expect(coruscant.eras.negative).toBe('BBY')

      // Check Simple365 calendar exists
      const simple = body.presets.find((p: any) => p.id === 'simple365')
      expect(simple).toBeDefined()
      expect(simple.name).toBe('Simple 365-Day Calendar')
      expect(simple.daysPerYear).toBe(365)
    })
  })

  describe('POST /my/stories/:storyId/calendars', () => {
    test('should create calendar for story', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      // Create story
      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Test Story' },
        cookies,
      })
      const { story } = storyResponse.json()

      // Create calendar
      const response = await app.inject({
        method: 'POST',
        url: `/my/stories/${story.id}/calendars`,
        payload: { name: 'Test Calendar', config: SAMPLE_CALENDAR_CONFIG },
        cookies,
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.calendar).toBeDefined()
      expect(body.calendar.id).toBeDefined()
      expect(body.calendar.storyId).toBe(story.id)
      expect(body.calendar.config).toEqual(SAMPLE_CALENDAR_CONFIG)
    })

    test('should create calendar and set as default', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Test Story' },
        cookies,
      })
      const { story } = storyResponse.json()

      // Create calendar with setAsDefault
      const response = await app.inject({
        method: 'POST',
        url: `/my/stories/${story.id}/calendars`,
        payload: {
          name: 'Test Calendar',
          config: SAMPLE_CALENDAR_CONFIG,
          setAsDefault: true,
        },
        cookies,
      })

      expect(response.statusCode).toBe(201)
      const { calendar } = response.json()

      // Verify it's set as default
      const listResponse = await app.inject({
        method: 'GET',
        url: `/my/stories/${story.id}/calendars`,
        cookies,
      })

      const { calendars } = listResponse.json()
      const defaultCalendar = calendars.find((c: any) => c.isDefault)
      expect(defaultCalendar).toBeDefined()
      expect(defaultCalendar.id).toBe(calendar.id)
    })

    test('should return 404 for non-existent story', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const response = await app.inject({
        method: 'POST',
        url: '/my/stories/nonexistent/calendars',
        payload: { name: 'Test Calendar', config: {} },
        cookies,
      })

      expect(response.statusCode).toBe(404)
    })

    test('should return 403 for story owned by another user', async () => {
      const user1 = await registerUser('user1@example.com', 'user1')
      const user2 = await registerUser('user2@example.com', 'user2')

      // Create story as user 1
      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'User 1 Story' },
        cookies: user1.cookies,
      })
      const { story } = storyResponse.json()

      // Try to create calendar as user 2
      const response = await app.inject({
        method: 'POST',
        url: `/my/stories/${story.id}/calendars`,
        payload: { name: 'Test Calendar', config: {} },
        cookies: user2.cookies,
      })

      expect(response.statusCode).toBe(403)
    })

    test('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/my/stories/someid/calendars',
        payload: { name: 'Test Calendar', config: {} },
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('GET /my/stories/:storyId/calendars', () => {
    test('should list calendars for story', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Test Story' },
        cookies,
      })
      const { story } = storyResponse.json()

      // Create multiple calendars
      const config1 = { ...SAMPLE_CALENDAR_CONFIG, id: 'cal1', name: 'Calendar 1', description: 'First calendar' }
      const config2 = { ...SAMPLE_CALENDAR_CONFIG, id: 'cal2', name: 'Calendar 2', description: 'Second calendar' }

      await app.inject({
        method: 'POST',
        url: `/my/stories/${story.id}/calendars`,
        payload: { name: 'Calendar 1', config: config1, setAsDefault: true },
        cookies,
      })

      await app.inject({
        method: 'POST',
        url: `/my/stories/${story.id}/calendars`,
        payload: { name: 'Calendar 2', config: config2 },
        cookies,
      })

      // List calendars
      const response = await app.inject({
        method: 'GET',
        url: `/my/stories/${story.id}/calendars`,
        cookies,
      })

      expect(response.statusCode).toBe(200)
      const { calendars } = response.json()
      expect(calendars).toBeArray()
      expect(calendars.length).toBe(2)

      // Check default flag
      const defaultCalendar = calendars.find((c: any) => c.isDefault)
      expect(defaultCalendar).toBeDefined()
      expect(defaultCalendar.name).toBe('Calendar 1')
    })

    test('should return empty array for story with no calendars', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Test Story' },
        cookies,
      })
      const { story } = storyResponse.json()

      const response = await app.inject({
        method: 'GET',
        url: `/my/stories/${story.id}/calendars`,
        cookies,
      })

      expect(response.statusCode).toBe(200)
      const { calendars } = response.json()
      expect(calendars).toBeArray()
      expect(calendars.length).toBe(0)
    })

    test('should return 404 for non-existent story', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const response = await app.inject({
        method: 'GET',
        url: '/my/stories/nonexistent/calendars',
        cookies,
      })

      expect(response.statusCode).toBe(404)
    })

    test('should return 403 for story owned by another user', async () => {
      const user1 = await registerUser('user1@example.com', 'user1')
      const user2 = await registerUser('user2@example.com', 'user2')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'User 1 Story' },
        cookies: user1.cookies,
      })
      const { story } = storyResponse.json()

      const response = await app.inject({
        method: 'GET',
        url: `/my/stories/${story.id}/calendars`,
        cookies: user2.cookies,
      })

      expect(response.statusCode).toBe(403)
    })

    test('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/my/stories/someid/calendars',
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('GET /my/calendars/:id', () => {
    test('should get calendar by id', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Test Story' },
        cookies,
      })
      const { story } = storyResponse.json()

      const createResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${story.id}/calendars`,
        payload: { name: 'Test Calendar', config: SAMPLE_CALENDAR_CONFIG },
        cookies,
      })
      const { calendar } = createResponse.json()

      const response = await app.inject({
        method: 'GET',
        url: `/my/calendars/${calendar.id}`,
        cookies,
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.calendar).toBeDefined()
      expect(body.calendar.id).toBe(calendar.id)
      expect(body.calendar.storyId).toBe(story.id)
      expect(body.calendar.config).toEqual(SAMPLE_CALENDAR_CONFIG)
    })

    test('should return 404 for non-existent calendar', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const response = await app.inject({
        method: 'GET',
        url: '/my/calendars/nonexistent',
        cookies,
      })

      expect(response.statusCode).toBe(404)
    })

    test('should return 403 for calendar owned by another user', async () => {
      const user1 = await registerUser('user1@example.com', 'user1')
      const user2 = await registerUser('user2@example.com', 'user2')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Story' },
        cookies: user1.cookies,
      })

      const calendarResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyResponse.json().story.id}/calendars`,
        payload: { name: 'Test Calendar', config: {} },
        cookies: user1.cookies,
      })
      const { calendar } = calendarResponse.json()

      const response = await app.inject({
        method: 'GET',
        url: `/my/calendars/${calendar.id}`,
        cookies: user2.cookies,
      })

      expect(response.statusCode).toBe(403)
    })

    test('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/my/calendars/someid',
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('PUT /my/calendars/:id', () => {
    test('should update calendar', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Test Story' },
        cookies,
      })
      const { story } = storyResponse.json()

      const createResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${story.id}/calendars`,
        payload: { name: 'Test Calendar', config: SAMPLE_CALENDAR_CONFIG },
        cookies,
      })
      const { calendar } = createResponse.json()

      // Update calendar
      const updatedConfig = {
        ...SAMPLE_CALENDAR_CONFIG,
        name: 'Updated Name',
        description: 'Updated description',
        daysPerYear: 360,
      }

      const response = await app.inject({
        method: 'PUT',
        url: `/my/calendars/${calendar.id}`,
        payload: { config: updatedConfig },
        cookies,
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.calendar.config.name).toBe('Updated Name')
      expect(body.calendar.config.description).toBe('Updated description')
      expect(body.calendar.config.daysPerYear).toBe(360)
    })

    test('should return 404 for non-existent calendar', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const response = await app.inject({
        method: 'PUT',
        url: '/my/calendars/nonexistent',
        payload: { name: 'Test Calendar', config: {} },
        cookies,
      })

      expect(response.statusCode).toBe(404)
    })

    test('should return 403 for calendar owned by another user', async () => {
      const user1 = await registerUser('user1@example.com', 'user1')
      const user2 = await registerUser('user2@example.com', 'user2')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Story' },
        cookies: user1.cookies,
      })

      const calendarResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyResponse.json().story.id}/calendars`,
        payload: { name: 'Test Calendar', config: {} },
        cookies: user1.cookies,
      })
      const { calendar } = calendarResponse.json()

      const response = await app.inject({
        method: 'PUT',
        url: `/my/calendars/${calendar.id}`,
        payload: { name: 'Test Calendar', config: {} },
        cookies: user2.cookies,
      })

      expect(response.statusCode).toBe(403)
    })

    test('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/my/calendars/someid',
        payload: { name: 'Test Calendar', config: {} },
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('DELETE /my/calendars/:id', () => {
    test('should delete calendar', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Test Story' },
        cookies,
      })
      const { story } = storyResponse.json()

      const createResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${story.id}/calendars`,
        payload: { name: 'Test Calendar', config: {} },
        cookies,
      })
      const { calendar } = createResponse.json()

      const response = await app.inject({
        method: 'DELETE',
        url: `/my/calendars/${calendar.id}`,
        cookies,
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().success).toBe(true)

      // Verify it's deleted
      const getResponse = await app.inject({
        method: 'GET',
        url: `/my/calendars/${calendar.id}`,
        cookies,
      })
      expect(getResponse.statusCode).toBe(404)
    })

    test('should not delete default calendar', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Test Story' },
        cookies,
      })
      const { story } = storyResponse.json()

      const createResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${story.id}/calendars`,
        payload: { name: 'Test Calendar', config: {}, setAsDefault: true },
        cookies,
      })
      const { calendar } = createResponse.json()

      const response = await app.inject({
        method: 'DELETE',
        url: `/my/calendars/${calendar.id}`,
        cookies,
      })

      expect(response.statusCode).toBe(400)
      expect(response.json().error).toContain('default calendar')
    })

    test('should return 404 for non-existent calendar', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const response = await app.inject({
        method: 'DELETE',
        url: '/my/calendars/nonexistent',
        cookies,
      })

      expect(response.statusCode).toBe(404)
    })

    test('should return 403 for calendar owned by another user', async () => {
      const user1 = await registerUser('user1@example.com', 'user1')
      const user2 = await registerUser('user2@example.com', 'user2')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Story' },
        cookies: user1.cookies,
      })

      const calendarResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyResponse.json().story.id}/calendars`,
        payload: { name: 'Test Calendar', config: {} },
        cookies: user1.cookies,
      })
      const { calendar } = calendarResponse.json()

      const response = await app.inject({
        method: 'DELETE',
        url: `/my/calendars/${calendar.id}`,
        cookies: user2.cookies,
      })

      expect(response.statusCode).toBe(403)
    })

    test('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/my/calendars/someid',
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('PUT /my/stories/:storyId/default-calendar', () => {
    test('should set default calendar', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Test Story' },
        cookies,
      })
      const { story } = storyResponse.json()

      // Create two calendars
      const cal1Response = await app.inject({
        method: 'POST',
        url: `/my/stories/${story.id}/calendars`,
        payload: { name: 'Calendar 1', config: { id: 'cal1', name: 'Calendar 1' } },
        cookies,
      })
      const { calendar: cal1 } = cal1Response.json()

      const cal2Response = await app.inject({
        method: 'POST',
        url: `/my/stories/${story.id}/calendars`,
        payload: { name: 'Calendar 2', config: { id: 'cal2', name: 'Calendar 2' } },
        cookies,
      })
      const { calendar: cal2 } = cal2Response.json()

      // Set cal2 as default
      const response = await app.inject({
        method: 'PUT',
        url: `/my/stories/${story.id}/default-calendar`,
        payload: { calendarId: cal2.id },
        cookies,
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().success).toBe(true)

      // Verify via list
      const listResponse = await app.inject({
        method: 'GET',
        url: `/my/stories/${story.id}/calendars`,
        cookies,
      })

      const { calendars } = listResponse.json()
      const defaultCal = calendars.find((c: any) => c.isDefault)
      expect(defaultCal.id).toBe(cal2.id)
    })

    test('should return 404 for non-existent story', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const response = await app.inject({
        method: 'PUT',
        url: '/my/stories/nonexistent/default-calendar',
        payload: { calendarId: 'someid' },
        cookies,
      })

      expect(response.statusCode).toBe(404)
    })

    test('should return 404 for non-existent calendar', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Story' },
        cookies,
      })

      const response = await app.inject({
        method: 'PUT',
        url: `/my/stories/${storyResponse.json().story.id}/default-calendar`,
        payload: { calendarId: 'nonexistent' },
        cookies,
      })

      expect(response.statusCode).toBe(404)
    })

    test('should return 400 if calendar belongs to different story', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      // Create two stories
      const story1Response = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Story 1' },
        cookies,
      })
      const { story: story1 } = story1Response.json()

      const story2Response = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Story 2' },
        cookies,
      })
      const { story: story2 } = story2Response.json()

      // Create calendar in story 1
      const calendarResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${story1.id}/calendars`,
        payload: { name: 'Test Calendar', config: {} },
        cookies,
      })
      const { calendar } = calendarResponse.json()

      // Try to set it as default for story 2
      const response = await app.inject({
        method: 'PUT',
        url: `/my/stories/${story2.id}/default-calendar`,
        payload: { calendarId: calendar.id },
        cookies,
      })

      expect(response.statusCode).toBe(400)
      expect(response.json().error).toContain('does not belong')
    })

    test('should return 403 for story owned by another user', async () => {
      const user1 = await registerUser('user1@example.com', 'user1')
      const user2 = await registerUser('user2@example.com', 'user2')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Story' },
        cookies: user1.cookies,
      })
      const { story } = storyResponse.json()

      const response = await app.inject({
        method: 'PUT',
        url: `/my/stories/${story.id}/default-calendar`,
        payload: { calendarId: 'someid' },
        cookies: user2.cookies,
      })

      expect(response.statusCode).toBe(403)
    })

    test('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/my/stories/someid/default-calendar',
        payload: { calendarId: 'someid' },
      })

      expect(response.statusCode).toBe(401)
    })
  })
})
