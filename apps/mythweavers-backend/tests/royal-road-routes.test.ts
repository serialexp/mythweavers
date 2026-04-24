import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../src/lib/prisma.js'
import { buildApp, cleanDatabase } from './helpers.js'

/**
 * Covers Phase C Royal Road routes that touch stories and chapters:
 *
 *   GET   /my/royal-road/stories/:storyId
 *   PATCH /my/royal-road/stories/:storyId
 *   POST  /my/royal-road/stories/:storyId/chapters/:chapterId/link
 *   POST  /my/royal-road/stories/:storyId/chapters/:chapterId/unlink
 *   POST  /my/royal-road/stories/:storyId/chapters/:chapterId/retry
 *   GET   /my/royal-road/stories/:storyId/publishing-status
 *   POST  /my/royal-road/stories/:storyId/sync
 *
 * Worker behaviour itself (Playwright, backoff, claim races) is deferred to
 * integration smoke tests once we can exercise royalroad.com safely; these
 * route tests focus on the DB surface.
 */

type SessionCookie = { name: string; value: string }

async function registerUser(
  app: FastifyInstance,
  email: string,
  username: string,
): Promise<SessionCookie> {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email, username, password: 'password123' },
  })
  return response.cookies[0] as SessionCookie
}

async function createStoryWithChapter(app: FastifyInstance, cookie: SessionCookie) {
  const story = await app.inject({
    method: 'POST',
    url: '/my/stories',
    cookies: { [cookie.name]: cookie.value },
    payload: { name: 'RR Test Story' },
  })
  const storyId = story.json().story.id as string
  const book = await app.inject({
    method: 'POST',
    url: `/my/stories/${storyId}/books`,
    cookies: { [cookie.name]: cookie.value },
    payload: { name: 'Book 1' },
  })
  const bookId = book.json().book.id as string
  const arc = await app.inject({
    method: 'POST',
    url: `/my/books/${bookId}/arcs`,
    cookies: { [cookie.name]: cookie.value },
    payload: { name: 'Arc 1' },
  })
  const arcId = arc.json().arc.id as string
  const chapter = await app.inject({
    method: 'POST',
    url: `/my/arcs/${arcId}/chapters`,
    cookies: { [cookie.name]: cookie.value },
    payload: { name: 'Chapter 1' },
  })
  return { storyId, chapterId: chapter.json().chapter.id as string }
}

const TEST_ENC_KEY = 'abcdefghijklmnopqrstuvwxyz012345ABCDEFGHIJK='

