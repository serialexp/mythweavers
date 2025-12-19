import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { buildApp, cleanDatabase } from './helpers.js'

describe('Message Endpoints', () => {
  let app: FastifyInstance
  let sessionCookie: { name: string; value: string }
  let _userId: number
  let storyId: string
  let bookId: string
  let arcId: string
  let chapterId: string
  let sceneId: string

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

    // Create test hierarchy: story → book → arc → chapter → scene
    const storyResponse = await app.inject({
      method: 'POST',
      url: '/my/stories',
      cookies: { [sessionCookie.name]: sessionCookie.value },
      payload: { name: 'Test Story' },
    })
    storyId = storyResponse.json().story.id

    const bookResponse = await app.inject({
      method: 'POST',
      url: `/my/stories/${storyId}/books`,
      cookies: { [sessionCookie.name]: sessionCookie.value },
      payload: { name: 'Test Book' },
    })
    bookId = bookResponse.json().book.id

    const arcResponse = await app.inject({
      method: 'POST',
      url: `/my/books/${bookId}/arcs`,
      cookies: { [sessionCookie.name]: sessionCookie.value },
      payload: { name: 'Test Arc' },
    })
    arcId = arcResponse.json().arc.id

    const chapterResponse = await app.inject({
      method: 'POST',
      url: `/my/arcs/${arcId}/chapters`,
      cookies: { [sessionCookie.name]: sessionCookie.value },
      payload: { name: 'Test Chapter' },
    })
    chapterId = chapterResponse.json().chapter.id

    const sceneResponse = await app.inject({
      method: 'POST',
      url: `/my/chapters/${chapterId}/scenes`,
      cookies: { [sessionCookie.name]: sessionCookie.value },
      payload: { name: 'Test Scene' },
    })
    sceneId = sceneResponse.json().scene.id
  })

  afterEach(async () => {
    await app.close()
  })

  describe('POST /my/scenes/:sceneId/messages', () => {
    test('should create a new message successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/scenes/${sceneId}/messages`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          instruction: 'Write a dramatic opening',
          script: 'console.log("test")',
          sortOrder: 5,
        },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.message).toMatchObject({
        id: expect.any(String),
        sceneId,
        sortOrder: 5,
        instruction: 'Write a dramatic opening',
        script: 'console.log("test")',
        currentMessageRevisionId: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      })
    })

    test('should create message with minimal fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/scenes/${sceneId}/messages`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {},
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.message.instruction).toBeNull()
      expect(body.message.script).toBeNull()
      expect(body.message.sortOrder).toBe(0)
      expect(body.message.currentMessageRevisionId).toBeTruthy()
    })

    test('should auto-increment sortOrder', async () => {
      const response1 = await app.inject({
        method: 'POST',
        url: `/my/scenes/${sceneId}/messages`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {},
      })
      expect(response1.json().message.sortOrder).toBe(0)

      const response2 = await app.inject({
        method: 'POST',
        url: `/my/scenes/${sceneId}/messages`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {},
      })
      expect(response2.json().message.sortOrder).toBe(1)
    })

    test('should reject without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/scenes/${sceneId}/messages`,
        payload: {},
      })

      expect(response.statusCode).toBe(401)
    })

    test('should reject for non-existent scene', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/my/scenes/non-existent/messages',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {},
      })

      expect(response.statusCode).toBe(404)
    })

    test('should reject for scene owned by another user', async () => {
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
      const otherCookie = otherUserResponse.cookies[0]

      const response = await app.inject({
        method: 'POST',
        url: `/my/scenes/${sceneId}/messages`,
        cookies: { [otherCookie.name]: otherCookie.value },
        payload: {},
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('GET /my/scenes/:sceneId/messages', () => {
    test('should list messages in a scene', async () => {
      await app.inject({
        method: 'POST',
        url: `/my/scenes/${sceneId}/messages`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { sortOrder: 1, instruction: 'Message 1' },
      })

      await app.inject({
        method: 'POST',
        url: `/my/scenes/${sceneId}/messages`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { sortOrder: 0, instruction: 'Message 0' },
      })

      const response = await app.inject({
        method: 'GET',
        url: `/my/scenes/${sceneId}/messages`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.messages).toHaveLength(2)
      expect(body.messages[0].instruction).toBe('Message 0')
      expect(body.messages[1].instruction).toBe('Message 1')
    })

    test('should return empty array for scene with no messages', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/scenes/${sceneId}/messages`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().messages).toEqual([])
    })
  })

  describe('GET /my/messages/:id', () => {
    let messageId: string

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/scenes/${sceneId}/messages`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { instruction: 'Test Message' },
      })
      messageId = response.json().message.id
    })

    test('should get a single message', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/messages/${messageId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.message.id).toBe(messageId)
      expect(body.message.instruction).toBe('Test Message')
    })

    test('should reject without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/messages/${messageId}`,
      })

      expect(response.statusCode).toBe(401)
    })

    test('should reject for message owned by another user', async () => {
      const otherUserResponse = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'other@example.com',
          username: 'otheruser',
          password: 'password123',
        },
      })
      const otherCookie = otherUserResponse.cookies[0]

      const response = await app.inject({
        method: 'GET',
        url: `/my/messages/${messageId}`,
        cookies: { [otherCookie.name]: otherCookie.value },
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('PATCH /my/messages/:id', () => {
    let messageId: string

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/scenes/${sceneId}/messages`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          instruction: 'Original instruction',
          script: 'Original script',
          sortOrder: 0,
        },
      })
      messageId = response.json().message.id
    })

    test('should update message successfully', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/messages/${messageId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          instruction: 'Updated instruction',
          script: 'Updated script',
          sortOrder: 5,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.message.instruction).toBe('Updated instruction')
      expect(body.message.script).toBe('Updated script')
      expect(body.message.sortOrder).toBe(5)
    })

    test('should update only specified fields', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/messages/${messageId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { instruction: 'New instruction only' },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.message.instruction).toBe('New instruction only')
      expect(body.message.script).toBe('Original script')
      expect(body.message.sortOrder).toBe(0)
    })
  })

  describe('DELETE /my/messages/:id', () => {
    let messageId: string

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/scenes/${sceneId}/messages`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {},
      })
      messageId = response.json().message.id
    })

    test('should delete message successfully', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/my/messages/${messageId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().success).toBe(true)

      // Verify deletion
      const getResponse = await app.inject({
        method: 'GET',
        url: `/my/messages/${messageId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })
      expect(getResponse.statusCode).toBe(404)
    })
  })

  describe('POST /my/messages/:id/regenerate', () => {
    let messageId: string

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/scenes/${sceneId}/messages`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {},
      })
      messageId = response.json().message.id
    })

    test('should regenerate message (create new MessageRevision)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/messages/${messageId}/regenerate`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          model: 'claude-sonnet-4.5',
          tokensPerSecond: 42.5,
          totalTokens: 1500,
          promptTokens: 800,
          cacheCreationTokens: 200,
          cacheReadTokens: 500,
          think: 'The scene should establish...',
          showThink: true,
        },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)

      // Store the actual revision ID before using toMatchObject
      const newRevisionId = body.revision.id

      expect(body.revision).toMatchObject({
        id: expect.any(String),
        messageId,
        version: 2, // Second version
        model: 'claude-sonnet-4.5',
        tokensPerSecond: 42.5,
        totalTokens: 1500,
        promptTokens: 800,
        cacheCreationTokens: 200,
        cacheReadTokens: 500,
        think: 'The scene should establish...',
        showThink: true,
        createdAt: expect.any(String),
      })

      // Verify message's currentMessageRevisionId was updated
      const messageResponse = await app.inject({
        method: 'GET',
        url: `/my/messages/${messageId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })
      const fetchedMessage = messageResponse.json().message
      expect(fetchedMessage.currentMessageRevisionId).toBe(newRevisionId)
    })

    test('should create revision with minimal fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/messages/${messageId}/regenerate`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {},
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.revision.version).toBe(2)
      expect(body.revision.model).toBeNull()
      expect(body.revision.showThink).toBe(false)
    })
  })

  describe('GET /my/messages/:messageId/revisions', () => {
    let messageId: string

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/scenes/${sceneId}/messages`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {},
      })
      messageId = response.json().message.id

      // Create additional revisions
      await app.inject({
        method: 'POST',
        url: `/my/messages/${messageId}/regenerate`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { model: 'model-v2' },
      })

      await app.inject({
        method: 'POST',
        url: `/my/messages/${messageId}/regenerate`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { model: 'model-v3' },
      })
    })

    test('should list all message revisions', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/messages/${messageId}/revisions`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.revisions).toHaveLength(3)
      // Should be ordered by version DESC
      expect(body.revisions[0].version).toBe(3)
      expect(body.revisions[0].model).toBe('model-v3')
      expect(body.revisions[1].version).toBe(2)
      expect(body.revisions[1].model).toBe('model-v2')
      expect(body.revisions[2].version).toBe(1)
      expect(body.revisions[2].model).toBeNull()
    })
  })
})
