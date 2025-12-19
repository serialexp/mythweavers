import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { buildApp, cleanDatabase } from './helpers.js'

describe('Context Item Endpoints', () => {
  let app: FastifyInstance
  let sessionCookie: { name: string; value: string }
  let _userId: number
  let storyId: string

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
    _userId = registerResponse.json().user.id

    // Create a test story
    const storyResponse = await app.inject({
      method: 'POST',
      url: '/my/stories',
      cookies: {
        [sessionCookie.name]: sessionCookie.value,
      },
      payload: {
        name: 'Test Story',
        summary: 'A test story for context item tests',
      },
    })

    storyId = storyResponse.json().story.id
  })

  afterEach(async () => {
    await app.close()
  })

  describe('POST /my/stories/:storyId/context-items', () => {
    test('should create a location context item', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/context-items`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          type: 'location',
          name: 'The Grand Library',
          description: 'A vast library filled with ancient tomes and scrolls',
          isGlobal: false,
        },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.contextItem).toMatchObject({
        id: expect.any(String),
        storyId,
        type: 'location',
        name: 'The Grand Library',
        description: 'A vast library filled with ancient tomes and scrolls',
        isGlobal: false,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      })
    })

    test('should create a theme context item', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/context-items`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          type: 'theme',
          name: 'Redemption',
          description: 'The journey from darkness to light',
        },
      })

      expect(response.statusCode).toBe(201)
      expect(response.json().contextItem.type).toBe('theme')
      expect(response.json().contextItem.isGlobal).toBe(false) // Default
    })

    test('should create a plot context item with global flag', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/context-items`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          type: 'plot',
          name: 'The Prophecy',
          description: 'An ancient prophecy that drives the plot',
          isGlobal: true,
        },
      })

      expect(response.statusCode).toBe(201)
      expect(response.json().contextItem.type).toBe('plot')
      expect(response.json().contextItem.isGlobal).toBe(true)
    })

    test('should reject creation with empty name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/context-items`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          type: 'location',
          name: '',
          description: 'Test',
        },
      })

      expect(response.statusCode).toBe(400)
      expect(response.json().error).toBeDefined()
    })

    test('should reject creation with empty description', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/context-items`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          type: 'location',
          name: 'Test Location',
          description: '',
        },
      })

      expect(response.statusCode).toBe(400)
      expect(response.json().error).toBeDefined()
    })

    test('should reject creation with invalid type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/context-items`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          type: 'invalid-type',
          name: 'Test',
          description: 'Test description',
        },
      })

      expect(response.statusCode).toBe(400)
      expect(response.json().error).toBeDefined()
    })

    test('should reject creation for non-existent story', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/my/stories/nonexistent-story-id/context-items',
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          type: 'location',
          name: 'Test',
          description: 'Test description',
        },
      })

      expect(response.statusCode).toBe(404)
      expect(response.json().error).toBe('Story not found')
    })

    test('should reject creation without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/context-items`,
        payload: {
          type: 'location',
          name: 'Test',
          description: 'Test description',
        },
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('GET /my/stories/:storyId/context-items', () => {
    test('should list all context items in a story', async () => {
      // Create multiple context items
      await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/context-items`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          type: 'location',
          name: 'Library',
          description: 'A library',
        },
      })

      await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/context-items`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          type: 'theme',
          name: 'Redemption',
          description: 'A theme',
        },
      })

      const response = await app.inject({
        method: 'GET',
        url: `/my/stories/${storyId}/context-items`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.contextItems).toHaveLength(2)
      expect(body.contextItems[0].name).toBe('Library')
      expect(body.contextItems[1].name).toBe('Redemption')
    })

    test('should filter context items by type', async () => {
      // Create multiple types
      await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/context-items`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          type: 'location',
          name: 'Library',
          description: 'A library',
        },
      })

      await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/context-items`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          type: 'location',
          name: 'Castle',
          description: 'A castle',
        },
      })

      await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/context-items`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          type: 'theme',
          name: 'Redemption',
          description: 'A theme',
        },
      })

      // Filter by location
      const response = await app.inject({
        method: 'GET',
        url: `/my/stories/${storyId}/context-items?type=location`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.contextItems).toHaveLength(2)
      expect(body.contextItems.every((item: any) => item.type === 'location')).toBe(true)
    })

    test('should return empty array for story with no context items', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/stories/${storyId}/context-items`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().contextItems).toEqual([])
    })

    test('should reject listing for non-existent story', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/my/stories/nonexistent-story-id/context-items',
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
      })

      expect(response.statusCode).toBe(404)
      expect(response.json().error).toBe('Story not found')
    })

    test('should reject listing without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/stories/${storyId}/context-items`,
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('GET /my/context-items/:id', () => {
    test('should get a single context item', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/context-items`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          type: 'location',
          name: 'Library',
          description: 'A vast library',
        },
      })

      const contextItemId = createResponse.json().contextItem.id

      const response = await app.inject({
        method: 'GET',
        url: `/my/context-items/${contextItemId}`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.contextItem.id).toBe(contextItemId)
      expect(body.contextItem.name).toBe('Library')
      expect(body.contextItem.description).toBe('A vast library')
    })

    test('should return 404 for non-existent context item', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/my/context-items/nonexistent-context-item-id',
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
      })

      expect(response.statusCode).toBe(404)
      expect(response.json().error).toBe('Context item not found')
    })

    test('should reject getting context item without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/my/context-items/some-context-item-id',
      })

      expect(response.statusCode).toBe(401)
    })

    test("should not allow accessing another user's context item", async () => {
      // Create another user
      const otherUserResponse = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'other@example.com',
          username: 'otheruser',
          password: 'password123',
        },
      })

      const otherSessionCookie = otherUserResponse.cookies[0]

      // Create a story for the other user
      const otherStoryResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: {
          [otherSessionCookie.name]: otherSessionCookie.value,
        },
        payload: {
          name: 'Other User Story',
        },
      })

      const otherStoryId = otherStoryResponse.json().story.id

      // Create a context item for the other user
      const createContextItemResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${otherStoryId}/context-items`,
        cookies: {
          [otherSessionCookie.name]: otherSessionCookie.value,
        },
        payload: {
          type: 'location',
          name: 'Other User Location',
          description: 'Test',
        },
      })

      const otherContextItemId = createContextItemResponse.json().contextItem.id

      // Try to access the other user's context item with the first user's session
      const response = await app.inject({
        method: 'GET',
        url: `/my/context-items/${otherContextItemId}`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('PATCH /my/context-items/:id', () => {
    let contextItemId: string

    beforeEach(async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/context-items`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          type: 'location',
          name: 'Library',
          description: 'A library',
        },
      })

      contextItemId = createResponse.json().contextItem.id
    })

    test('should update context item fields', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/context-items/${contextItemId}`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          name: 'The Grand Library',
          description: 'A vast and ancient library',
          isGlobal: true,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.contextItem.name).toBe('The Grand Library')
      expect(body.contextItem.description).toBe('A vast and ancient library')
      expect(body.contextItem.isGlobal).toBe(true)
      expect(body.contextItem.type).toBe('location') // Unchanged
    })

    test('should update only name', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/context-items/${contextItemId}`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          name: 'Updated Library',
        },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().contextItem.name).toBe('Updated Library')
      expect(response.json().contextItem.description).toBe('A library') // Unchanged
    })

    test('should update type', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/context-items/${contextItemId}`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          type: 'plot',
        },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().contextItem.type).toBe('plot')
    })

    test('should return 404 for non-existent context item', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/my/context-items/nonexistent-context-item-id',
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          name: 'Updated',
        },
      })

      expect(response.statusCode).toBe(404)
      expect(response.json().error).toBe('Context item not found')
    })

    test('should reject update without authentication', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/context-items/${contextItemId}`,
        payload: {
          name: 'Updated',
        },
      })

      expect(response.statusCode).toBe(401)
    })

    test('should reject empty name', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/context-items/${contextItemId}`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          name: '',
        },
      })

      expect(response.statusCode).toBe(400)
    })

    test('should reject empty description', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/context-items/${contextItemId}`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          description: '',
        },
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('DELETE /my/context-items/:id', () => {
    let contextItemId: string

    beforeEach(async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/context-items`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          type: 'location',
          name: 'Library',
          description: 'A library',
        },
      })

      contextItemId = createResponse.json().contextItem.id
    })

    test('should delete a context item', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/my/context-items/${contextItemId}`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().success).toBe(true)

      // Verify context item is deleted
      const getResponse = await app.inject({
        method: 'GET',
        url: `/my/context-items/${contextItemId}`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
      })

      expect(getResponse.statusCode).toBe(404)
    })

    test('should return 404 for non-existent context item', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/my/context-items/nonexistent-context-item-id',
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
      })

      expect(response.statusCode).toBe(404)
      expect(response.json().error).toBe('Context item not found')
    })

    test('should reject delete without authentication', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/my/context-items/${contextItemId}`,
      })

      expect(response.statusCode).toBe(401)
    })
  })
})
