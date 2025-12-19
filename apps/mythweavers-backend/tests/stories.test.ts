import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { buildApp, cleanDatabase } from './helpers.js'

describe('Story Endpoints', () => {
  let app: FastifyInstance
  let sessionCookie: { name: string; value: string }
  let userId: number

  beforeEach(async () => {
    app = await buildApp()
    await cleanDatabase()

    // Register a test user and get session cookie
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123',
      },
    })

    sessionCookie = registerResponse.cookies[0]
    userId = registerResponse.json().user.id
  })

  afterEach(async () => {
    await app.close()
  })

  describe('POST /my/stories', () => {
    test('should create a new story successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          name: 'My Epic Adventure',
          summary: 'A tale of heroes and dragons',
          type: 'ORIGINAL',
          provider: 'anthropic',
          model: 'claude-sonnet-4',
        },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.story).toMatchObject({
        id: expect.any(String),
        name: 'My Epic Adventure',
        summary: 'A tale of heroes and dragons',
        ownerId: userId,
        published: false,
        status: 'ONGOING',
        type: 'ORIGINAL',
        defaultPerspective: 'THIRD',
        provider: 'anthropic',
        model: 'claude-sonnet-4',
        coverColor: '#000000',
        coverTextColor: '#FFFFFF',
        coverFontFamily: 'Georgia',
        sortOrder: 0,
        pages: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      })
    })

    test('should create story with minimal fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          name: 'Simple Story',
        },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.story.name).toBe('Simple Story')
      expect(body.story.summary).toBeNull()
      expect(body.story.type).toBe('ORIGINAL')
      expect(body.story.provider).toBe('ollama')
    })

    test('should reject creation with empty name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          name: '',
        },
      })

      expect(response.statusCode).toBe(400)
      const body = response.json()
      expect(body.error).toBeDefined()
    })

    test('should reject creation without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: {
          name: 'Test Story',
        },
      })

      expect(response.statusCode).toBe(401)
      const body = response.json()
      expect(body.error).toBe('Authentication required')
    })
  })

  describe('GET /my/stories', () => {
    test('should list user stories', async () => {
      // Create a few stories
      await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Story 1', summary: 'First story' },
      })

      await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Story 2', summary: 'Second story' },
      })

      // List stories
      const response = await app.inject({
        method: 'GET',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.stories).toHaveLength(2)
      expect(body.pagination).toMatchObject({
        page: 1,
        pageSize: 20,
        total: 2,
        totalPages: 1,
      })
    })

    test('should return empty list for user with no stories', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.stories).toHaveLength(0)
      expect(body.pagination.total).toBe(0)
    })

    test('should paginate results', async () => {
      // Create 25 stories
      for (let i = 1; i <= 25; i++) {
        await app.inject({
          method: 'POST',
          url: '/my/stories',
          cookies: { [sessionCookie.name]: sessionCookie.value },
          payload: { name: `Story ${i}` },
        })
      }

      // Get first page
      const page1Response = await app.inject({
        method: 'GET',
        url: '/my/stories?page=1&pageSize=10',
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(page1Response.statusCode).toBe(200)
      const page1Body = page1Response.json()
      expect(page1Body.stories).toHaveLength(10)
      expect(page1Body.pagination).toMatchObject({
        page: 1,
        pageSize: 10,
        total: 25,
        totalPages: 3,
      })

      // Get second page
      const page2Response = await app.inject({
        method: 'GET',
        url: '/my/stories?page=2&pageSize=10',
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      const page2Body = page2Response.json()
      expect(page2Body.stories).toHaveLength(10)
      expect(page2Body.pagination.page).toBe(2)
    })

    test('should search stories by name', async () => {
      await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Dragon Quest', summary: 'Fight dragons' },
      })

      await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Space Adventure', summary: 'Explore space' },
      })

      const response = await app.inject({
        method: 'GET',
        url: '/my/stories?search=dragon',
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.stories).toHaveLength(1)
      expect(body.stories[0].name).toBe('Dragon Quest')
    })

    test('should search stories by summary', async () => {
      await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Quest', summary: 'Fight dragons' },
      })

      await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Adventure', summary: 'Explore space' },
      })

      const response = await app.inject({
        method: 'GET',
        url: '/my/stories?search=space',
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.stories).toHaveLength(1)
      expect(body.stories[0].name).toBe('Adventure')
    })

    test('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/my/stories',
      })

      expect(response.statusCode).toBe(401)
      const body = response.json()
      expect(body.error).toBe('Authentication required')
    })

    test('should only show stories owned by authenticated user', async () => {
      // Create story as first user
      await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'User 1 Story' },
      })

      // Register second user
      const user2Response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'user2@example.com',
          username: 'user2',
          password: 'password123',
        },
      })

      const user2Cookie = user2Response.cookies[0]

      // Create story as second user
      await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [user2Cookie.name]: user2Cookie.value },
        payload: { name: 'User 2 Story' },
      })

      // List stories as second user
      const response = await app.inject({
        method: 'GET',
        url: '/my/stories',
        cookies: { [user2Cookie.name]: user2Cookie.value },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.stories).toHaveLength(1)
      expect(body.stories[0].name).toBe('User 2 Story')
    })
  })

  describe('GET /my/stories/:id', () => {
    test('should get story by id', async () => {
      // Create a story
      const createResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Test Story', summary: 'A test story' },
      })

      const storyId = createResponse.json().story.id

      // Get the story
      const response = await app.inject({
        method: 'GET',
        url: `/my/stories/${storyId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.story.id).toBe(storyId)
      expect(body.story.name).toBe('Test Story')
      expect(body.story.summary).toBe('A test story')
    })

    test('should return 404 for non-existent story', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/my/stories/nonexistent',
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(404)
      const body = response.json()
      expect(body.error).toBe('Story not found')
    })

    test("should not allow access to other user's story", async () => {
      // Create story as first user
      const createResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'User 1 Story' },
      })

      const storyId = createResponse.json().story.id

      // Register second user
      const user2Response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'user2@example.com',
          username: 'user2',
          password: 'password123',
        },
      })

      const user2Cookie = user2Response.cookies[0]

      // Try to access first user's story as second user
      const response = await app.inject({
        method: 'GET',
        url: `/my/stories/${storyId}`,
        cookies: { [user2Cookie.name]: user2Cookie.value },
      })

      expect(response.statusCode).toBe(404)
      const body = response.json()
      expect(body.error).toBe('Story not found')
    })

    test('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/my/stories/some-id',
      })

      expect(response.statusCode).toBe(401)
      const body = response.json()
      expect(body.error).toBe('Authentication required')
    })
  })

  describe('PATCH /my/stories/:id', () => {
    test('should update story successfully', async () => {
      // Create a story
      const createResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Original Name', summary: 'Original summary' },
      })

      const storyId = createResponse.json().story.id

      // Update the story
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/stories/${storyId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          name: 'Updated Name',
          summary: 'Updated summary',
          status: 'COMPLETED',
        },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.story.name).toBe('Updated Name')
      expect(body.story.summary).toBe('Updated summary')
      expect(body.story.status).toBe('COMPLETED')
    })

    test('should allow partial updates', async () => {
      // Create a story
      const createResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Original Name', summary: 'Original summary' },
      })

      const storyId = createResponse.json().story.id

      // Update only the name
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/stories/${storyId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          name: 'New Name Only',
        },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.story.name).toBe('New Name Only')
      expect(body.story.summary).toBe('Original summary') // Unchanged
    })

    test('should return 404 for non-existent story', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/my/stories/nonexistent',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'New Name' },
      })

      expect(response.statusCode).toBe(404)
      const body = response.json()
      expect(body.error).toBe('Story not found')
    })

    test("should not allow updating other user's story", async () => {
      // Create story as first user
      const createResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'User 1 Story' },
      })

      const storyId = createResponse.json().story.id

      // Register second user
      const user2Response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'user2@example.com',
          username: 'user2',
          password: 'password123',
        },
      })

      const user2Cookie = user2Response.cookies[0]

      // Try to update first user's story as second user
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/stories/${storyId}`,
        cookies: { [user2Cookie.name]: user2Cookie.value },
        payload: { name: 'Hacked Name' },
      })

      expect(response.statusCode).toBe(404)
      const body = response.json()
      expect(body.error).toBe('Story not found')
    })

    test('should reject invalid updates', async () => {
      // Create a story
      const createResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Test Story' },
      })

      const storyId = createResponse.json().story.id

      // Try to update with empty name
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/stories/${storyId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: '' },
      })

      expect(response.statusCode).toBe(400)
      const body = response.json()
      expect(body.error).toBeDefined()
    })

    test('should require authentication', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/my/stories/some-id',
        payload: { name: 'New Name' },
      })

      expect(response.statusCode).toBe(401)
      const body = response.json()
      expect(body.error).toBe('Authentication required')
    })
  })

  describe('DELETE /my/stories/:id', () => {
    test('should delete story successfully', async () => {
      // Create a story
      const createResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Story to Delete' },
      })

      const storyId = createResponse.json().story.id

      // Delete the story
      const response = await app.inject({
        method: 'DELETE',
        url: `/my/stories/${storyId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)

      // Verify story is deleted
      const getResponse = await app.inject({
        method: 'GET',
        url: `/my/stories/${storyId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(getResponse.statusCode).toBe(404)
    })

    test('should return 404 for non-existent story', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/my/stories/nonexistent',
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(404)
      const body = response.json()
      expect(body.error).toBe('Story not found')
    })

    test("should not allow deleting other user's story", async () => {
      // Create story as first user
      const createResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'User 1 Story' },
      })

      const storyId = createResponse.json().story.id

      // Register second user
      const user2Response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'user2@example.com',
          username: 'user2',
          password: 'password123',
        },
      })

      const user2Cookie = user2Response.cookies[0]

      // Try to delete first user's story as second user
      const response = await app.inject({
        method: 'DELETE',
        url: `/my/stories/${storyId}`,
        cookies: { [user2Cookie.name]: user2Cookie.value },
      })

      expect(response.statusCode).toBe(404)
      const body = response.json()
      expect(body.error).toBe('Story not found')

      // Verify story still exists for first user
      const getResponse = await app.inject({
        method: 'GET',
        url: `/my/stories/${storyId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(getResponse.statusCode).toBe(200)
    })

    test('should require authentication', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/my/stories/some-id',
      })

      expect(response.statusCode).toBe(401)
      const body = response.json()
      expect(body.error).toBe('Authentication required')
    })
  })

  describe('GET /my/stories/:id/export', () => {
    test('should export story with all related data', async () => {
      // Create a story
      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Export Test Story' },
      })
      const storyId = storyResponse.json().story.id

      // Create a calendar
      const calendarResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/calendars`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Test Calendar', config: { id: 'test', name: 'Test' } },
      })
      expect(calendarResponse.statusCode).toBe(201)

      // Export the story
      const response = await app.inject({
        method: 'GET',
        url: `/my/stories/${storyId}/export`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()

      // Verify story
      expect(body.story.id).toBe(storyId)
      expect(body.story.name).toBe('Export Test Story')
      expect(body.story.createdAt).toBeDefined()
      expect(body.story.updatedAt).toBeDefined()

      // Verify calendars include updatedAt
      expect(body.calendars).toHaveLength(1)
      expect(body.calendars[0].name).toBe('Test Calendar')
      expect(body.calendars[0].createdAt).toBeDefined()
      expect(body.calendars[0].updatedAt).toBeDefined()

      // Verify other arrays exist
      expect(body.books).toBeDefined()
      expect(body.characters).toBeDefined()
      expect(body.contextItems).toBeDefined()
      expect(body.maps).toBeDefined()
    })

    test('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/my/stories/some-id/export',
      })

      expect(response.statusCode).toBe(401)
    })

    test('should return 404 for non-existent story', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/my/stories/nonexistent/export',
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(404)
    })
  })
})
