import { beforeEach, describe, expect, test } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../src/lib/prisma.js'
import { buildApp, cleanDatabase } from './helpers.js'

/**
 * Covers the six Phase 2 publishing endpoints:
 *   PATCH  /my/stories/:storyId/publishing
 *   POST   /my/stories/:storyId/publish-now
 *   POST   /my/stories/:storyId/unpublish
 *   PATCH  /my/chapters/:chapterId/publishing
 *   POST   /my/chapters/:chapterId/publish-now
 *   POST   /my/chapters/:chapterId/unpublish
 *
 * In addition to happy paths we verify:
 *   - Ownership is enforced (404 for stories/chapters owned by another user)
 *   - Unauthenticated requests are rejected (401)
 *   - Legacy dual-write stays coherent: Story.published and Chapter.publishedOn
 *   - Story.firstChapterReleasedAt / lastChapterReleasedAt are recomputed on
 *     chapter publish mutations
 *   - Soft-deleted chapters cannot be published (404)
 *   - Invalid payloads are rejected (400)
 */

type SessionCookie = { name: string; value: string }

async function registerUser(
  app: FastifyInstance,
  email: string,
  username: string,
): Promise<{ cookie: SessionCookie; userId: number }> {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email, username, password: 'password123' },
  })
  return {
    cookie: response.cookies[0] as SessionCookie,
    userId: response.json().user.id,
  }
}

async function createStoryTree(app: FastifyInstance, cookie: SessionCookie) {
  const storyRes = await app.inject({
    method: 'POST',
    url: '/my/stories',
    cookies: { [cookie.name]: cookie.value },
    payload: { name: 'Test Story' },
  })
  const storyId = storyRes.json().story.id as string

  const bookRes = await app.inject({
    method: 'POST',
    url: `/my/stories/${storyId}/books`,
    cookies: { [cookie.name]: cookie.value },
    payload: { name: 'Book 1' },
  })
  const bookId = bookRes.json().book.id as string

  const arcRes = await app.inject({
    method: 'POST',
    url: `/my/books/${bookId}/arcs`,
    cookies: { [cookie.name]: cookie.value },
    payload: { name: 'Arc 1' },
  })
  const arcId = arcRes.json().arc.id as string

  const chapterRes = await app.inject({
    method: 'POST',
    url: `/my/arcs/${arcId}/chapters`,
    cookies: { [cookie.name]: cookie.value },
    payload: { name: 'Chapter 1' },
  })
  const chapterId = chapterRes.json().chapter.id as string

  return { storyId, bookId, arcId, chapterId }
}

