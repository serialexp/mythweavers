import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../src/lib/prisma.js'
import { buildApp, cleanDatabase } from './helpers.js'

/**
 * Tests for the public authors endpoints (/authors, /authors/:id).
 *
 * Both endpoints are unauthenticated and only surface stories whose
 * `publishedAt` is in the past — drafts and scheduled-for-the-future stories
 * must not influence counts or appear in the catalogue.
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

async function createStory(
  app: FastifyInstance,
  cookie: SessionCookie,
  name: string,
  options: { publish?: boolean | 'future' } = { publish: true },
): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/my/stories',
    cookies: { [cookie.name]: cookie.value },
    payload: { name, summary: `<p>${name}</p>` },
  })
  expect(res.statusCode).toBe(201)
  const storyId = res.json().story.id as string

  if (options.publish === true) {
    await prisma.story.update({
      where: { id: storyId },
      data: { publishedAt: new Date(Date.now() - 1000) },
    })
  } else if (options.publish === 'future') {
    await prisma.story.update({
      where: { id: storyId },
      data: { publishedAt: new Date(Date.now() + 60 * 60 * 1000) },
    })
  }
  return storyId
}

describe('Public Authors Endpoints', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = await buildApp()
    await cleanDatabase()
  })

  afterEach(async () => {
    await app.close()
  })

  // ---- GET /authors ---------------------------------------------------------

  describe('GET /authors', () => {
    test('returns empty list when no authors have published stories', async () => {
      // Author exists but has no published stories — should not appear.
      const aliceCookie = await registerUser(app, 'alice@example.com', 'alice')
      await createStory(app, aliceCookie, 'Draft Only', { publish: false })

      const res = await app.inject({ method: 'GET', url: '/authors' })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ authors: [] })
    })

    test('lists authors with their published-story counts', async () => {
      const aliceCookie = await registerUser(app, 'alice@example.com', 'alice')
      const bobCookie = await registerUser(app, 'bob@example.com', 'bob')

      await createStory(app, aliceCookie, 'Alice One')
      await createStory(app, aliceCookie, 'Alice Two')
      await createStory(app, bobCookie, 'Bob One')

      const res = await app.inject({ method: 'GET', url: '/authors' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.authors).toHaveLength(2)
      const alice = body.authors.find((a: any) => a.username === 'alice')
      const bob = body.authors.find((a: any) => a.username === 'bob')
      expect(alice.storyCount).toBe(2)
      expect(bob.storyCount).toBe(1)
    })

    test("excludes drafts and scheduled-future stories from author counts", async () => {
      const aliceCookie = await registerUser(app, 'alice@example.com', 'alice')
      await createStory(app, aliceCookie, 'Live')
      await createStory(app, aliceCookie, 'Draft', { publish: false })
      await createStory(app, aliceCookie, 'Scheduled', { publish: 'future' })

      const res = await app.inject({ method: 'GET', url: '/authors' })
      const alice = res.json().authors.find((a: any) => a.username === 'alice')
      expect(alice.storyCount).toBe(1)
    })

    test('filters by username via ?search', async () => {
      const aliceCookie = await registerUser(app, 'alice@example.com', 'alice')
      const bobCookie = await registerUser(app, 'bob@example.com', 'bob')
      await createStory(app, aliceCookie, 'A')
      await createStory(app, bobCookie, 'B')

      const res = await app.inject({ method: 'GET', url: '/authors?search=ali' })
      expect(res.statusCode).toBe(200)
      const usernames = res.json().authors.map((a: any) => a.username)
      expect(usernames).toEqual(['alice'])
    })
  })

  // ---- GET /authors/:id -----------------------------------------------------

  describe('GET /authors/:id', () => {
    test('returns 404 for an unknown author', async () => {
      const res = await app.inject({ method: 'GET', url: '/authors/999999' })
      expect(res.statusCode).toBe(404)
    })

    test("returns the author and their visible stories", async () => {
      const aliceCookie = await registerUser(app, 'alice@example.com', 'alice')
      await createStory(app, aliceCookie, 'Alice Live')
      await createStory(app, aliceCookie, 'Alice Draft', { publish: false })

      const alice = await prisma.user.findUnique({ where: { username: 'alice' } })
      expect(alice).not.toBeNull()

      const res = await app.inject({ method: 'GET', url: `/authors/${alice!.id}` })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.author.username).toBe('alice')
      expect(body.author.storyCount).toBe(1)
      expect(body.stories).toHaveLength(1)
      expect(body.stories[0].name).toBe('Alice Live')
    })
  })
})