describe('Royal Road story/chapter routes', () => {
  let app: FastifyInstance
  const originalEncKey = process.env.ROYAL_ROAD_ENC_KEY

  beforeAll(async () => {
    process.env.ROYAL_ROAD_ENC_KEY = TEST_ENC_KEY
    app = await buildApp()
  })

  afterAll(async () => {
    await app.close()
    if (originalEncKey === undefined) {
      delete process.env.ROYAL_ROAD_ENC_KEY
    } else {
      process.env.ROYAL_ROAD_ENC_KEY = originalEncKey
    }
  })

  beforeEach(async () => {
    await cleanDatabase()
  })

  test('GET story settings returns defaults for a fresh story', async () => {
    const cookie = await registerUser(app, 'rr-s1@example.com', 'rrS1')
    const { storyId } = await createStoryWithChapter(app, cookie)

    const res = await app.inject({
      method: 'GET',
      url: `/my/royal-road/stories/${storyId}`,
      cookies: { [cookie.name]: cookie.value },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      storyId,
      royalRoadId: null,
      publishingEnabled: false,
    })
  })

  test('PATCH story settings updates only the provided fields', async () => {
    const cookie = await registerUser(app, 'rr-s2@example.com', 'rrS2')
    const { storyId } = await createStoryWithChapter(app, cookie)

    // Set RR id alone.
    await app.inject({
      method: 'PATCH',
      url: `/my/royal-road/stories/${storyId}`,
      cookies: { [cookie.name]: cookie.value },
      payload: { royalRoadId: 12345 },
    })
    // Enable publishing alone.
    const res = await app.inject({
      method: 'PATCH',
      url: `/my/royal-road/stories/${storyId}`,
      cookies: { [cookie.name]: cookie.value },
      payload: { publishingEnabled: true },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      storyId,
      royalRoadId: 12345,
      publishingEnabled: true,
    })
    // Clear RR id.
    const cleared = await app.inject({
      method: 'PATCH',
      url: `/my/royal-road/stories/${storyId}`,
      cookies: { [cookie.name]: cookie.value },
      payload: { royalRoadId: null },
    })
    expect(cleared.json()).toEqual({
      storyId,
      royalRoadId: null,
      publishingEnabled: true,
    })
  })

  test('chapter link / unlink updates Chapter.royalRoadId', async () => {
    const cookie = await registerUser(app, 'rr-c1@example.com', 'rrC1')
    const { storyId, chapterId } = await createStoryWithChapter(app, cookie)

    const link = await app.inject({
      method: 'POST',
      url: `/my/royal-road/stories/${storyId}/chapters/${chapterId}/link`,
      cookies: { [cookie.name]: cookie.value },
      payload: { royalRoadId: 99999 },
    })
    expect(link.statusCode).toBe(200)
    expect(link.json()).toEqual({ success: true })
    const after = await prisma.chapter.findUnique({ where: { id: chapterId } })
    expect(after?.royalRoadId).toBe(99999)

    const unlink = await app.inject({
      method: 'POST',
      url: `/my/royal-road/stories/${storyId}/chapters/${chapterId}/unlink`,
      cookies: { [cookie.name]: cookie.value },
    })
    expect(unlink.statusCode).toBe(200)
    const cleared = await prisma.chapter.findUnique({ where: { id: chapterId } })
    expect(cleared?.royalRoadId).toBeNull()
  })

  test('GET publishing-status returns one row per chapter', async () => {
    const cookie = await registerUser(app, 'rr-c2@example.com', 'rrC2')
    const { storyId, chapterId } = await createStoryWithChapter(app, cookie)

    // Chapter with no ChapterPublishing row — status should be null.
    const before = await app.inject({
      method: 'GET',
      url: `/my/royal-road/stories/${storyId}/publishing-status`,
      cookies: { [cookie.name]: cookie.value },
    })
    expect(before.statusCode).toBe(200)
    const beforeRows = before.json().rows
    expect(beforeRows.length).toBe(1)
    expect(beforeRows[0]).toMatchObject({
      chapterId,
      status: null,
      platformId: null,
      attempts: 0,
    })

    // Seed a FAILED row and re-fetch.
    await prisma.chapterPublishing.create({
      data: {
        chapterId,
        platform: 'ROYAL_ROAD',
        status: 'FAILED',
        errorMessage: 'boom',
        attempts: 2,
      },
    })
    const after = await app.inject({
      method: 'GET',
      url: `/my/royal-road/stories/${storyId}/publishing-status`,
      cookies: { [cookie.name]: cookie.value },
    })
    expect(after.json().rows[0]).toMatchObject({
      chapterId,
      status: 'FAILED',
      errorMessage: 'boom',
      attempts: 2,
    })
  })

  test('retry resets FAILED rows to DRAFT with no backoff', async () => {
    const cookie = await registerUser(app, 'rr-c3@example.com', 'rrC3')
    const { storyId, chapterId } = await createStoryWithChapter(app, cookie)
    const future = new Date(Date.now() + 60 * 60 * 1000)

    await prisma.chapterPublishing.create({
      data: {
        chapterId,
        platform: 'ROYAL_ROAD',
        status: 'FAILED',
        errorMessage: 'boom',
        attempts: 3,
        nextAttemptAt: future,
      },
    })

    const res = await app.inject({
      method: 'POST',
      url: `/my/royal-road/stories/${storyId}/chapters/${chapterId}/retry`,
      cookies: { [cookie.name]: cookie.value },
    })
    expect(res.statusCode).toBe(200)

    const row = await prisma.chapterPublishing.findFirst({
      where: { chapterId, platform: 'ROYAL_ROAD' },
    })
    expect(row?.status).toBe('DRAFT')
    expect(row?.attempts).toBe(0)
    expect(row?.nextAttemptAt).toBeNull()
  })

  test('retry is a no-op on PUBLISHED rows', async () => {
    const cookie = await registerUser(app, 'rr-c4@example.com', 'rrC4')
    const { storyId, chapterId } = await createStoryWithChapter(app, cookie)
    const publishedAt = new Date('2026-01-01T00:00:00.000Z')

    await prisma.chapterPublishing.create({
      data: {
        chapterId,
        platform: 'ROYAL_ROAD',
        status: 'PUBLISHED',
        platformId: '555',
        publishedAt,
      },
    })

    await app.inject({
      method: 'POST',
      url: `/my/royal-road/stories/${storyId}/chapters/${chapterId}/retry`,
      cookies: { [cookie.name]: cookie.value },
    })
    const row = await prisma.chapterPublishing.findFirst({
      where: { chapterId, platform: 'ROYAL_ROAD' },
    })
    expect(row?.status).toBe('PUBLISHED')
    expect(row?.platformId).toBe('555')
  })

  test('sync backfills PUBLISHED rows and sets Chapter.royalRoadId', async () => {
    const cookie = await registerUser(app, 'rr-c5@example.com', 'rrC5')
    const { storyId, chapterId } = await createStoryWithChapter(app, cookie)

    const res = await app.inject({
      method: 'POST',
      url: `/my/royal-road/stories/${storyId}/sync`,
      cookies: { [cookie.name]: cookie.value },
      payload: {
        chapters: [{ chapterId, royalRoadId: 54321 }],
      },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ synced: 1 })

    const chapter = await prisma.chapter.findUnique({ where: { id: chapterId } })
    expect(chapter?.royalRoadId).toBe(54321)
    const row = await prisma.chapterPublishing.findFirst({
      where: { chapterId, platform: 'ROYAL_ROAD' },
    })
    expect(row?.status).toBe('PUBLISHED')
    expect(row?.platformId).toBe('54321')
  })

  test('cross-user story access is blocked with 404', async () => {
    const aliceCookie = await registerUser(app, 'rr-alice@example.com', 'rrAlice')
    const bobCookie = await registerUser(app, 'rr-bob@example.com', 'rrBob')
    const { storyId, chapterId } = await createStoryWithChapter(app, aliceCookie)

    const get = await app.inject({
      method: 'GET',
      url: `/my/royal-road/stories/${storyId}`,
      cookies: { [bobCookie.name]: bobCookie.value },
    })
    expect(get.statusCode).toBe(404)

    const link = await app.inject({
      method: 'POST',
      url: `/my/royal-road/stories/${storyId}/chapters/${chapterId}/link`,
      cookies: { [bobCookie.name]: bobCookie.value },
      payload: { royalRoadId: 1 },
    })
    expect(link.statusCode).toBe(404)

    const sync = await app.inject({
      method: 'POST',
      url: `/my/royal-road/stories/${storyId}/sync`,
      cookies: { [bobCookie.name]: bobCookie.value },
      payload: { chapters: [{ chapterId, royalRoadId: 1 }] },
    })
    expect(sync.statusCode).toBe(404)
  })

  test('endpoints require authentication', async () => {
    const res = await app.inject({ method: 'GET', url: '/my/royal-road/stories/fake' })
    expect(res.statusCode).toBe(401)
  })
})
