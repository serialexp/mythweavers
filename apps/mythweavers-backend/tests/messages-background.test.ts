import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { promises as fs, createReadStream } from 'node:fs'
import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'
import FormData from 'form-data'
import sharp from 'sharp'
import { getUploadDir } from '../src/lib/file-storage.js'
import { buildApp, cleanDatabase } from './helpers.js'

/**
 * Background-image message tests. Covers:
 *  - Creating a message with type='background' + backgroundFileId returns the
 *    hydrated `backgroundFile` { id, path }.
 *  - Type/backgroundFileId pairing validation (type=background needs file;
 *    file without type=background is rejected).
 *  - Cross-user file ownership rejection.
 *  - PATCH update can replace the file id.
 *
 * Public chapter response shape is exercised by the existing chapters tests +
 * Zod response schema validation in the Fastify pipeline; this file stays
 * focused on the writer-facing validation surface.
 */

const testImagesDir = join(import.meta.dir, 'fixtures-background')
const testImagePath = join(testImagesDir, 'bg-image.png')
const testImagePath2 = join(testImagesDir, 'bg-image-2.png')

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp()
  await app.ready()

  await fs.mkdir(testImagesDir, { recursive: true })
  await sharp({
    create: { width: 64, height: 64, channels: 4, background: { r: 200, g: 0, b: 0, alpha: 1 } },
  })
    .png()
    .toFile(testImagePath)
  await sharp({
    create: { width: 64, height: 64, channels: 4, background: { r: 0, g: 200, b: 0, alpha: 1 } },
  })
    .png()
    .toFile(testImagePath2)
})

afterAll(async () => {
  await app.close()
  await fs.rm(testImagesDir, { recursive: true, force: true })
  await fs.rm(getUploadDir(), { recursive: true, force: true })
})

interface UserCtx {
  cookie: { name: string; value: string }
  userId: number
  storyId: string
  sceneId: string
}

async function setupUserAndScene(suffix = ''): Promise<UserCtx> {
  const register = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: {
      email: `bg${suffix}@example.com`,
      username: `bguser${suffix}`,
      password: 'password123',
    },
  })
  const cookie = register.cookies[0]
  const userId = register.json().user.id

  const storyId = (
    await app.inject({
      method: 'POST',
      url: '/my/stories',
      cookies: { [cookie.name]: cookie.value },
      payload: { name: `BG Story${suffix}` },
    })
  ).json().story.id

  const bookId = (
    await app.inject({
      method: 'POST',
      url: `/my/stories/${storyId}/books`,
      cookies: { [cookie.name]: cookie.value },
      payload: { name: 'Book' },
    })
  ).json().book.id

  const arcId = (
    await app.inject({
      method: 'POST',
      url: `/my/books/${bookId}/arcs`,
      cookies: { [cookie.name]: cookie.value },
      payload: { name: 'Arc' },
    })
  ).json().arc.id

  const chapterId = (
    await app.inject({
      method: 'POST',
      url: `/my/arcs/${arcId}/chapters`,
      cookies: { [cookie.name]: cookie.value },
      payload: { name: 'Chapter' },
    })
  ).json().chapter.id

  const sceneId = (
    await app.inject({
      method: 'POST',
      url: `/my/chapters/${chapterId}/scenes`,
      cookies: { [cookie.name]: cookie.value },
      payload: { name: 'Scene' },
    })
  ).json().scene.id

  return { cookie, userId, storyId, sceneId }
}

async function uploadFile(
  cookie: { name: string; value: string },
  storyId: string | undefined,
  imagePath: string,
): Promise<{ id: string; path: string }> {
  const form = new FormData()
  form.append('file', createReadStream(imagePath), {
    filename: 'bg-image.png',
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

describe('Background message validation', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  test("creates message with type='background' + hydrates backgroundFile", async () => {
    const ctx = await setupUserAndScene()
    const file = await uploadFile(ctx.cookie, ctx.storyId, testImagePath)

    const res = await app.inject({
      method: 'POST',
      url: `/my/scenes/${ctx.sceneId}/messages`,
      cookies: { [ctx.cookie.name]: ctx.cookie.value },
      payload: { type: 'background', backgroundFileId: file.id },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.message.type).toBe('background')
    expect(body.message.backgroundFileId).toBe(file.id)
    expect(body.message.backgroundFile).toEqual({ id: file.id, path: file.path })
  })

  test("rejects type='background' without backgroundFileId", async () => {
    const ctx = await setupUserAndScene()
    const res = await app.inject({
      method: 'POST',
      url: `/my/scenes/${ctx.sceneId}/messages`,
      cookies: { [ctx.cookie.name]: ctx.cookie.value },
      payload: { type: 'background' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toContain('backgroundFileId')
  })

  test('rejects backgroundFileId without type=background', async () => {
    const ctx = await setupUserAndScene()
    const file = await uploadFile(ctx.cookie, ctx.storyId, testImagePath)
    const res = await app.inject({
      method: 'POST',
      url: `/my/scenes/${ctx.sceneId}/messages`,
      cookies: { [ctx.cookie.name]: ctx.cookie.value },
      payload: { backgroundFileId: file.id },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toMatch(/background/i)
  })

  test('rejects file owned by a different user', async () => {
    const owner = await setupUserAndScene('a')
    const otherFile = await uploadFile(owner.cookie, owner.storyId, testImagePath)

    const stranger = await setupUserAndScene('b')
    const res = await app.inject({
      method: 'POST',
      url: `/my/scenes/${stranger.sceneId}/messages`,
      cookies: { [stranger.cookie.name]: stranger.cookie.value },
      payload: { type: 'background', backgroundFileId: otherFile.id },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toMatch(/owned/i)
  })

  test('PATCH replaces backgroundFileId on an existing background message', async () => {
    const ctx = await setupUserAndScene()
    const file1 = await uploadFile(ctx.cookie, ctx.storyId, testImagePath)
    const file2 = await uploadFile(ctx.cookie, ctx.storyId, testImagePath2)

    const created = await app.inject({
      method: 'POST',
      url: `/my/scenes/${ctx.sceneId}/messages`,
      cookies: { [ctx.cookie.name]: ctx.cookie.value },
      payload: { type: 'background', backgroundFileId: file1.id },
    })
    const messageId = created.json().message.id

    const patched = await app.inject({
      method: 'PATCH',
      url: `/my/messages/${messageId}`,
      cookies: { [ctx.cookie.name]: ctx.cookie.value },
      payload: { backgroundFileId: file2.id },
    })

    expect(patched.statusCode).toBe(200)
    const body = patched.json()
    expect(body.message.backgroundFileId).toBe(file2.id)
    expect(body.message.backgroundFile).toEqual({ id: file2.id, path: file2.path })
  })
})
