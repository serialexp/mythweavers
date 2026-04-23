import { beforeEach, describe, expect, test } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../src/lib/prisma.js'
import { buildApp, cleanDatabase } from './helpers.js'

/**
 * Phase 3: public reader visibility + ETag coverage.
 *
 * The pre-existing bug this file locks down: the public story routes only
 * filtered `Story.published = true` and then returned *every* chapter of
 * that story — including drafts, future-scheduled chapters, and soft-deleted
 * ones. Those must all be invisible to anonymous readers now that
 * publishedAt is authoritative.
 *
 * Also covers the new ETag / If-None-Match → 304 fast path on the
 * single-story and structure endpoints.
 */

type SessionCookie = { name: string; value: string }

async function registerUser(app: FastifyInstance, email: string, username: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email, username, password: 'password123' },
  })
  return res.cookies[0] as SessionCookie
}

async function createStoryWithChapters(
  app: FastifyInstance,
  cookie: SessionCookie,
  chapterCount: number,
) {
  const storyRes = await app.inject({
    method: 'POST',
    url: '/my/stories',
    cookies: { [cookie.name]: cookie.value },
    payload: { name: 'Visibility Story', summary: 'For visibility tests' },
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

  const chapterIds: string[] = []
  for (let i = 0; i < chapterCount; i++) {
    const ch = await app.inject({
      method: 'POST',
      url: `/my/arcs/${arcId}/chapters`,
      cookies: { [cookie.name]: cookie.value },
      payload: { name: `Chapter ${i + 1}` },
    })
    chapterIds.push(ch.json().chapter.id as string)
  }

  return { storyId, arcId, chapterIds }
}

async function publishStoryNow(app: FastifyInstance, cookie: SessionCookie, storyId: string) {
  const res = await app.inject({
    method: 'POST',
    url: `/my/stories/${storyId}/publish-now`,
    cookies: { [cookie.name]: cookie.value },
    payload: {},
  })
  expect(res.statusCode).toBe(200)
}

async function publishChapterNow(app: FastifyInstance, cookie: SessionCookie, chapterId: string) {
  const res = await app.inject({
    method: 'POST',
    url: `/my/chapters/${chapterId}/publish-now`,
    cookies: { [cookie.name]: cookie.value },
    payload: {},
  })
  expect(res.statusCode).toBe(200)
}

async function scheduleChapter(
  app: FastifyInstance,
  cookie: SessionCookie,
  chapterId: string,
  at: Date,
) {
  const res = await app.inject({
    method: 'PATCH',
    url: `/my/chapters/${chapterId}/publishing`,
    cookies: { [cookie.name]: cookie.value },
    payload: { publishedAt: at.toISOString() },
  })
  expect(res.statusCode).toBe(200)
}

describe('Public reader visibility', () => {
  let app: FastifyInstance
  let cookie: SessionCookie

  beforeEach(async () => {
    app = await buildApp()
    await cleanDatabase()
    cookie = await registerUser(app, 'author@example.com', 'author')
  })

  describe('Structure endpoint leak fix', () => {
    test('hides unpublished chapters from the table of contents', async () => {
      const { storyId, chapterIds } = await createStoryWithChapters(app, cookie, 3)
      await publishStoryNow(app, cookie, storyId)
      // Only publish chapter 0 and 2; chapter 1 stays a draft.
      await publishChapterNow(app, cookie, chapterIds[0])
      await publishChapterNow(app, cookie, chapterIds[2])

      const res = await app.inject({ method: 'GET', url: `/stories/${storyId}/structure` })
      expect(res.statusCode).toBe(200)
      const visibleIds = res
        .json()
        .story.books.flatMap((b: any) => b.arcs.flatMap((a: any) => a.chapters.map((c: any) => c.id)))
      expect(visibleIds).toEqual([chapterIds[0], chapterIds[2]])
      expect(visibleIds).not.toContain(chapterIds[1])
    })

    test('hides chapters scheduled in the future', async () => {
      const { storyId, chapterIds } = await createStoryWithChapters(app, cookie, 2)
      await publishStoryNow(app, cookie, storyId)
      await publishChapterNow(app, cookie, chapterIds[0])
      await scheduleChapter(app, cookie, chapterIds[1], new Date(Date.now() + 86_400_000))

      const res = await app.inject({ method: 'GET', url: `/stories/${storyId}/structure` })
      const visibleIds = res
        .json()
        .story.books.flatMap((b: any) => b.arcs.flatMap((a: any) => a.chapters.map((c: any) => c.id)))
      expect(visibleIds).toEqual([chapterIds[0]])
    })

    test('hides soft-deleted chapters even when they had publishedAt set', async () => {
      const { storyId, chapterIds } = await createStoryWithChapters(app, cookie, 2)
      await publishStoryNow(app, cookie, storyId)
      await publishChapterNow(app, cookie, chapterIds[0])
      await publishChapterNow(app, cookie, chapterIds[1])

      // Soft-delete chapter 0 directly — the writer endpoint would normally
      // do this, we short-circuit via prisma for test brevity.
      await prisma.chapter.update({
        where: { id: chapterIds[0] },
        data: { deleted: true, deletedAt: new Date() },
      })

      const res = await app.inject({ method: 'GET', url: `/stories/${storyId}/structure` })
      const visibleIds = res
        .json()
        .story.books.flatMap((b: any) => b.arcs.flatMap((a: any) => a.chapters.map((c: any) => c.id)))
      expect(visibleIds).toEqual([chapterIds[1]])
    })
  })

  describe('Chapter content endpoint leak fix', () => {
    test('returns 404 for an unpublished chapter of a published story', async () => {
      const { storyId, chapterIds } = await createStoryWithChapters(app, cookie, 1)
      await publishStoryNow(app, cookie, storyId)
      // Do NOT publish the chapter.

      const res = await app.inject({
        method: 'GET',
        url: `/stories/${storyId}/chapters/${chapterIds[0]}`,
      })
      expect(res.statusCode).toBe(404)
    })

    test('returns 404 for a future-scheduled chapter', async () => {
      const { storyId, chapterIds } = await createStoryWithChapters(app, cookie, 1)
      await publishStoryNow(app, cookie, storyId)
      await scheduleChapter(app, cookie, chapterIds[0], new Date(Date.now() + 86_400_000))

      const res = await app.inject({
        method: 'GET',
        url: `/stories/${storyId}/chapters/${chapterIds[0]}`,
      })
      expect(res.statusCode).toBe(404)
    })

    test('returns 404 for a soft-deleted chapter', async () => {
      const { storyId, chapterIds } = await createStoryWithChapters(app, cookie, 1)
      await publishStoryNow(app, cookie, storyId)
      await publishChapterNow(app, cookie, chapterIds[0])
      await prisma.chapter.update({
        where: { id: chapterIds[0] },
        data: { deleted: true, deletedAt: new Date() },
      })

      const res = await app.inject({
        method: 'GET',
        url: `/stories/${storyId}/chapters/${chapterIds[0]}`,
      })
      expect(res.statusCode).toBe(404)
    })

    test('prev/next navigation skips unpublished chapters', async () => {
      const { storyId, chapterIds } = await createStoryWithChapters(app, cookie, 3)
      await publishStoryNow(app, cookie, storyId)
      // Publish 0 and 2; 1 is a draft. Reading 0 should link directly to 2.
      await publishChapterNow(app, cookie, chapterIds[0])
      await publishChapterNow(app, cookie, chapterIds[2])

      const res = await app.inject({
        method: 'GET',
        url: `/stories/${storyId}/chapters/${chapterIds[0]}`,
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.chapter.previousChapterId).toBeNull()
      expect(body.chapter.nextChapterId).toBe(chapterIds[2])
    })
  })

  describe('Story-level visibility', () => {
    test('story scheduled in the future is not listed or fetchable', async () => {
      const { storyId } = await createStoryWithChapters(app, cookie, 0)
      // Schedule story for tomorrow.
      const future = new Date(Date.now() + 86_400_000)
      const patch = await app.inject({
        method: 'PATCH',
        url: `/my/stories/${storyId}/publishing`,
        cookies: { [cookie.name]: cookie.value },
        payload: { publishedAt: future.toISOString() },
      })
      expect(patch.statusCode).toBe(200)

      const list = await app.inject({ method: 'GET', url: '/stories' })
      expect(list.json().stories.map((s: any) => s.id)).not.toContain(storyId)

      const single = await app.inject({ method: 'GET', url: `/stories/${storyId}` })
      expect(single.statusCode).toBe(404)

      const structure = await app.inject({ method: 'GET', url: `/stories/${storyId}/structure` })
      expect(structure.statusCode).toBe(404)
    })

    test('public story response exposes publishedAt and release dates', async () => {
      const { storyId, chapterIds } = await createStoryWithChapters(app, cookie, 1)
      await publishStoryNow(app, cookie, storyId)
      await publishChapterNow(app, cookie, chapterIds[0])

      const res = await app.inject({ method: 'GET', url: `/stories/${storyId}` })
      expect(res.statusCode).toBe(200)
      const story = res.json().story
      expect(typeof story.publishedAt).toBe('string')
      expect(Date.parse(story.publishedAt)).not.toBeNaN()
      expect(typeof story.firstChapterReleasedAt).toBe('string')
      expect(typeof story.lastChapterReleasedAt).toBe('string')
    })
  })

  describe('ETag / If-None-Match', () => {
    test('single story endpoint returns ETag and answers 304 on match', async () => {
      const { storyId } = await createStoryWithChapters(app, cookie, 0)
      await publishStoryNow(app, cookie, storyId)

      const first = await app.inject({ method: 'GET', url: `/stories/${storyId}` })
      expect(first.statusCode).toBe(200)
      const etag = first.headers.etag as string
      expect(etag).toBeTruthy()
      expect(etag.startsWith('W/"')).toBe(true)

      const second = await app.inject({
        method: 'GET',
        url: `/stories/${storyId}`,
        headers: { 'if-none-match': etag },
      })
      expect(second.statusCode).toBe(304)
      // 304 must not have a body payload.
      expect(second.body).toBe('')
    })

    test('structure endpoint returns ETag that changes when a new chapter is published', async () => {
      const { storyId, chapterIds } = await createStoryWithChapters(app, cookie, 2)
      await publishStoryNow(app, cookie, storyId)
      await publishChapterNow(app, cookie, chapterIds[0])

      const first = await app.inject({ method: 'GET', url: `/stories/${storyId}/structure` })
      const etag1 = first.headers.etag as string
      expect(etag1).toBeTruthy()

      // Same request, same ETag → 304.
      const cached = await app.inject({
        method: 'GET',
        url: `/stories/${storyId}/structure`,
        headers: { 'if-none-match': etag1 },
      })
      expect(cached.statusCode).toBe(304)

      // Publish another chapter — this extends lastChapterReleasedAt and
      // adds a new visible chapter, so the ETag must change.
      await publishChapterNow(app, cookie, chapterIds[1])
      const second = await app.inject({
        method: 'GET',
        url: `/stories/${storyId}/structure`,
        headers: { 'if-none-match': etag1 },
      })
      expect(second.statusCode).toBe(200)
      expect(second.headers.etag).not.toBe(etag1)
    })

    test('chapter content endpoint returns ETag and answers 304 on match', async () => {
      const { storyId, chapterIds } = await createStoryWithChapters(app, cookie, 1)
      await publishStoryNow(app, cookie, storyId)
      await publishChapterNow(app, cookie, chapterIds[0])

      const first = await app.inject({
        method: 'GET',
        url: `/stories/${storyId}/chapters/${chapterIds[0]}`,
      })
      expect(first.statusCode).toBe(200)
      const etag = first.headers.etag as string
      expect(etag).toBeTruthy()

      const second = await app.inject({
        method: 'GET',
        url: `/stories/${storyId}/chapters/${chapterIds[0]}`,
        headers: { 'if-none-match': etag },
      })
      expect(second.statusCode).toBe(304)
    })
  })
})
