import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../src/lib/prisma.js'
import { buildApp, cleanDatabase } from './helpers.js'

/**
 * Bookshelf tests.
 *
 * Covers the four `/my/bookshelf` endpoints:
 *   - GET    /my/bookshelf
 *   - GET    /my/bookshelf/:storyId
 *   - POST   /my/bookshelf
 *   - DELETE /my/bookshelf/:storyId/:kind
 *
 * Two users + two published stories are wired up in beforeEach so we can
 * verify both happy-path behavior and isolation between users.
 */

type SessionCookie = { name: string; value: string }

async function registerUser(app: FastifyInstance, email: string, username: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email, username, password: 'password123' },
  })
  expect(res.statusCode).toBe(201)
  return res.cookies[0] as SessionCookie
}

async function createPublishedStory(
  app: FastifyInstance,
  cookie: SessionCookie,
  name: string,
) {
  const res = await app.inject({
    method: 'POST',
    url: '/my/stories',
    cookies: { [cookie.name]: cookie.value },
    payload: { name, summary: `<p>Summary for ${name}</p>` },
  })
  expect(res.statusCode).toBe(201)
  const storyId = res.json().story.id as string

  // Mark the story as already-public so bookshelf visibility checks pass.
  // We backdate publishedAt slightly so `lte: now` comparisons succeed even
  // on fast machines.
  await prisma.story.update({
    where: { id: storyId },
    data: { publishedAt: new Date(Date.now() - 1000) },
  })
  return storyId
}

