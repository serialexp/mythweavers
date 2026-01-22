import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { buildApp, cleanDatabase } from './helpers.js'

describe('Paragraph Endpoints', () => {
  let app: FastifyInstance
  let sessionCookie: { name: string; value: string }
  let _userId: number
  let storyId: string
  let bookId: string
  let arcId: string
  let chapterId: string
  let sceneId: string
  let _messageId: string
  let revisionId: string

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

    // Create test hierarchy: story → book → arc → chapter → scene → message → revision
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

    const messageResponse = await app.inject({
      method: 'POST',
      url: `/my/scenes/${sceneId}/messages`,
      cookies: { [sessionCookie.name]: sessionCookie.value },
      payload: {},
    })
    _messageId = messageResponse.json().message.id
    revisionId = messageResponse.json().message.currentMessageRevisionId
  })

  afterEach(async () => {
    await app.close()
  })

  describe('POST /my/message-revisions/:revisionId/paragraphs', () => {
    test('should create a new paragraph successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/message-revisions/${revisionId}/paragraphs`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          body: 'The hero awakened to find the world transformed.',
          state: 'DRAFT',
          plotPointActions: [{ plot_point_id: 'plot123', action: 'introduce' }],
          inventoryActions: [{ type: 'add', character_name: 'Hero', item_name: 'Magic Sword', item_amount: 1 }],
          sortOrder: 5,
        },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.paragraph).toMatchObject({
        id: expect.any(String),
        messageRevisionId: revisionId,
        sortOrder: 5,
        currentParagraphRevisionId: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      })
    })

    test('should create paragraph with minimal fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/message-revisions/${revisionId}/paragraphs`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          body: 'Simple paragraph text.',
        },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.paragraph.sortOrder).toBe(0)
      expect(body.paragraph.currentParagraphRevisionId).toBeTruthy()
    })

    test('should auto-increment sortOrder', async () => {
      const response1 = await app.inject({
        method: 'POST',
        url: `/my/message-revisions/${revisionId}/paragraphs`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { body: 'First paragraph' },
      })
      expect(response1.json().paragraph.sortOrder).toBe(0)

      const response2 = await app.inject({
        method: 'POST',
        url: `/my/message-revisions/${revisionId}/paragraphs`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { body: 'Second paragraph' },
      })
      expect(response2.json().paragraph.sortOrder).toBe(1)
    })

    test('should reject with empty body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/message-revisions/${revisionId}/paragraphs`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { body: '' },
      })

      expect(response.statusCode).toBe(400)
    })

    test('should reject without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/message-revisions/${revisionId}/paragraphs`,
        payload: { body: 'Test' },
      })

      expect(response.statusCode).toBe(401)
    })

    test('should reject for non-existent revision', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/my/message-revisions/non-existent/paragraphs',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { body: 'Test' },
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('GET /my/message-revisions/:revisionId/paragraphs', () => {
    test('should list paragraphs in a message revision', async () => {
      await app.inject({
        method: 'POST',
        url: `/my/message-revisions/${revisionId}/paragraphs`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { body: 'Paragraph 1', sortOrder: 1 },
      })

      await app.inject({
        method: 'POST',
        url: `/my/message-revisions/${revisionId}/paragraphs`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { body: 'Paragraph 0', sortOrder: 0 },
      })

      const response = await app.inject({
        method: 'GET',
        url: `/my/message-revisions/${revisionId}/paragraphs`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.paragraphs).toHaveLength(2)
      // Should be ordered by sortOrder ASC
      expect(body.paragraphs[0].sortOrder).toBe(0)
      expect(body.paragraphs[1].sortOrder).toBe(1)
    })

    test('should return empty array for revision with no paragraphs', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/message-revisions/${revisionId}/paragraphs`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().paragraphs).toEqual([])
    })
  })

  describe('GET /my/paragraphs/:id', () => {
    let paragraphId: string

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/message-revisions/${revisionId}/paragraphs`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { body: 'Test paragraph content.' },
      })
      paragraphId = response.json().paragraph.id
    })

    test('should get a single paragraph', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/paragraphs/${paragraphId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.paragraph.id).toBe(paragraphId)
      expect(body.paragraph.messageRevisionId).toBe(revisionId)
    })

    test('should reject without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/paragraphs/${paragraphId}`,
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('PATCH /my/paragraphs/:id', () => {
    let paragraphId: string

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/message-revisions/${revisionId}/paragraphs`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          body: 'Original paragraph text.',
          state: 'DRAFT',
          sortOrder: 0,
        },
      })
      paragraphId = response.json().paragraph.id
    })

    test('should update paragraph body (creates new ParagraphRevision)', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/paragraphs/${paragraphId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          body: 'Updated paragraph text with more details.',
          state: 'FINAL',
        },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)

      // Verify new revision was created by checking revision history
      const revisionsResponse = await app.inject({
        method: 'GET',
        url: `/my/paragraphs/${paragraphId}/revisions`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })
      expect(revisionsResponse.json().revisions).toHaveLength(2)
      expect(revisionsResponse.json().revisions[0].version).toBe(2)
      expect(revisionsResponse.json().revisions[0].body).toBe('Updated paragraph text with more details.')
      expect(revisionsResponse.json().revisions[0].state).toBe('FINAL')
    })

    test('should update sortOrder without creating new revision', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/paragraphs/${paragraphId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          sortOrder: 5,
        },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().paragraph.sortOrder).toBe(5)

      // Verify no new revision was created
      const revisionsResponse = await app.inject({
        method: 'GET',
        url: `/my/paragraphs/${paragraphId}/revisions`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })
      expect(revisionsResponse.json().revisions).toHaveLength(1)
    })

    test('should preserve previous revision fields when updating body', async () => {
      // First, create a paragraph with plotPointActions
      const createResponse = await app.inject({
        method: 'POST',
        url: `/my/message-revisions/${revisionId}/paragraphs`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          body: 'Original',
          state: 'DRAFT',
          plotPointActions: [{ plot_point_id: 'plot123', action: 'introduce' }],
          inventoryActions: [{ type: 'add', character_name: 'Hero', item_name: 'Magic Sword', item_amount: 1 }],
        },
      })
      const newParagraphId = createResponse.json().paragraph.id

      // Update only the body
      await app.inject({
        method: 'PATCH',
        url: `/my/paragraphs/${newParagraphId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          body: 'Updated body only',
        },
      })

      // Check that the new revision preserved the old fields
      const revisionsResponse = await app.inject({
        method: 'GET',
        url: `/my/paragraphs/${newParagraphId}/revisions`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })
      const latestRevision = revisionsResponse.json().revisions[0]
      expect(latestRevision.body).toBe('Updated body only')
      expect(latestRevision.state).toBe('DRAFT') // Preserved
      expect(latestRevision.plotPointActions).toEqual([{ plot_point_id: 'plot123', action: 'introduce' }]) // Preserved
      expect(latestRevision.inventoryActions).toEqual([{ type: 'add', character_name: 'Hero', item_name: 'Magic Sword', item_amount: 1 }]) // Preserved
    })

    test('should allow empty body (for prelude to deletion)', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/paragraphs/${paragraphId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          body: '',
        },
      })

      // Empty string is intentionally allowed for update (prelude to deletion)
      expect(response.statusCode).toBe(200)
    })
  })

  describe('DELETE /my/paragraphs/:id', () => {
    let paragraphId: string

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/message-revisions/${revisionId}/paragraphs`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { body: 'To be deleted' },
      })
      paragraphId = response.json().paragraph.id
    })

    test('should delete paragraph successfully', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/my/paragraphs/${paragraphId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().success).toBe(true)

      // Verify deletion
      const getResponse = await app.inject({
        method: 'GET',
        url: `/my/paragraphs/${paragraphId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })
      expect(getResponse.statusCode).toBe(404)
    })
  })

  describe('GET /my/paragraphs/:paragraphId/revisions', () => {
    let paragraphId: string

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/message-revisions/${revisionId}/paragraphs`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { body: 'Version 1' },
      })
      paragraphId = response.json().paragraph.id

      // Create additional revisions by editing
      await app.inject({
        method: 'PATCH',
        url: `/my/paragraphs/${paragraphId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { body: 'Version 2' },
      })

      await app.inject({
        method: 'PATCH',
        url: `/my/paragraphs/${paragraphId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { body: 'Version 3' },
      })
    })

    test('should list all paragraph revisions', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/paragraphs/${paragraphId}/revisions`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.revisions).toHaveLength(3)
      // Should be ordered by version DESC
      expect(body.revisions[0].version).toBe(3)
      expect(body.revisions[0].body).toBe('Version 3')
      expect(body.revisions[1].version).toBe(2)
      expect(body.revisions[1].body).toBe('Version 2')
      expect(body.revisions[2].version).toBe(1)
      expect(body.revisions[2].body).toBe('Version 1')
    })
  })
})
