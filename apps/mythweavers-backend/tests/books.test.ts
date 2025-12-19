import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { buildApp, cleanDatabase } from './helpers.js'

describe('Book Endpoints', () => {
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
        summary: 'A test story for book tests',
      },
    })

    storyId = storyResponse.json().story.id
  })

  afterEach(async () => {
    await app.close()
  })

  describe('POST /my/stories/:storyId/books', () => {
    test('should create a new book successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/books`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          name: 'Book One: The Beginning',
          summary: 'The journey begins...',
          nodeType: 'story',
        },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.book).toMatchObject({
        id: expect.any(String),
        name: 'Book One: The Beginning',
        summary: 'The journey begins...',
        storyId,
        sortOrder: 0,
        nodeType: 'story',
        pages: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      })
    })

    test('should create book with minimal fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/books`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          name: 'Simple Book',
        },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.book.name).toBe('Simple Book')
      expect(body.book.summary).toBeNull()
      expect(body.book.nodeType).toBe('story')
      expect(body.book.sortOrder).toBe(0)
    })

    test('should auto-increment sortOrder for multiple books', async () => {
      // Create first book
      const response1 = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/books`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          name: 'Book One',
        },
      })

      expect(response1.statusCode).toBe(201)
      expect(response1.json().book.sortOrder).toBe(0)

      // Create second book
      const response2 = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/books`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          name: 'Book Two',
        },
      })

      expect(response2.statusCode).toBe(201)
      expect(response2.json().book.sortOrder).toBe(1)
    })

    test('should allow manual sortOrder', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/books`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          name: 'Book with custom order',
          sortOrder: 5,
        },
      })

      expect(response.statusCode).toBe(201)
      expect(response.json().book.sortOrder).toBe(5)
    })

    test('should reject creation with empty name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/books`,
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
        url: `/my/stories/${storyId}/books`,
        payload: {
          name: 'Test Book',
        },
      })

      expect(response.statusCode).toBe(401)
      const body = response.json()
      expect(body.error).toBe('Authentication required')
    })

    test('should reject creation for non-existent story', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/my/stories/non-existent-id/books',
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          name: 'Test Book',
        },
      })

      expect(response.statusCode).toBe(404)
      const body = response.json()
      expect(body.error).toBe('Story not found')
    })

    test('should reject creation for story owned by another user', async () => {
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

      // Try to create book in first user's story
      const response = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/books`,
        cookies: {
          [user2Cookie.name]: user2Cookie.value,
        },
        payload: {
          name: 'Unauthorized Book',
        },
      })

      expect(response.statusCode).toBe(404)
      const body = response.json()
      expect(body.error).toBe('Story not found')
    })
  })

  describe('GET /my/stories/:storyId/books', () => {
    test('should list books in a story', async () => {
      // Create a few books
      await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/books`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Book 1', sortOrder: 1 },
      })

      await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/books`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Book 2', sortOrder: 0 },
      })

      // List books
      const response = await app.inject({
        method: 'GET',
        url: `/my/stories/${storyId}/books`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.books).toHaveLength(2)
      // Should be sorted by sortOrder
      expect(body.books[0].name).toBe('Book 2')
      expect(body.books[1].name).toBe('Book 1')
    })

    test('should return empty array for story with no books', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/stories/${storyId}/books`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.books).toEqual([])
    })

    test('should reject without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/stories/${storyId}/books`,
      })

      expect(response.statusCode).toBe(401)
      const body = response.json()
      expect(body.error).toBe('Authentication required')
    })

    test('should reject for non-existent story', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/my/stories/non-existent-id/books',
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(404)
      const body = response.json()
      expect(body.error).toBe('Story not found')
    })
  })

  describe('GET /my/books/:id', () => {
    let bookId: string

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/books`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Test Book' },
      })

      bookId = response.json().book.id
    })

    test('should get a single book', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/books/${bookId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.book.id).toBe(bookId)
      expect(body.book.name).toBe('Test Book')
    })

    test('should reject without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/books/${bookId}`,
      })

      expect(response.statusCode).toBe(401)
      const body = response.json()
      expect(body.error).toBe('Authentication required')
    })

    test('should reject for non-existent book', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/my/books/non-existent-id',
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(404)
      const body = response.json()
      expect(body.error).toBe('Book not found')
    })
  })

  describe('PATCH /my/books/:id', () => {
    let bookId: string

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/books`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Original Name', summary: 'Original summary' },
      })

      bookId = response.json().book.id
    })

    test('should update book successfully', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/books/${bookId}`,
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
      expect(body.book.name).toBe('Updated Name')
      expect(body.book.summary).toBe('Updated summary')
      expect(body.book.nodeType).toBe('context')
      expect(body.book.sortOrder).toBe(5)
    })

    test('should update only specified fields', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/books/${bookId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          name: 'New Name Only',
        },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.book.name).toBe('New Name Only')
      expect(body.book.summary).toBe('Original summary')
    })

    test('should reject update with empty name', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/books/${bookId}`,
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
        url: `/my/books/${bookId}`,
        payload: {
          name: 'New Name',
        },
      })

      expect(response.statusCode).toBe(401)
      const body = response.json()
      expect(body.error).toBe('Authentication required')
    })

    test('should reject for non-existent book', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/my/books/non-existent-id',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          name: 'New Name',
        },
      })

      expect(response.statusCode).toBe(404)
      const body = response.json()
      expect(body.error).toBe('Book not found')
    })
  })

  describe('DELETE /my/books/:id', () => {
    let bookId: string

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/books`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Book to Delete' },
      })

      bookId = response.json().book.id
    })

    test('should delete book successfully', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/my/books/${bookId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)

      // Verify book is actually deleted
      const getResponse = await app.inject({
        method: 'GET',
        url: `/my/books/${bookId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(getResponse.statusCode).toBe(404)
    })

    test('should reject without authentication', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/my/books/${bookId}`,
      })

      expect(response.statusCode).toBe(401)
      const body = response.json()
      expect(body.error).toBe('Authentication required')
    })

    test('should reject for non-existent book', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/my/books/non-existent-id',
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(404)
      const body = response.json()
      expect(body.error).toBe('Book not found')
    })
  })
})
