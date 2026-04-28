import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../src/lib/prisma.js'
import { buildApp, cleanDatabase } from './helpers.js'

/**
 * Tests for /my/reading-status endpoints.
 *
 * Covers:
 *  - POST upserts (idempotent across the unique (userId, storyId) constraint)
 *  - GET list filters out unpublished stories
 *  - GET per-story returns nulls when no read recorded
 *  - 400 when chapterId doesn't belong to storyId
 *  - 404 when story isn't publicly visible
 *  - 401 when unauthenticated
 *  - Cross-user isolation
 */

type SessionCookie = { name: string; value: string }

async function registerUser(app: FastifyInstance, email: string, username: string): Promise<SessionCookie> {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email, username, password: 'password123' },
  })
  expect(res.statusCode).toBe(201)
  return res.cookies[0] as SessionCookie
}

async function createPublishedStoryWithChapter(
  app: FastifyInstance,
  cookie: SessionCookie,
  name: string,
): Promise<{ storyId: string; chapterId: string }> {
  const storyRes = await app.inject({
    method: 'POST',
    url: '/my/stories',
    cookies: { [cookie.name]: cookie.value },
    payload: { name, summary: `<p>${name}</p>` },
  })
  expect(storyRes.statusCode).toBe(201)
  const storyId = storyRes.json().story.id as string

  // Need a book → arc → chapter path. Use the existing /my routes.
  const bookRes = await app.inject({
    method: 'POST',
    url: `/my/stories/${storyId}/books`,
    cookies: { [cookie.name]: cookie.value },
    payload: { name: 'Book 1' },
  })
  expect(bookRes.statusCode).toBe(201)
  const bookId = bookRes.json().book.id as string

  const arcRes = await app.inject({
    method: 'POST',
    url: `/my/books/${bookId}/arcs`,
    cookies: { [cookie.name]: cookie.value },
    payload: { name: 'Arc 1' },
  })
  expect(arcRes.statusCode).toBe(201)
  const arcId = arcRes.json().arc.id as string

  const chapterRes = await app.inject({
    method: 'POST',
    url: `/my/arcs/${arcId}/chapters`,
    cookies: { [cookie.name]: cookie.value },
    payload: { name: 'Chapter 1' },
  })
  expect(chapterRes.statusCode).toBe(201)
  const chapterId = chapterRes.json().chapter.id as string

  // Mark story public.
  await prisma.story.update({
    where: { id: storyId },
    data: { publishedAt: new Date(Date.now() - 1000) },
  })

  return { storyId, chapterId }
}

describe('Reading Status Endpoints', () => {
  let app: FastifyInstance
  let aliceCookie: SessionCookie
  let bobCookie: SessionCookie
  let storyId: string
  let chapterId: string

  beforeEach(async () => {
    app = await buildApp()
    await cleanDatabase()
    aliceCookie = await registerUser(app, 'alice@example.com', 'alice')
    bobCookie = await registerUser(app, 'bob@example.com', 'bob')
    const created = await createPublishedStoryWithChapter(app, aliceCookie, 'Story A')
    storyId = created.storyId
    chapterId = created.chapterId
  })

  afterEach(async () => {
    await app.close()
  })

  // ---- POST /my/reading-status ---------------------------------------------

  describe('POST /my/reading-status', () => {
    test('records a read position', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/my/reading-status',
        cookies: { [bobCookie.name]: bobCookie.value },
        payload: { storyId, chapterId },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ success: true })

      const rows = await prisma.storyReadStatus.findMany({ where: { storyId } })
      expect(rows).toHaveLength(1)
      expect(rows[0]?.lastChapterId).toBe(chapterId)
    })

    test('is idempotent — second call upserts instead of duplicating rows', async () => {
      for (let i = 0; i < 2; i++) {
        const res = await app.inject({
          method: 'POST',
          url: '/my/reading-status',
          cookies: { [bobCookie.name]: bobCookie.value },
          payload: { storyId, chapterId },
        })
        expect(res.statusCode).toBe(200)
      }
      const rows = await prisma.storyReadStatus.findMany({ where: { storyId } })
      expect(rows).toHaveLength(1)
    })

    test('returns 400 when chapter does not belong to story', async () => {
      const other = await createPublishedStoryWithChapter(app, aliceCookie, 'Other')
      const res = await app.inject({
        method: 'POST',
        url: '/my/reading-status',
        cookies: { [bobCookie.name]: bobCookie.value },
        payload: { storyId, chapterId: other.chapterId },
      })
      expect(res.statusCode).toBe(400)
    })

    test('returns 404 when story is not publicly visible', async () => {
      // Unpublish the story.
      await prisma.story.update({ where: { id: storyId }, data: { publishedAt: null } })
      const res = await app.inject({
        method: 'POST',
        url: '/my/reading-status',
        cookies: { [bobCookie.name]: bobCookie.value },
        payload: { storyId, chapterId },
      })
      expect(res.statusCode).toBe(404)
    })

    test('returns 401 without auth', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/my/reading-status',
        payload: { storyId, chapterId },
      })
      expect(res.statusCode).toBe(401)
    })
  })

  // ---- GET /my/reading-status ----------------------------------------------

  describe('GET /my/reading-status', () => {
    test('returns empty list when nothing recorded', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/my/reading-status',
        cookies: { [bobCookie.name]: bobCookie.value },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ entries: [] })
    })

    test("returns the user's own reading history, not other users'", async () => {
      // Bob reads it; Alice has nothing recorded.
      await app.inject({
        method: 'POST',
        url: '/my/reading-status',
        cookies: { [bobCookie.name]: bobCookie.value },
        payload: { storyId, chapterId },
      })

      const aliceList = await app.inject({
        method: 'GET',
        url: '/my/reading-status',
        cookies: { [aliceCookie.name]: aliceCookie.value },
      })
      expect(aliceList.json().entries).toHaveLength(0)

      const bobList = await app.inject({
        method: 'GET',
        url: '/my/reading-status',
        cookies: { [bobCookie.name]: bobCookie.value },
      })
      expect(bobList.json().entries).toHaveLength(1)
      expect(bobList.json().entries[0].story.id).toBe(storyId)
      expect(bobList.json().entries[0].lastChapterId).toBe(chapterId)
    })

    test("hides entries whose story has become unpublished", async () => {
      await app.inject({
        method: 'POST',
        url: '/my/reading-status',
        cookies: { [bobCookie.name]: bobCookie.value },
        payload: { storyId, chapterId },
      })
      await prisma.story.update({ where: { id: storyId }, data: { publishedAt: null } })

      const res = await app.inject({
        method: 'GET',
        url: '/my/reading-status',
        cookies: { [bobCookie.name]: bobCookie.value },
      })
      expect(res.json().entries).toHaveLength(0)
    })
  })

  // ---- GET /my/reading-status/:storyId -------------------------------------

  describe('GET /my/reading-status/:storyId', () => {
    test('returns nulls when no read recorded', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/my/reading-status/${storyId}`,
        cookies: { [bobCookie.name]: bobCookie.value },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ lastChapterId: null, lastChapterReadAt: null })
    })

    test('returns the recorded chapter after a POST', async () => {
      await app.inject({
        method: 'POST',
        url: '/my/reading-status',
        cookies: { [bobCookie.name]: bobCookie.value },
        payload: { storyId, chapterId },
      })

      const res = await app.inject({
        method: 'GET',
        url: `/my/reading-status/${storyId}`,
        cookies: { [bobCookie.name]: bobCookie.value },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().lastChapterId).toBe(chapterId)
      expect(typeof res.json().lastChapterReadAt).toBe('string')
    })
  })
})
