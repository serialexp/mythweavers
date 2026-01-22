import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { buildApp, cleanDatabase } from './helpers.ts'
import { prisma } from '../src/lib/prisma.js'

describe('Messages Batch API', () => {
  let app: FastifyInstance
  let sessionToken: string
  let userId: number
  let storyId: string
  let sceneId: string

  beforeAll(async () => {
    app = await buildApp()

    // Create test user
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: 'batch-test@example.com',
        password: 'testpassword123',
        username: 'batchtest',
      },
    })
    expect(registerResponse.statusCode).toBe(201)

    // Login and get session
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        username: 'batch-test@example.com',
        password: 'testpassword123',
      },
    })
    expect(loginResponse.statusCode).toBe(200)

    const cookies = loginResponse.cookies
    const sessionCookie = cookies.find((c) => c.name === 'sessionToken')
    expect(sessionCookie).toBeDefined()
    sessionToken = sessionCookie!.value

    // Get user ID
    const user = await prisma.user.findUnique({
      where: { email: 'batch-test@example.com' },
    })
    userId = user!.id

    // Create a story with book/arc/chapter/scene structure
    const storyResponse = await app.inject({
      method: 'POST',
      url: '/my/stories',
      cookies: { sessionToken },
      payload: {
        name: 'Batch Test Story',
        summary: 'Testing batch message creation',
      },
    })
    expect(storyResponse.statusCode).toBe(201)
    storyId = storyResponse.json().story.id

    // Create book
    const bookResponse = await app.inject({
      method: 'POST',
      url: `/my/stories/${storyId}/books`,
      cookies: { sessionToken },
      payload: { name: 'Book 1' },
    })
    expect(bookResponse.statusCode).toBe(201)
    const bookId = bookResponse.json().book.id

    // Create arc
    const arcResponse = await app.inject({
      method: 'POST',
      url: `/my/books/${bookId}/arcs`,
      cookies: { sessionToken },
      payload: { name: 'Arc 1' },
    })
    expect(arcResponse.statusCode).toBe(201)
    const arcId = arcResponse.json().arc.id

    // Create chapter
    const chapterResponse = await app.inject({
      method: 'POST',
      url: `/my/arcs/${arcId}/chapters`,
      cookies: { sessionToken },
      payload: { name: 'Chapter 1' },
    })
    expect(chapterResponse.statusCode).toBe(201)
    const chapterId = chapterResponse.json().chapter.id

    // Create scene
    const sceneResponse = await app.inject({
      method: 'POST',
      url: `/my/chapters/${chapterId}/scenes`,
      cookies: { sessionToken },
      payload: { name: 'Scene 1' },
    })
    expect(sceneResponse.statusCode).toBe(201)
    sceneId = sceneResponse.json().scene.id
  })

  afterAll(async () => {
    await cleanDatabase()
  })

  test('should create multiple messages in batch', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/my/stories/${storyId}/messages/batch`,
      cookies: { sessionToken },
      payload: {
        messages: [
          {
            sceneId,
            sortOrder: 0,
            instruction: 'Begin the story',
            paragraphs: [{ body: 'Once upon a time...', sortOrder: 0 }],
          },
          {
            sceneId,
            sortOrder: 1,
            instruction: 'Continue',
            paragraphs: [
              { body: 'The hero set out.', sortOrder: 0 },
              { body: 'Adventures awaited.', sortOrder: 1 },
            ],
          },
          {
            sceneId,
            sortOrder: 2,
            paragraphs: [{ body: 'The end.', sortOrder: 0 }],
          },
        ],
      },
    })

    expect(response.statusCode).toBe(201)
    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.created).toBe(3)
    expect(body.messageIds).toHaveLength(3)
  })

  test('should create messages with client-provided IDs', async () => {
    const customId1 = 'custom-msg-id-1'
    const customId2 = 'custom-msg-id-2'

    const response = await app.inject({
      method: 'POST',
      url: `/my/stories/${storyId}/messages/batch`,
      cookies: { sessionToken },
      payload: {
        messages: [
          {
            id: customId1,
            sceneId,
            sortOrder: 100,
            paragraphs: [{ body: 'Test content 1', sortOrder: 0 }],
          },
          {
            id: customId2,
            sceneId,
            sortOrder: 101,
            paragraphs: [{ body: 'Test content 2', sortOrder: 0 }],
          },
        ],
      },
    })

    expect(response.statusCode).toBe(201)
    const body = response.json()
    expect(body.messageIds).toContain(customId1)
    expect(body.messageIds).toContain(customId2)
  })

  test('should fail with non-existent scene', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/my/stories/${storyId}/messages/batch`,
      cookies: { sessionToken },
      payload: {
        messages: [
          {
            sceneId: 'non-existent-scene',
            sortOrder: 0,
            paragraphs: [{ body: 'Test', sortOrder: 0 }],
          },
        ],
      },
    })

    expect(response.statusCode).toBe(404)
  })

  test('should fail without authentication', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/my/stories/${storyId}/messages/batch`,
      payload: {
        messages: [
          {
            sceneId,
            sortOrder: 0,
            paragraphs: [{ body: 'Test', sortOrder: 0 }],
          },
        ],
      },
    })

    expect(response.statusCode).toBe(401)
  })

  test('should create messages without paragraphs', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/my/stories/${storyId}/messages/batch`,
      cookies: { sessionToken },
      payload: {
        messages: [
          {
            sceneId,
            sortOrder: 200,
            instruction: 'A message without content',
          },
        ],
      },
    })

    expect(response.statusCode).toBe(201)
    const body = response.json()
    expect(body.created).toBe(1)
  })

  test('should handle large batch efficiently', async () => {
    // Create 100 messages in one batch
    const messages = Array.from({ length: 100 }, (_, i) => ({
      sceneId,
      sortOrder: 1000 + i,
      paragraphs: [{ body: `Message ${i} content`, sortOrder: 0 }],
    }))

    const startTime = Date.now()
    const response = await app.inject({
      method: 'POST',
      url: `/my/stories/${storyId}/messages/batch`,
      cookies: { sessionToken },
      payload: { messages },
    })
    const duration = Date.now() - startTime

    expect(response.statusCode).toBe(201)
    const body = response.json()
    expect(body.created).toBe(100)
    expect(body.messageIds).toHaveLength(100)

    // Should complete in reasonable time (less than 10 seconds)
    console.log(`Created 100 messages in ${duration}ms`)
    expect(duration).toBeLessThan(10000)
  })

  test('should persist instructions in database', async () => {
    // Create messages with instructions
    const createResponse = await app.inject({
      method: 'POST',
      url: `/my/stories/${storyId}/messages/batch`,
      cookies: { sessionToken },
      payload: {
        messages: [
          {
            sceneId,
            sortOrder: 300,
            instruction: 'Write a dramatic opening scene',
            paragraphs: [{ body: 'The story begins...', sortOrder: 0 }],
          },
          {
            sceneId,
            sortOrder: 301,
            instruction: 'Continue with tension',
            paragraphs: [{ body: 'The plot thickens...', sortOrder: 0 }],
          },
        ],
      },
    })

    expect(createResponse.statusCode).toBe(201)
    const createdIds = createResponse.json().messageIds

    // Now fetch the story via the export endpoint to verify instructions persisted
    const exportResponse = await app.inject({
      method: 'GET',
      url: `/my/stories/${storyId}/export`,
      cookies: { sessionToken },
    })

    expect(exportResponse.statusCode).toBe(200)
    const storyData = exportResponse.json()

    // Find the messages we just created
    const messages: any[] = []
    for (const book of storyData.books) {
      for (const arc of book.arcs) {
        for (const chapter of arc.chapters) {
          for (const scene of chapter.scenes) {
            messages.push(...scene.messages)
          }
        }
      }
    }

    // Verify our created messages have instructions
    const createdMsg1 = messages.find((m) => m.id === createdIds[0])
    const createdMsg2 = messages.find((m) => m.id === createdIds[1])

    expect(createdMsg1).toBeDefined()
    expect(createdMsg1.instruction).toBe('Write a dramatic opening scene')
    expect(createdMsg2).toBeDefined()
    expect(createdMsg2.instruction).toBe('Continue with tension')
  })
})
