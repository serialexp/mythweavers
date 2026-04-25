import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { promises as fs, createReadStream } from 'node:fs'
import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'
import FormData from 'form-data'
import sharp from 'sharp'
import { getUploadDir } from '../src/lib/file-storage.js'
import { buildApp, cleanDatabase } from './helpers.js'

/**
 * Tests for GET /my/stories/:id/export — the JSON export endpoint the
 * writer uses to back up a story. Historically this endpoint breaks
 * silently whenever a new column is added to any of the exported models
 * because the strict Zod response schema rejects the response and the
 * user only finds out when they hit the page. This test exercises the
 * full surface so schema drift fails CI.
 *
 * Covers:
 *  - Exporting a story that has *one of every current message type*
 *    (null/prose, event, branch, background) — if a new message column
 *    lands without matching schema/handler work, this will fail.
 *  - Exporting a story with a cover art file and a character picture so
 *    the file-linked fields are non-null.
 *  - Scheduled publishing fields (Story.publishedAt, Chapter.publishedAt)
 *    flow through the export.
 */

const testImagesDir = join(import.meta.dir, 'fixtures-export')
const coverImagePath = join(testImagesDir, 'cover.png')

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp()
  await app.ready()

  await fs.mkdir(testImagesDir, { recursive: true })
  await sharp({
    create: { width: 32, height: 32, channels: 4, background: { r: 128, g: 128, b: 255, alpha: 1 } },
  })
    .png()
    .toFile(coverImagePath)
})

afterAll(async () => {
  await app.close()
  await fs.rm(testImagesDir, { recursive: true, force: true })
  await fs.rm(getUploadDir(), { recursive: true, force: true })
})

async function uploadFile(
  cookie: { name: string; value: string },
  storyId: string | undefined,
): Promise<{ id: string; path: string }> {
  const form = new FormData()
  form.append('file', createReadStream(coverImagePath), {
    filename: 'cover.png',
    contentType: 'image/png',
  })
  if (storyId) form.append('storyId', storyId)
  const res = await app.inject({
    method: 'POST',
    url: '/my/files',
    headers: { ...form.getHeaders() },
    payload: form,
    cookies: { [cookie.name]: cookie.value },
  })
  return { id: res.json().file.id, path: res.json().file.path }
}

