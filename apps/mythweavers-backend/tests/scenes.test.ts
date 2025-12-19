import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { buildApp, cleanDatabase } from './helpers.js'

describe('Scene Endpoints', () => {
  let app: FastifyInstance
  let sessionCookie: { name: string; value: string }
  let _userId: number
  let storyId: string
  let bookId: string
  let arcId: string
  let chapterId: string

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

    // Create test chapter
    const chapterResponse = await app.inject({
      method: 'POST',
      url: `/my/arcs/${arcId}/chapters`,
      cookies: { [sessionCookie.name]: sessionCookie.value },
      payload: { name: 'Test Chapter' },
    })
    chapterId = chapterResponse.json().chapter.id
  })

  afterEach(async () => {
    await app.close()
  })

  describe('POST /my/chapters/:chapterId/scenes', () => {
    test('should create a new scene successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/chapters/${chapterId}/scenes`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          name: 'The Hero Awakens',
          summary: 'The hero wakes up...',
          perspective: 'THIRD',
          storyTime: 1440,
          activeCharacterIds: ['char1', 'char2'],
          activeContextItemIds: ['ctx1'],
          viewpointCharacterId: 'char1',
          goal: 'Introduce the hero',
        },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.scene).toMatchObject({
        id: expect.any(String),
        name: 'The Hero Awakens',
        summary: 'The hero wakes up...',
        chapterId,
        sortOrder: 0,
        perspective: 'THIRD',
        storyTime: 1440,
        activeCharacterIds: ['char1', 'char2'],
        activeContextItemIds: ['ctx1'],
        viewpointCharacterId: 'char1',
        goal: 'Introduce the hero',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      })
    })

    test('should create scene with minimal fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/chapters/${chapterId}/scenes`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Simple Scene' },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.scene.name).toBe('Simple Scene')
      expect(body.scene.summary).toBeNull()
      expect(body.scene.perspective).toBeNull()
      expect(body.scene.viewpointCharacterId).toBeNull()
      expect(body.scene.activeCharacterIds).toBeNull()
      expect(body.scene.activeContextItemIds).toBeNull()
      expect(body.scene.goal).toBeNull()
      expect(body.scene.storyTime).toBeNull()
    })

    test('should auto-increment sortOrder', async () => {
      const response1 = await app.inject({
        method: 'POST',
        url: `/my/chapters/${chapterId}/scenes`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Scene 1' },
      })
      expect(response1.json().scene.sortOrder).toBe(0)

      const response2 = await app.inject({
        method: 'POST',
        url: `/my/chapters/${chapterId}/scenes`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Scene 2' },
      })
      expect(response2.json().scene.sortOrder).toBe(1)
    })

    test('should reject creation with empty name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/chapters/${chapterId}/scenes`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: '' },
      })

      expect(response.statusCode).toBe(400)
    })

    test('should reject without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/chapters/${chapterId}/scenes`,
        payload: { name: 'Test' },
      })

      expect(response.statusCode).toBe(401)
    })

    test('should reject for non-existent chapter', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/my/chapters/non-existent/scenes',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Test' },
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('GET /my/chapters/:chapterId/scenes', () => {
    test('should list scenes in a chapter', async () => {
      await app.inject({
        method: 'POST',
        url: `/my/chapters/${chapterId}/scenes`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Scene 1', sortOrder: 1 },
      })

      await app.inject({
        method: 'POST',
        url: `/my/chapters/${chapterId}/scenes`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Scene 2', sortOrder: 0 },
      })

      const response = await app.inject({
        method: 'GET',
        url: `/my/chapters/${chapterId}/scenes`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.scenes).toHaveLength(2)
      expect(body.scenes[0].name).toBe('Scene 2')
      expect(body.scenes[1].name).toBe('Scene 1')
    })

    test('should return empty array for chapter with no scenes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/chapters/${chapterId}/scenes`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().scenes).toEqual([])
    })
  })

  describe('GET /my/scenes/:id', () => {
    let sceneId: string

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/chapters/${chapterId}/scenes`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Test Scene', goal: 'Test the GET endpoint' },
      })
      sceneId = response.json().scene.id
    })

    test('should get a single scene', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/scenes/${sceneId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.scene.id).toBe(sceneId)
      expect(body.scene.name).toBe('Test Scene')
      expect(body.scene.goal).toBe('Test the GET endpoint')
    })

    test('should reject without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/scenes/${sceneId}`,
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('PATCH /my/scenes/:id', () => {
    let sceneId: string

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/chapters/${chapterId}/scenes`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Original Name', summary: 'Original summary', goal: 'Original goal' },
      })
      sceneId = response.json().scene.id
    })

    test('should update scene successfully', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/scenes/${sceneId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          name: 'Updated Name',
          summary: 'Updated summary',
          goal: 'Updated goal',
          perspective: 'FIRST',
          storyTime: 2880,
          activeCharacterIds: ['char1'],
          viewpointCharacterId: 'char1',
        },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.scene.name).toBe('Updated Name')
      expect(body.scene.summary).toBe('Updated summary')
      expect(body.scene.goal).toBe('Updated goal')
      expect(body.scene.perspective).toBe('FIRST')
      expect(body.scene.storyTime).toBe(2880)
      expect(body.scene.activeCharacterIds).toEqual(['char1'])
      expect(body.scene.viewpointCharacterId).toBe('char1')
    })

    test('should update only specified fields', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/scenes/${sceneId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'New Name Only' },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.scene.name).toBe('New Name Only')
      expect(body.scene.summary).toBe('Original summary')
      expect(body.scene.goal).toBe('Original goal')
    })
  })

  describe('DELETE /my/scenes/:id', () => {
    let sceneId: string

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/chapters/${chapterId}/scenes`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'To Delete' },
      })
      sceneId = response.json().scene.id
    })

    test('should delete scene successfully', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/my/scenes/${sceneId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().success).toBe(true)

      // Verify deletion
      const getResponse = await app.inject({
        method: 'GET',
        url: `/my/scenes/${sceneId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })
      expect(getResponse.statusCode).toBe(404)
    })
  })
})