describe('Publishing Endpoints', () => {
  let app: FastifyInstance
  let cookie: SessionCookie
  let storyId: string
  let arcId: string
  let chapterId: string

  beforeEach(async () => {
    app = await buildApp()
    await cleanDatabase()
    const { cookie: c } = await registerUser(app, 'author@example.com', 'author')
    cookie = c
    const tree = await createStoryTree(app, cookie)
    storyId = tree.storyId
    arcId = tree.arcId
    chapterId = tree.chapterId
  })

  // ---------- Story: PATCH publishing ----------

  describe('PATCH /my/stories/:storyId/publishing', () => {
    test('sets publishedAt to a future date (schedule) and dual-writes published=false', async () => {
      const future = new Date(Date.now() + 86_400_000).toISOString()
      const res = await app.inject({
        method: 'PATCH',
        url: `/my/stories/${storyId}/publishing`,
        cookies: { [cookie.name]: cookie.value },
        payload: { publishedAt: future },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.success).toBe(true)
      expect(body.storyId).toBe(storyId)
      expect(new Date(body.publishedAt).toISOString()).toBe(future)

      const story = await prisma.story.findUniqueOrThrow({ where: { id: storyId } })
      expect(story.publishedAt?.toISOString()).toBe(future)
      // Scheduled in the future → legacy `published` must be false
      expect(story.published).toBe(false)
    })

    test('sets publishedAt to a past date and dual-writes published=true', async () => {
      const past = new Date(Date.now() - 86_400_000).toISOString()
      const res = await app.inject({
        method: 'PATCH',
        url: `/my/stories/${storyId}/publishing`,
        cookies: { [cookie.name]: cookie.value },
        payload: { publishedAt: past },
      })
      expect(res.statusCode).toBe(200)
      const story = await prisma.story.findUniqueOrThrow({ where: { id: storyId } })
      expect(story.publishedAt?.toISOString()).toBe(past)
      expect(story.published).toBe(true)
    })

    test('sets publishedAt to null (unpublish) and dual-writes published=false', async () => {
      // First put it in a published state
      await app.inject({
        method: 'PATCH',
        url: `/my/stories/${storyId}/publishing`,
        cookies: { [cookie.name]: cookie.value },
        payload: { publishedAt: new Date().toISOString() },
      })

      const res = await app.inject({
        method: 'PATCH',
        url: `/my/stories/${storyId}/publishing`,
        cookies: { [cookie.name]: cookie.value },
        payload: { publishedAt: null },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().publishedAt).toBeNull()
      const story = await prisma.story.findUniqueOrThrow({ where: { id: storyId } })
      expect(story.publishedAt).toBeNull()
      expect(story.published).toBe(false)
    })

    test('returns 400 for an invalid ISO string', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/my/stories/${storyId}/publishing`,
        cookies: { [cookie.name]: cookie.value },
        payload: { publishedAt: 'not-a-date' },
      })
      expect(res.statusCode).toBe(400)
    })

    test('returns 400 for missing publishedAt', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/my/stories/${storyId}/publishing`,
        cookies: { [cookie.name]: cookie.value },
        payload: {},
      })
      expect(res.statusCode).toBe(400)
    })

    test('returns 401 without authentication', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/my/stories/${storyId}/publishing`,
        payload: { publishedAt: null },
      })
      expect(res.statusCode).toBe(401)
    })

    test('returns 404 for a story owned by a different user', async () => {
      const { cookie: otherCookie } = await registerUser(
        app,
        'other@example.com',
        'other',
      )
      const res = await app.inject({
        method: 'PATCH',
        url: `/my/stories/${storyId}/publishing`,
        cookies: { [otherCookie.name]: otherCookie.value },
        payload: { publishedAt: null },
      })
      expect(res.statusCode).toBe(404)
    })

    test('returns 404 for a non-existent story', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/my/stories/does-not-exist/publishing',
        cookies: { [cookie.name]: cookie.value },
        payload: { publishedAt: null },
      })
      expect(res.statusCode).toBe(404)
    })
  })

  // ---------- Story: publish-now / unpublish ----------

  describe('POST /my/stories/:storyId/publish-now', () => {
    test('sets publishedAt to ~now and published=true', async () => {
      const before = Date.now()
      const res = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/publish-now`,
        cookies: { [cookie.name]: cookie.value },
      })
      const after = Date.now()
      expect(res.statusCode).toBe(200)
      const publishedAt = new Date(res.json().publishedAt).getTime()
      expect(publishedAt).toBeGreaterThanOrEqual(before)
      expect(publishedAt).toBeLessThanOrEqual(after)
      const story = await prisma.story.findUniqueOrThrow({ where: { id: storyId } })
      expect(story.published).toBe(true)
    })

    test('returns 401 without authentication', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/publish-now`,
      })
      expect(res.statusCode).toBe(401)
    })

    test('returns 404 for a non-owned story', async () => {
      const { cookie: otherCookie } = await registerUser(
        app,
        'other@example.com',
        'other',
      )
      const res = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/publish-now`,
        cookies: { [otherCookie.name]: otherCookie.value },
      })
      expect(res.statusCode).toBe(404)
    })
  })

  describe('POST /my/stories/:storyId/unpublish', () => {
    test('clears publishedAt and published', async () => {
      await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/publish-now`,
        cookies: { [cookie.name]: cookie.value },
      })
      const res = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/unpublish`,
        cookies: { [cookie.name]: cookie.value },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().publishedAt).toBeNull()
      const story = await prisma.story.findUniqueOrThrow({ where: { id: storyId } })
      expect(story.publishedAt).toBeNull()
      expect(story.published).toBe(false)
    })
  })

  // ---------- Chapter: PATCH publishing ----------

  describe('PATCH /my/chapters/:chapterId/publishing', () => {
    test('sets publishedAt, dual-writes publishedOn, and recomputes release dates', async () => {
      const when = new Date(Date.now() - 3_600_000).toISOString()
      const res = await app.inject({
        method: 'PATCH',
        url: `/my/chapters/${chapterId}/publishing`,
        cookies: { [cookie.name]: cookie.value },
        payload: { publishedAt: when },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.success).toBe(true)
      expect(body.chapterId).toBe(chapterId)
      expect(body.storyId).toBe(storyId)
      expect(new Date(body.publishedAt).toISOString()).toBe(when)
      expect(new Date(body.firstChapterReleasedAt).toISOString()).toBe(when)
      expect(new Date(body.lastChapterReleasedAt).toISOString()).toBe(when)

      const chapter = await prisma.chapter.findUniqueOrThrow({
        where: { id: chapterId },
      })
      // Dual-write: publishedOn must mirror publishedAt
      expect(chapter.publishedOn?.toISOString()).toBe(when)
      expect(chapter.publishedAt?.toISOString()).toBe(when)

      const story = await prisma.story.findUniqueOrThrow({ where: { id: storyId } })
      expect(story.firstChapterReleasedAt?.toISOString()).toBe(when)
      expect(story.lastChapterReleasedAt?.toISOString()).toBe(when)
    })

    test('recomputes min/max across multiple chapters', async () => {
      // Create two more chapters in the same arc
      const ch2Res = await app.inject({
        method: 'POST',
        url: `/my/arcs/${arcId}/chapters`,
        cookies: { [cookie.name]: cookie.value },
        payload: { name: 'Chapter 2' },
      })
      const ch2Id = ch2Res.json().chapter.id as string

      const ch3Res = await app.inject({
        method: 'POST',
        url: `/my/arcs/${arcId}/chapters`,
        cookies: { [cookie.name]: cookie.value },
        payload: { name: 'Chapter 3' },
      })
      const ch3Id = ch3Res.json().chapter.id as string

      const early = new Date('2026-01-01T00:00:00.000Z').toISOString()
      const mid = new Date('2026-03-01T00:00:00.000Z').toISOString()
      const late = new Date('2026-06-01T00:00:00.000Z').toISOString()

      for (const [id, when] of [
        [chapterId, mid],
        [ch2Id, late],
        [ch3Id, early],
      ] as const) {
        await app.inject({
          method: 'PATCH',
          url: `/my/chapters/${id}/publishing`,
          cookies: { [cookie.name]: cookie.value },
          payload: { publishedAt: when },
        })
      }

      const story = await prisma.story.findUniqueOrThrow({ where: { id: storyId } })
      expect(story.firstChapterReleasedAt?.toISOString()).toBe(early)
      expect(story.lastChapterReleasedAt?.toISOString()).toBe(late)
    })

    test('unpublishing a chapter recomputes release dates (excludes nulls)', async () => {
      const when = new Date('2026-05-01T00:00:00.000Z').toISOString()
      await app.inject({
        method: 'PATCH',
        url: `/my/chapters/${chapterId}/publishing`,
        cookies: { [cookie.name]: cookie.value },
        payload: { publishedAt: when },
      })

      const res = await app.inject({
        method: 'PATCH',
        url: `/my/chapters/${chapterId}/publishing`,
        cookies: { [cookie.name]: cookie.value },
        payload: { publishedAt: null },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().publishedAt).toBeNull()
      expect(res.json().firstChapterReleasedAt).toBeNull()
      expect(res.json().lastChapterReleasedAt).toBeNull()

      const story = await prisma.story.findUniqueOrThrow({ where: { id: storyId } })
      expect(story.firstChapterReleasedAt).toBeNull()
      expect(story.lastChapterReleasedAt).toBeNull()
    })

    test('returns 400 for invalid publishedAt', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/my/chapters/${chapterId}/publishing`,
        cookies: { [cookie.name]: cookie.value },
        payload: { publishedAt: 'garbage' },
      })
      expect(res.statusCode).toBe(400)
    })

    test('returns 401 without authentication', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/my/chapters/${chapterId}/publishing`,
        payload: { publishedAt: null },
      })
      expect(res.statusCode).toBe(401)
    })

    test('returns 404 for a chapter owned by a different user', async () => {
      const { cookie: otherCookie } = await registerUser(
        app,
        'other@example.com',
        'other',
      )
      const res = await app.inject({
        method: 'PATCH',
        url: `/my/chapters/${chapterId}/publishing`,
        cookies: { [otherCookie.name]: otherCookie.value },
        payload: { publishedAt: null },
      })
      expect(res.statusCode).toBe(404)
    })

    test('returns 404 for a soft-deleted chapter', async () => {
      await app.inject({
        method: 'DELETE',
        url: `/my/chapters/${chapterId}`,
        cookies: { [cookie.name]: cookie.value },
      })
      const res = await app.inject({
        method: 'PATCH',
        url: `/my/chapters/${chapterId}/publishing`,
        cookies: { [cookie.name]: cookie.value },
        payload: { publishedAt: null },
      })
      expect(res.statusCode).toBe(404)
    })

    test('returns 404 for a non-existent chapter', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/my/chapters/does-not-exist/publishing',
        cookies: { [cookie.name]: cookie.value },
        payload: { publishedAt: null },
      })
      expect(res.statusCode).toBe(404)
    })
  })

  // ---------- Chapter: publish-now / unpublish ----------

  describe('POST /my/chapters/:chapterId/publish-now', () => {
    test('sets publishedAt to ~now', async () => {
      const before = Date.now()
      const res = await app.inject({
        method: 'POST',
        url: `/my/chapters/${chapterId}/publish-now`,
        cookies: { [cookie.name]: cookie.value },
      })
      const after = Date.now()
      expect(res.statusCode).toBe(200)
      const t = new Date(res.json().publishedAt).getTime()
      expect(t).toBeGreaterThanOrEqual(before)
      expect(t).toBeLessThanOrEqual(after)

      const chapter = await prisma.chapter.findUniqueOrThrow({
        where: { id: chapterId },
      })
      expect(chapter.publishedAt).not.toBeNull()
      expect(chapter.publishedOn?.getTime()).toBe(chapter.publishedAt!.getTime())
    })

    test('returns 404 for a non-owned chapter', async () => {
      const { cookie: otherCookie } = await registerUser(
        app,
        'other@example.com',
        'other',
      )
      const res = await app.inject({
        method: 'POST',
        url: `/my/chapters/${chapterId}/publish-now`,
        cookies: { [otherCookie.name]: otherCookie.value },
      })
      expect(res.statusCode).toBe(404)
    })
  })

  describe('POST /my/chapters/:chapterId/unpublish', () => {
    test('clears publishedAt and publishedOn and recomputes release dates', async () => {
      await app.inject({
        method: 'POST',
        url: `/my/chapters/${chapterId}/publish-now`,
        cookies: { [cookie.name]: cookie.value },
      })
      const res = await app.inject({
        method: 'POST',
        url: `/my/chapters/${chapterId}/unpublish`,
        cookies: { [cookie.name]: cookie.value },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().publishedAt).toBeNull()
      expect(res.json().firstChapterReleasedAt).toBeNull()
      expect(res.json().lastChapterReleasedAt).toBeNull()

      const chapter = await prisma.chapter.findUniqueOrThrow({
        where: { id: chapterId },
      })
      expect(chapter.publishedAt).toBeNull()
      expect(chapter.publishedOn).toBeNull()
    })
  })
})