describe('Bookshelf Endpoints', () => {
  let app: FastifyInstance
  let aliceCookie: SessionCookie
  let bobCookie: SessionCookie
  let storyAId: string
  let storyBId: string

  beforeEach(async () => {
    app = await buildApp()
    await cleanDatabase()

    aliceCookie = await registerUser(app, 'alice@example.com', 'alice')
    bobCookie = await registerUser(app, 'bob@example.com', 'bob')

    // Both stories are owned by Alice and published; Bob can save them too.
    storyAId = await createPublishedStory(app, aliceCookie, 'Story A')
    storyBId = await createPublishedStory(app, aliceCookie, 'Story B')
  })

  afterEach(async () => {
    await app.close()
  })

  // ---- POST /my/bookshelf ---------------------------------------------------

  describe('POST /my/bookshelf', () => {
    test('adds a story under FAVORITE', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/my/bookshelf',
        cookies: { [aliceCookie.name]: aliceCookie.value },
        payload: { storyId: storyAId, kind: 'FAVORITE' },
      })
      expect(res.statusCode).toBe(201)
      expect(res.json()).toEqual({ success: true })

      const rows = await prisma.bookShelfStory.findMany({ where: { storyId: storyAId } })
      expect(rows).toHaveLength(1)
      expect(rows[0]?.kind).toBe('FAVORITE')
    })

    test('is idempotent — double-add returns 200 and does not duplicate rows', async () => {
      const first = await app.inject({
        method: 'POST',
        url: '/my/bookshelf',
        cookies: { [aliceCookie.name]: aliceCookie.value },
        payload: { storyId: storyAId, kind: 'FAVORITE' },
      })
      expect(first.statusCode).toBe(201)

      const second = await app.inject({
        method: 'POST',
        url: '/my/bookshelf',
        cookies: { [aliceCookie.name]: aliceCookie.value },
        payload: { storyId: storyAId, kind: 'FAVORITE' },
      })
      expect(second.statusCode).toBe(200)
      expect(second.json()).toEqual({ success: true })

      const rows = await prisma.bookShelfStory.findMany({ where: { storyId: storyAId } })
      expect(rows).toHaveLength(1)
    })

    test('allows the same story under multiple kinds', async () => {
      for (const kind of ['FAVORITE', 'FOLLOW', 'READ_LATER'] as const) {
        const res = await app.inject({
          method: 'POST',
          url: '/my/bookshelf',
          cookies: { [aliceCookie.name]: aliceCookie.value },
          payload: { storyId: storyAId, kind },
        })
        expect(res.statusCode).toBe(201)
      }

      const rows = await prisma.bookShelfStory.findMany({ where: { storyId: storyAId } })
      expect(rows).toHaveLength(3)
    })

    test('returns 401 without a session', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/my/bookshelf',
        payload: { storyId: storyAId, kind: 'FAVORITE' },
      })
      expect(res.statusCode).toBe(401)
    })

    test('returns 404 for an unknown story', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/my/bookshelf',
        cookies: { [aliceCookie.name]: aliceCookie.value },
        payload: { storyId: 'does-not-exist', kind: 'FAVORITE' },
      })
      expect(res.statusCode).toBe(404)
    })

    test('returns 404 for a story that is not yet published', async () => {
      // Roll back the publishedAt set by the helper.
      await prisma.story.update({
        where: { id: storyAId },
        data: { publishedAt: null },
      })

      const res = await app.inject({
        method: 'POST',
        url: '/my/bookshelf',
        cookies: { [aliceCookie.name]: aliceCookie.value },
        payload: { storyId: storyAId, kind: 'FAVORITE' },
      })
      expect(res.statusCode).toBe(404)
    })

    test('returns 400 for an invalid kind', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/my/bookshelf',
        cookies: { [aliceCookie.name]: aliceCookie.value },
        payload: { storyId: storyAId, kind: 'NONSENSE' },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  // ---- GET /my/bookshelf/:storyId ------------------------------------------

  describe('GET /my/bookshelf/:storyId', () => {
    test('returns all-false when nothing is saved', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/my/bookshelf/${storyAId}`,
        cookies: { [aliceCookie.name]: aliceCookie.value },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ FAVORITE: false, FOLLOW: false, READ_LATER: false })
    })

    test('reflects which kinds have been saved', async () => {
      for (const kind of ['FAVORITE', 'READ_LATER'] as const) {
        await app.inject({
          method: 'POST',
          url: '/my/bookshelf',
          cookies: { [aliceCookie.name]: aliceCookie.value },
          payload: { storyId: storyAId, kind },
        })
      }

      const res = await app.inject({
        method: 'GET',
        url: `/my/bookshelf/${storyAId}`,
        cookies: { [aliceCookie.name]: aliceCookie.value },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ FAVORITE: true, FOLLOW: false, READ_LATER: true })
    })

    test('returns 404 for an unknown story', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/my/bookshelf/does-not-exist',
        cookies: { [aliceCookie.name]: aliceCookie.value },
      })
      expect(res.statusCode).toBe(404)
    })

    test('returns 401 without a session', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/my/bookshelf/${storyAId}`,
      })
      expect(res.statusCode).toBe(401)
    })
  })

  // ---- GET /my/bookshelf ----------------------------------------------------

  describe('GET /my/bookshelf', () => {
    test('returns an empty array for a fresh user', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/my/bookshelf',
        cookies: { [bobCookie.name]: bobCookie.value },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ stories: [] })
    })

    test('lists saved stories with their kinds', async () => {
      await app.inject({
        method: 'POST',
        url: '/my/bookshelf',
        cookies: { [aliceCookie.name]: aliceCookie.value },
        payload: { storyId: storyAId, kind: 'FAVORITE' },
      })
      await app.inject({
        method: 'POST',
        url: '/my/bookshelf',
        cookies: { [aliceCookie.name]: aliceCookie.value },
        payload: { storyId: storyAId, kind: 'FOLLOW' },
      })
      await app.inject({
        method: 'POST',
        url: '/my/bookshelf',
        cookies: { [aliceCookie.name]: aliceCookie.value },
        payload: { storyId: storyBId, kind: 'READ_LATER' },
      })

      const res = await app.inject({
        method: 'GET',
        url: '/my/bookshelf',
        cookies: { [aliceCookie.name]: aliceCookie.value },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json() as { stories: Array<{ id: string; kinds: string[] }> }
      expect(body.stories).toHaveLength(2)

      const a = body.stories.find((s) => s.id === storyAId)
      const b = body.stories.find((s) => s.id === storyBId)
      expect(a?.kinds.sort()).toEqual(['FAVORITE', 'FOLLOW'])
      expect(b?.kinds).toEqual(['READ_LATER'])
    })

    test('filters by ?kind=', async () => {
      await app.inject({
        method: 'POST',
        url: '/my/bookshelf',
        cookies: { [aliceCookie.name]: aliceCookie.value },
        payload: { storyId: storyAId, kind: 'FAVORITE' },
      })
      await app.inject({
        method: 'POST',
        url: '/my/bookshelf',
        cookies: { [aliceCookie.name]: aliceCookie.value },
        payload: { storyId: storyBId, kind: 'READ_LATER' },
      })

      const res = await app.inject({
        method: 'GET',
        url: '/my/bookshelf?kind=FAVORITE',
        cookies: { [aliceCookie.name]: aliceCookie.value },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json() as { stories: Array<{ id: string }> }
      expect(body.stories).toHaveLength(1)
      expect(body.stories[0]?.id).toBe(storyAId)
    })

    test("does not surface another user's saves", async () => {
      await app.inject({
        method: 'POST',
        url: '/my/bookshelf',
        cookies: { [aliceCookie.name]: aliceCookie.value },
        payload: { storyId: storyAId, kind: 'FAVORITE' },
      })

      const res = await app.inject({
        method: 'GET',
        url: '/my/bookshelf',
        cookies: { [bobCookie.name]: bobCookie.value },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ stories: [] })
    })

    test('hides stories that have since been unpublished', async () => {
      await app.inject({
        method: 'POST',
        url: '/my/bookshelf',
        cookies: { [aliceCookie.name]: aliceCookie.value },
        payload: { storyId: storyAId, kind: 'FAVORITE' },
      })

      // Author retracts the story — bookshelf should hide it but keep the row.
      await prisma.story.update({
        where: { id: storyAId },
        data: { publishedAt: null },
      })

      const res = await app.inject({
        method: 'GET',
        url: '/my/bookshelf',
        cookies: { [aliceCookie.name]: aliceCookie.value },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ stories: [] })

      const rows = await prisma.bookShelfStory.findMany({ where: { storyId: storyAId } })
      expect(rows).toHaveLength(1)
    })

    test('returns 401 without a session', async () => {
      const res = await app.inject({ method: 'GET', url: '/my/bookshelf' })
      expect(res.statusCode).toBe(401)
    })
  })

  // ---- DELETE /my/bookshelf/:storyId/:kind ----------------------------------

  describe('DELETE /my/bookshelf/:storyId/:kind', () => {
    test('removes only the matching kind', async () => {
      for (const kind of ['FAVORITE', 'FOLLOW', 'READ_LATER'] as const) {
        await app.inject({
          method: 'POST',
          url: '/my/bookshelf',
          cookies: { [aliceCookie.name]: aliceCookie.value },
          payload: { storyId: storyAId, kind },
        })
      }

      const res = await app.inject({
        method: 'DELETE',
        url: `/my/bookshelf/${storyAId}/FAVORITE`,
        cookies: { [aliceCookie.name]: aliceCookie.value },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ success: true })

      const remaining = await prisma.bookShelfStory.findMany({
        where: { storyId: storyAId },
        select: { kind: true },
      })
      const kinds = remaining.map((r) => r.kind).sort()
      expect(kinds).toEqual(['FOLLOW', 'READ_LATER'])
    })

    test('is idempotent — deleting a missing entry still returns 200', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/my/bookshelf/${storyAId}/FAVORITE`,
        cookies: { [aliceCookie.name]: aliceCookie.value },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ success: true })
    })

    test("does not delete another user's row", async () => {
      await app.inject({
        method: 'POST',
        url: '/my/bookshelf',
        cookies: { [aliceCookie.name]: aliceCookie.value },
        payload: { storyId: storyAId, kind: 'FAVORITE' },
      })

      const res = await app.inject({
        method: 'DELETE',
        url: `/my/bookshelf/${storyAId}/FAVORITE`,
        cookies: { [bobCookie.name]: bobCookie.value },
      })
      expect(res.statusCode).toBe(200)

      const rows = await prisma.bookShelfStory.findMany({ where: { storyId: storyAId } })
      expect(rows).toHaveLength(1)
    })

    test('returns 400 for an invalid kind in the path', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/my/bookshelf/${storyAId}/NONSENSE`,
        cookies: { [aliceCookie.name]: aliceCookie.value },
      })
      expect(res.statusCode).toBe(400)
    })

    test('returns 401 without a session', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/my/bookshelf/${storyAId}/FAVORITE`,
      })
      expect(res.statusCode).toBe(401)
    })
  })
})