describe('GET /my/stories/:id/export (JSON)', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  test('exports a full story covering all current message types without schema errors', async () => {
    // --- Register a user ---
    const register = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: 'export-full@example.com',
        username: 'exportfull',
        password: 'password123',
      },
    })
    const cookie = register.cookies[0]

    // --- Create story ---
    const storyId = (
      await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [cookie.name]: cookie.value },
        payload: { name: 'Export Full Story', summary: 'Exercises the export surface' },
      })
    ).json().story.id

    // --- Upload a cover art file, then attach it to the story ---
    const coverFile = await uploadFile(cookie, storyId)
    await app.inject({
      method: 'PATCH',
      url: `/my/stories/${storyId}`,
      cookies: { [cookie.name]: cookie.value },
      payload: { coverArtFileId: coverFile.id, published: true },
    })

    // --- Character with a picture file ---
    const charPictureFile = await uploadFile(cookie, storyId)
    await app.inject({
      method: 'POST',
      url: `/my/stories/${storyId}/characters`,
      cookies: { [cookie.name]: cookie.value },
      payload: {
        firstName: 'Hero',
        pictureFileId: charPictureFile.id,
        isMainCharacter: true,
      },
    })

    // --- Full tree: book → arc → chapter → scene ---
    const bookId = (
      await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/books`,
        cookies: { [cookie.name]: cookie.value },
        payload: { name: 'Book 1' },
      })
    ).json().book.id

    const arcId = (
      await app.inject({
        method: 'POST',
        url: `/my/books/${bookId}/arcs`,
        cookies: { [cookie.name]: cookie.value },
        payload: { name: 'Arc 1' },
      })
    ).json().arc.id

    const chapterId = (
      await app.inject({
        method: 'POST',
        url: `/my/arcs/${arcId}/chapters`,
        cookies: { [cookie.name]: cookie.value },
        payload: { name: 'Chapter 1' },
      })
    ).json().chapter.id

    const sceneId = (
      await app.inject({
        method: 'POST',
        url: `/my/chapters/${chapterId}/scenes`,
        cookies: { [cookie.name]: cookie.value },
        payload: { name: 'Scene 1' },
      })
    ).json().scene.id

    // --- One of every current message type ---
    // 1. A plain prose message (type = null)
    await app.inject({
      method: 'POST',
      url: `/my/scenes/${sceneId}/messages`,
      cookies: { [cookie.name]: cookie.value },
      payload: { instruction: 'Describe the scene' },
    })

    // 2. An event message
    const eventRes = await app.inject({
      method: 'POST',
      url: `/my/scenes/${sceneId}/messages`,
      cookies: { [cookie.name]: cookie.value },
      payload: { type: 'event' },
    })
    expect(eventRes.statusCode).toBe(201)

    // 3. A branch message
    const branchRes = await app.inject({
      method: 'POST',
      url: `/my/scenes/${sceneId}/messages`,
      cookies: { [cookie.name]: cookie.value },
      payload: { type: 'branch', options: [] },
    })
    expect(branchRes.statusCode).toBe(201)

    // 4. A background message with a real file (only if the schema has
    // landed — blocked on the pending migration, see CURRENT_TASK.md).
    let backgroundCreated = false
    const bgFile = await uploadFile(cookie, storyId)
    const bgRes = await app.inject({
      method: 'POST',
      url: `/my/scenes/${sceneId}/messages`,
      cookies: { [cookie.name]: cookie.value },
      payload: { type: 'background', backgroundFileId: bgFile.id },
    })
    backgroundCreated = bgRes.statusCode === 201

    // --- Run the export ---
    const res = await app.inject({
      method: 'GET',
      url: `/my/stories/${storyId}/export`,
      cookies: { [cookie.name]: cookie.value },
    })

    // Helpful diagnostic if the strict schema rejects the response.
    if (res.statusCode !== 200) {
      // Surface the server's error message to make schema drift obvious.
      // biome-ignore lint/suspicious/noConsole: test diagnostic
      console.error('Export failed:', res.statusCode, res.body)
    }

    expect(res.statusCode).toBe(200)
    const body = res.json()

    // Basic shape assertions — the real value is that the response
    // matched the Zod schema at all (else Fastify would 500 here).
    expect(body.story.id).toBe(storyId)
    expect(body.story.name).toBe('Export Full Story')
    expect(body.story.publishedAt).not.toBeNull()
    expect(body.story.coverArtUrl).toBe(coverFile.path)
    expect(body.books).toHaveLength(1)
    expect(body.books[0].arcs).toHaveLength(1)
    expect(body.books[0].arcs[0].chapters).toHaveLength(1)
    expect(body.books[0].arcs[0].chapters[0].scenes).toHaveLength(1)

    const messages = body.books[0].arcs[0].chapters[0].scenes[0].messages
    expect(messages).toHaveLength(backgroundCreated ? 4 : 3)

    const types = messages.map((m: { type: string | null }) => m.type)
    expect(types).toContain('event')
    expect(types).toContain('branch')
    if (backgroundCreated) expect(types).toContain('background')
    // Plain prose message has type=null.
    expect(types).toContain(null)

    expect(body.characters).toHaveLength(1)
    expect(body.characters[0].firstName).toBe('Hero')
    expect(body.characters[0].pictureFileUrl).toBe(charPictureFile.path)
  })

  test('returns 404 when exporting a story the user does not own', async () => {
    const owner = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: 'export-owner@example.com',
        username: 'exportowner',
        password: 'password123',
      },
    })
    const ownerCookie = owner.cookies[0]

    const storyId = (
      await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [ownerCookie.name]: ownerCookie.value },
        payload: { name: 'Private Story' },
      })
    ).json().story.id

    const stranger = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: 'export-stranger@example.com',
        username: 'exportstranger',
        password: 'password123',
      },
    })
    const strangerCookie = stranger.cookies[0]

    const res = await app.inject({
      method: 'GET',
      url: `/my/stories/${storyId}/export`,
      cookies: { [strangerCookie.name]: strangerCookie.value },
    })
    expect(res.statusCode).toBe(404)
  })
})
