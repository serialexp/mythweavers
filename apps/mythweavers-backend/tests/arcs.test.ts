import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { buildApp, cleanDatabase } from './helpers.js'

describe('Arc Endpoints', () => {
  let app: FastifyInstance
  let sessionCookie: { name: string; value: string }
  let _userId: number
  let storyId: string
  let bookId: string

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
        summary: 'A test story for arc tests',
      },
    })

    storyId = storyResponse.json().story.id

    // Create a test book
    const bookResponse = await app.inject({
      method: 'POST',
      url: `/my/stories/${storyId}/books`,
      cookies: {
        [sessionCookie.name]: sessionCookie.value,
      },
      payload: {
        name: 'Test Book',
        summary: 'A test book for arc tests',
      },
    })

    bookId = bookResponse.json().book.id
  })

  afterEach(async () => {
    await app.close()
  })

  describe('POST /my/books/:bookId/arcs', () => {
    test('should create a new arc successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/books/${bookId}/arcs`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          name: 'The Quest Begins',
          summary: 'Our heroes embark on their journey...',
          nodeType: 'story',
        },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.arc).toMatchObject({
        id: expect.any(String),
        name: 'The Quest Begins',
        summary: 'Our heroes embark on their journey...',
        bookId,
        sortOrder: 0,
        nodeType: 'story',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      })
    })

    test('should create arc with minimal fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/books/${bookId}/arcs`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          name: 'Simple Arc',
        },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.arc.name).toBe('Simple Arc')
      expect(body.arc.summary).toBeNull()
      expect(body.arc.nodeType).toBe('story')
      expect(body.arc.sortOrder).toBe(0)
    })

    test('should auto-increment sortOrder for multiple arcs', async () => {
      // Create first arc
      const response1 = await app.inject({
        method: 'POST',
        url: `/my/books/${bookId}/arcs`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          name: 'Arc One',
        },
      })

      expect(response1.statusCode).toBe(201)
      expect(response1.json().arc.sortOrder).toBe(0)

      // Create second arc
      const response2 = await app.inject({
        method: 'POST',
        url: `/my/books/${bookId}/arcs`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          name: 'Arc Two',
        },
      })

      expect(response2.statusCode).toBe(201)
      expect(response2.json().arc.sortOrder).toBe(1)
    })

    test('should allow manual sortOrder', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/books/${bookId}/arcs`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          name: 'Arc with custom order',
          sortOrder: 5,
        },
      })

      expect(response.statusCode).toBe(201)
      expect(response.json().arc.sortOrder).toBe(5)
    })

    test('should reject creation with empty name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/books/${bookId}/arcs`,
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
        url: `/my/books/${bookId}/arcs`,
        payload: {
          name: 'Test Arc',
        },
      })

      expect(response.statusCode).toBe(401)
      const body = response.json()
      expect(body.error).toBe('Authentication required')
    })

    test('should reject creation for non-existent book', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/my/books/non-existent-id/arcs',
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          name: 'Test Arc',
        },
      })

      expect(response.statusCode).toBe(404)
      const body = response.json()
      expect(body.error).toBe('Book not found')
    })

    test('should reject creation for book owned by another user', async () => {
      // Create another user
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

      // Try to create arc in first user's book
      const response = await app.inject({
        method: 'POST',
        url: `/my/books/${bookId}/arcs`,
        cookies: {
          [user2Cookie.name]: user2Cookie.value,
        },
        payload: {
          name: 'Unauthorized Arc',
        },
      })

      expect(response.statusCode).toBe(404)
      const body = response.json()
      expect(body.error).toBe('Book not found')
    })
  })

  describe('GET /my/books/:bookId/arcs', () => {
    test('should list arcs in a book', async () => {
      // Create a few arcs
      await app.inject({
        method: 'POST',
        url: `/my/books/${bookId}/arcs`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Arc 1', sortOrder: 1 },
      })

      await app.inject({
        method: 'POST',
        url: `/my/books/${bookId}/arcs`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Arc 2', sortOrder: 0 },
      })

      // List arcs
      const response = await app.inject({
        method: 'GET',
        url: `/my/books/${bookId}/arcs`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.arcs).toHaveLength(2)
      // Should be sorted by sortOrder
      expect(body.arcs[0].name).toBe('Arc 2')
      expect(body.arcs[1].name).toBe('Arc 1')
    })

    test('should return empty array for book with no arcs', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/books/${bookId}/arcs`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.arcs).toEqual([])
    })

    test('should reject without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/books/${bookId}/arcs`,
      })

      expect(response.statusCode).toBe(401)
      const body = response.json()
      expect(body.error).toBe('Authentication required')
    })

    test('should reject for non-existent book', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/my/books/non-existent-id/arcs',
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(404)
      const body = response.json()
      expect(body.error).toBe('Book not found')
    })
  })

  describe('GET /my/arcs/:id', () => {
    let arcId: string

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/books/${bookId}/arcs`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Test Arc' },
      })

      arcId = response.json().arc.id
    })

    test('should get a single arc', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/arcs/${arcId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.arc.id).toBe(arcId)
      expect(body.arc.name).toBe('Test Arc')
    })

    test('should reject without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/arcs/${arcId}`,
      })

      expect(response.statusCode).toBe(401)
      const body = response.json()
      expect(body.error).toBe('Authentication required')
    })

    test('should reject for non-existent arc', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/my/arcs/non-existent-id',
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(404)
      const body = response.json()
      expect(body.error).toBe('Arc not found')
    })
  })

  describe('PATCH /my/arcs/:id', () => {
    let arcId: string

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/books/${bookId}/arcs`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Original Name', summary: 'Original summary' },
      })

      arcId = response.json().arc.id
    })

    test('should update arc successfully', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/arcs/${arcId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          name: 'Updated Name',
          summary: 'Updated summary',
          nodeType: 'context',
          sortOrder: 5,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.arc.name).toBe('Updated Name')
      expect(body.arc.summary).toBe('Updated summary')
      expect(body.arc.nodeType).toBe('context')
      expect(body.arc.sortOrder).toBe(5)
    })

    test('should update only specified fields', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/arcs/${arcId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          name: 'New Name Only',
        },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.arc.name).toBe('New Name Only')
      expect(body.arc.summary).toBe('Original summary')
    })

    test('should reject update with empty name', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/arcs/${arcId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          name: '',
        },
      })

      expect(response.statusCode).toBe(400)
      const body = response.json()
      expect(body.error).toBeDefined()
    })

    test('should reject without authentication', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/arcs/${arcId}`,
        payload: {
          name: 'New Name',
        },
      })

      expect(response.statusCode).toBe(401)
      const body = response.json()
      expect(body.error).toBe('Authentication required')
    })

    test('should reject for non-existent arc', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/my/arcs/non-existent-id',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          name: 'New Name',
        },
      })

      expect(response.statusCode).toBe(404)
      const body = response.json()
      expect(body.error).toBe('Arc not found')
    })
  })

  describe('DELETE /my/arcs/:id', () => {
    let arcId: string

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/books/${bookId}/arcs`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Arc to Delete' },
      })

      arcId = response.json().arc.id
    })

    test('should delete arc successfully', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/my/arcs/${arcId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)

      // Verify arc is actually deleted
      const getResponse = await app.inject({
        method: 'GET',
        url: `/my/arcs/${arcId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(getResponse.statusCode).toBe(404)
    })

    test('should reject without authentication', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/my/arcs/${arcId}`,
      })

      expect(response.statusCode).toBe(401)
      const body = response.json()
      expect(body.error).toBe('Authentication required')
    })

    test('should reject for non-existent arc', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/my/arcs/non-existent-id',
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(404)
      const body = response.json()
      expect(body.error).toBe('Arc not found')
    })
  })
})
