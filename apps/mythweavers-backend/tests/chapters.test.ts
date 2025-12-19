import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { buildApp, cleanDatabase } from './helpers.js'

describe('Chapter Endpoints', () => {
  let app: FastifyInstance
  let sessionCookie: { name: string; value: string }
  let _userId: number
  let storyId: string
  let bookId: string
  let arcId: string

  beforeEach(async () => {
    app = await buildApp()
    await cleanDatabase()

    // Register a test user
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

    // Create test story
    const storyResponse = await app.inject({
      method: 'POST',
      url: '/my/stories',
      cookies: { [sessionCookie.name]: sessionCookie.value },
      payload: { name: 'Test Story' },
    })
    storyId = storyResponse.json().story.id

    // Create test book
    const bookResponse = await app.inject({
      method: 'POST',
      url: `/my/stories/${storyId}/books`,
      cookies: { [sessionCookie.name]: sessionCookie.value },
      payload: { name: 'Test Book' },
    })
    bookId = bookResponse.json().book.id

    // Create test arc
    const arcResponse = await app.inject({
      method: 'POST',
      url: `/my/books/${bookId}/arcs`,
      cookies: { [sessionCookie.name]: sessionCookie.value },
      payload: { name: 'Test Arc' },
    })
    arcId = arcResponse.json().arc.id
  })

  afterEach(async () => {
    await app.close()
  })

  describe('POST /my/arcs/:arcId/chapters', () => {
    test('should create a new chapter successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/arcs/${arcId}/chapters`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          name: 'Chapter 1: The Awakening',
          summary: 'The hero awakens...',
          nodeType: 'story',
        },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.chapter).toMatchObject({
        id: expect.any(String),
        name: 'Chapter 1: The Awakening',
        summary: 'The hero awakens...',
        arcId,
        publishedOn: null,
        sortOrder: 0,
        royalRoadId: null,
        nodeType: 'story',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      })
    })

    test('should create chapter with minimal fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/arcs/${arcId}/chapters`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Simple Chapter' },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.chapter.name).toBe('Simple Chapter')
      expect(body.chapter.summary).toBeNull()
      expect(body.chapter.nodeType).toBe('story')
      expect(body.chapter.sortOrder).toBe(0)
    })

    test('should auto-increment sortOrder', async () => {
      const response1 = await app.inject({
        method: 'POST',
        url: `/my/arcs/${arcId}/chapters`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Chapter 1' },
      })
      expect(response1.json().chapter.sortOrder).toBe(0)

      const response2 = await app.inject({
        method: 'POST',
        url: `/my/arcs/${arcId}/chapters`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Chapter 2' },
      })
      expect(response2.json().chapter.sortOrder).toBe(1)
    })

    test('should reject creation with empty name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/arcs/${arcId}/chapters`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: '' },
      })

      expect(response.statusCode).toBe(400)
    })

    test('should reject without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/arcs/${arcId}/chapters`,
        payload: { name: 'Test' },
      })

      expect(response.statusCode).toBe(401)
    })

    test('should reject for non-existent arc', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/my/arcs/non-existent/chapters',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Test' },
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('GET /my/arcs/:arcId/chapters', () => {
    test('should list chapters in an arc', async () => {
      await app.inject({
        method: 'POST',
        url: `/my/arcs/${arcId}/chapters`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Chapter 1', sortOrder: 1 },
      })

      await app.inject({
        method: 'POST',
        url: `/my/arcs/${arcId}/chapters`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Chapter 2', sortOrder: 0 },
      })

      const response = await app.inject({
        method: 'GET',
        url: `/my/arcs/${arcId}/chapters`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.chapters).toHaveLength(2)
      expect(body.chapters[0].name).toBe('Chapter 2')
      expect(body.chapters[1].name).toBe('Chapter 1')
    })

    test('should return empty array for arc with no chapters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/arcs/${arcId}/chapters`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().chapters).toEqual([])
    })
  })

  describe('GET /my/chapters/:id', () => {
    let chapterId: string

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/arcs/${arcId}/chapters`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Test Chapter' },
      })
      chapterId = response.json().chapter.id
    })

    test('should get a single chapter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/chapters/${chapterId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().chapter.id).toBe(chapterId)
    })

    test('should reject without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/chapters/${chapterId}`,
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('PATCH /my/chapters/:id', () => {
    let chapterId: string

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/arcs/${arcId}/chapters`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Original Name', summary: 'Original summary' },
      })
      chapterId = response.json().chapter.id
    })

    test('should update chapter successfully', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/chapters/${chapterId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          name: 'Updated Name',
          summary: 'Updated summary',
        },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.chapter.name).toBe('Updated Name')
      expect(body.chapter.summary).toBe('Updated summary')
    })

    test('should update only specified fields', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/chapters/${chapterId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'New Name Only' },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().chapter.name).toBe('New Name Only')
      expect(response.json().chapter.summary).toBe('Original summary')
    })
  })

  describe('DELETE /my/chapters/:id', () => {
    let chapterId: string

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/arcs/${arcId}/chapters`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'To Delete' },
      })
      chapterId = response.json().chapter.id
    })

    test('should delete chapter successfully', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/my/chapters/${chapterId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().success).toBe(true)

      // Verify deletion
      const getResponse = await app.inject({
        method: 'GET',
        url: `/my/chapters/${chapterId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })
      expect(getResponse.statusCode).toBe(404)
    })
  })
})
