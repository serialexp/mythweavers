import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { promises as fs, createReadStream } from 'node:fs'
import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'
import FormData from 'form-data'
import sharp from 'sharp'
import { getUploadDir } from '../src/lib/file-storage.js'
import { prisma } from '../src/lib/prisma.js'
import { buildApp, cleanDatabase } from './helpers.js'

/**
 * Tests for the node-level default background endpoints
 * (PATCH /my/{stories|books|arcs|chapters|scenes}/:id/background) and the
 * resolution rules they feed into the public chapter content endpoint.
 *
 * Resolution recap (see src/routes/my/background.ts):
 *   - Each node level (Story/Book/Arc/Chapter/Scene) can store its own
 *     defaultBackgroundFileId.
 *   - A boundary "fires" only when the node has its OWN explicit default.
 *     Inheritance is just the fallback for resolving WHICH file fires.
 *   - Inline `type: 'background'` messages still work as overrides; they
 *     persist past scene/chapter/arc boundaries that don't fire (don't have
 *     their own explicit default).
 */

const testImagesDir = join(import.meta.dir, 'fixtures-bg-default')
const fileA = join(testImagesDir, 'a.png')
const fileB = join(testImagesDir, 'b.png')
const fileC = join(testImagesDir, 'c.png')

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp()
  await app.ready()
  await fs.mkdir(testImagesDir, { recursive: true })
  await sharp({ create: { width: 32, height: 32, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } } })
    .png()
    .toFile(fileA)
  await sharp({ create: { width: 32, height: 32, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 1 } } })
    .png()
    .toFile(fileB)
  await sharp({ create: { width: 32, height: 32, channels: 4, background: { r: 0, g: 0, b: 255, alpha: 1 } } })
    .png()
    .toFile(fileC)
})

afterAll(async () => {
  await app.close()
  await fs.rm(testImagesDir, { recursive: true, force: true })
  await fs.rm(getUploadDir(), { recursive: true, force: true })
})

// ---------- Helpers ----------

interface Cookie {
  name: string
  value: string
}

async function registerUser(suffix: string): Promise<{ cookie: Cookie; userId: number }> {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: {
      email: `bgdef${suffix}@example.com`,
      username: `bgdef${suffix}`,
      password: 'password123',
    },
  })
  return { cookie: res.cookies[0] as Cookie, userId: res.json().user.id }
}

async function uploadFile(cookie: Cookie, storyId: string, path: string): Promise<{ id: string; path: string }> {
  const form = new FormData()
  form.append('file', createReadStream(path), { filename: 'img.png', contentType: 'image/png' })
  form.append('storyId', storyId)
  const res = await app.inject({
    method: 'POST',
    url: '/my/files',
    headers: { ...form.getHeaders() },
    payload: form,
    cookies: { [cookie.name]: cookie.value },
  })
  return { id: res.json().file.id, path: res.json().file.path }
}

async function createTree(cookie: Cookie, storyName = 'Default-BG Story') {
  const storyId = (
    await app.inject({
      method: 'POST',
      url: '/my/stories',
      cookies: { [cookie.name]: cookie.value },
      payload: { name: storyName },
    })
  ).json().story.id as string

  const bookId = (
    await app.inject({
      method: 'POST',
      url: `/my/stories/${storyId}/books`,
      cookies: { [cookie.name]: cookie.value },
      payload: { name: 'Book' },
    })
  ).json().book.id as string

  const arcId = (
    await app.inject({
      method: 'POST',
      url: `/my/books/${bookId}/arcs`,
      cookies: { [cookie.name]: cookie.value },
      payload: { name: 'Arc' },
    })
  ).json().arc.id as string

  const chapterId = (
    await app.inject({
      method: 'POST',
      url: `/my/arcs/${arcId}/chapters`,
      cookies: { [cookie.name]: cookie.value },
      payload: { name: 'Chapter' },
    })
  ).json().chapter.id as string

  const sceneId = (
    await app.inject({
      method: 'POST',
      url: `/my/chapters/${chapterId}/scenes`,
      cookies: { [cookie.name]: cookie.value },
      payload: { name: 'Scene' },
    })
  ).json().scene.id as string

  return { storyId, bookId, arcId, chapterId, sceneId }
}

// ---------- Per-level endpoint tests ----------

describe('PATCH /my/{level}/:id/background', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  for (const level of ['story', 'book', 'arc', 'chapter', 'scene'] as const) {
    describe(level, () => {
      test(`sets and clears defaultBackgroundFileId on a ${level}`, async () => {
        const { cookie } = await registerUser(`-${level}-set`)
        const tree = await createTree(cookie)
        const file = await uploadFile(cookie, tree.storyId, fileA)
        const id =
          level === 'story' ? tree.storyId : level === 'book' ? tree.bookId : level === 'arc' ? tree.arcId : level === 'chapter' ? tree.chapterId : tree.sceneId
        const url = `/my/${level === 'story' ? 'stories' : level === 'book' ? 'books' : level === 'arc' ? 'arcs' : level === 'chapter' ? 'chapters' : 'scenes'}/${id}/background`

        // Set
        const setRes = await app.inject({
          method: 'PATCH',
          url,
          cookies: { [cookie.name]: cookie.value },
          payload: { backgroundFileId: file.id },
        })
        expect(setRes.statusCode).toBe(200)
        const setBody = setRes.json()
        expect(setBody.success).toBe(true)
        expect(setBody.entityType).toBe(level)
        expect(setBody.entityId).toBe(id)
        expect(setBody.storyId).toBe(tree.storyId)
        expect(setBody.defaultBackgroundFileId).toBe(file.id)
        expect(setBody.defaultBackgroundFile).toEqual({ id: file.id, path: file.path })

        // Clear
        const clearRes = await app.inject({
          method: 'PATCH',
          url,
          cookies: { [cookie.name]: cookie.value },
          payload: { backgroundFileId: null },
        })
        expect(clearRes.statusCode).toBe(200)
        const clearBody = clearRes.json()
        expect(clearBody.defaultBackgroundFileId).toBeNull()
        expect(clearBody.defaultBackgroundFile).toBeNull()
      })

      test(`rejects file from another story with 400 (${level})`, async () => {
        const owner = await registerUser(`-${level}-cross-a`)
        const ownerTree = await createTree(owner.cookie, 'Mine')
        const other = await registerUser(`-${level}-cross-b`)
        const otherTree = await createTree(other.cookie, 'Theirs')
        const stolenFile = await uploadFile(other.cookie, otherTree.storyId, fileA)

        const id =
          level === 'story' ? ownerTree.storyId : level === 'book' ? ownerTree.bookId : level === 'arc' ? ownerTree.arcId : level === 'chapter' ? ownerTree.chapterId : ownerTree.sceneId
        const url = `/my/${level === 'story' ? 'stories' : level === 'book' ? 'books' : level === 'arc' ? 'arcs' : level === 'chapter' ? 'chapters' : 'scenes'}/${id}/background`

        const res = await app.inject({
          method: 'PATCH',
          url,
          cookies: { [owner.cookie.name]: owner.cookie.value },
          payload: { backgroundFileId: stolenFile.id },
        })
        expect(res.statusCode).toBe(400)
        expect(res.json().error).toBeDefined()
      })

      test(`returns 404 when ${level} is owned by someone else`, async () => {
        const owner = await registerUser(`-${level}-own-a`)
        const ownerTree = await createTree(owner.cookie)
        const other = await registerUser(`-${level}-own-b`)

        const id =
          level === 'story' ? ownerTree.storyId : level === 'book' ? ownerTree.bookId : level === 'arc' ? ownerTree.arcId : level === 'chapter' ? ownerTree.chapterId : ownerTree.sceneId
        const url = `/my/${level === 'story' ? 'stories' : level === 'book' ? 'books' : level === 'arc' ? 'arcs' : level === 'chapter' ? 'chapters' : 'scenes'}/${id}/background`

        const res = await app.inject({
          method: 'PATCH',
          url,
          cookies: { [other.cookie.name]: other.cookie.value },
          payload: { backgroundFileId: null },
        })
        expect(res.statusCode).toBe(404)
      })

      test(`returns 401 without authentication (${level})`, async () => {
        const { cookie } = await registerUser(`-${level}-401`)
        const tree = await createTree(cookie)
        const id =
          level === 'story' ? tree.storyId : level === 'book' ? tree.bookId : level === 'arc' ? tree.arcId : level === 'chapter' ? tree.chapterId : tree.sceneId
        const url = `/my/${level === 'story' ? 'stories' : level === 'book' ? 'books' : level === 'arc' ? 'arcs' : level === 'chapter' ? 'chapters' : 'scenes'}/${id}/background`

        const res = await app.inject({
          method: 'PATCH',
          url,
          payload: { backgroundFileId: null },
        })
        expect(res.statusCode).toBe(401)
      })
    })
  }

  test('rejects body missing backgroundFileId field with 400', async () => {
    const { cookie } = await registerUser('-bad-body')
    const tree = await createTree(cookie)
    const res = await app.inject({
      method: 'PATCH',
      url: `/my/stories/${tree.storyId}/background`,
      cookies: { [cookie.name]: cookie.value },
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })
})

// ---------- Resolution tests ----------
//
// These exercise the public chapter content endpoint to verify that
// node-level defaults plus inline overrides resolve to the correct
// `enteringBackgroundUrl` and `background` blocks.
//
// Setup: we publish chapters directly via Prisma (skipping the full
// publishing flow) so the public reader endpoint can fetch them.

async function publishChapterAndStory(storyId: string, chapterId: string) {
  const now = new Date()
  await prisma.story.update({
    where: { id: storyId },
    data: { publishedAt: now, published: true },
  })
  await prisma.chapter.update({
    where: { id: chapterId },
    data: { publishedAt: now, publishedOn: now },
  })
}

interface ChapterContent {
  id: string
  enteringBackgroundUrl: string | null
  scenes: { id: string; blocks: Array<{ type: string; url?: string; html?: string; fileId?: string }> }[]
}

async function getChapterContent(storyId: string, chapterId: string): Promise<ChapterContent> {
  const res = await app.inject({
    method: 'GET',
    url: `/stories/${storyId}/chapters/${chapterId}`,
  })
  expect(res.statusCode).toBe(200)
  return res.json().chapter as ChapterContent
}

async function setBackground(
  cookie: Cookie,
  level: 'story' | 'book' | 'arc' | 'chapter' | 'scene',
  id: string,
  fileId: string | null,
) {
  const path = level === 'story' ? 'stories' : level === 'book' ? 'books' : level === 'arc' ? 'arcs' : level === 'chapter' ? 'chapters' : 'scenes'
  const res = await app.inject({
    method: 'PATCH',
    url: `/my/${path}/${id}/background`,
    cookies: { [cookie.name]: cookie.value },
    payload: { backgroundFileId: fileId },
  })
  expect(res.statusCode).toBe(200)
}

describe('Background resolution in public chapter content', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  test('story-level default produces enteringBackgroundUrl on a chapter with no other defaults', async () => {
    const { cookie } = await registerUser('-res-story')
    const tree = await createTree(cookie)
    const fA = await uploadFile(cookie, tree.storyId, fileA)
    await setBackground(cookie, 'story', tree.storyId, fA.id)
    await publishChapterAndStory(tree.storyId, tree.chapterId)

    const chapter = await getChapterContent(tree.storyId, tree.chapterId)
    expect(chapter.enteringBackgroundUrl).toBe(fA.path)
    // Scene has no own default → no scene-boundary firing block.
    expect(chapter.scenes[0].blocks.filter((b) => b.type === 'background')).toHaveLength(0)
  })

  test('chapter default overrides story default in enteringBackgroundUrl', async () => {
    const { cookie } = await registerUser('-res-chapter')
    const tree = await createTree(cookie)
    const fA = await uploadFile(cookie, tree.storyId, fileA)
    const fB = await uploadFile(cookie, tree.storyId, fileB)
    await setBackground(cookie, 'story', tree.storyId, fA.id)
    await setBackground(cookie, 'chapter', tree.chapterId, fB.id)
    await publishChapterAndStory(tree.storyId, tree.chapterId)

    const chapter = await getChapterContent(tree.storyId, tree.chapterId)
    // Chapter-level firing folded into entering URL.
    expect(chapter.enteringBackgroundUrl).toBe(fB.path)
  })

  test('scene default emits a firing block at the start of that scene', async () => {
    const { cookie } = await registerUser('-res-scene')
    const tree = await createTree(cookie)
    const fA = await uploadFile(cookie, tree.storyId, fileA)
    await setBackground(cookie, 'scene', tree.sceneId, fA.id)
    await publishChapterAndStory(tree.storyId, tree.chapterId)

    const chapter = await getChapterContent(tree.storyId, tree.chapterId)
    // No higher-level defaults → entering is null.
    expect(chapter.enteringBackgroundUrl).toBeNull()
    // Scene-level firing produces a block at scene start.
    const bgBlocks = chapter.scenes[0].blocks.filter((b) => b.type === 'background')
    expect(bgBlocks).toHaveLength(1)
    expect(bgBlocks[0].url).toBe(fA.path)
    expect(bgBlocks[0].fileId).toBe(fA.id)
  })

  test('inline override persists across a non-firing scene boundary, then resets at one that fires', async () => {
    // Scenario: arc-level default = A. Two scenes (S1, S2, S3). Inline
    // override in S1 → B. S2 has no own default → B persists. S3 has its
    // own default = C → C fires (overriding B).
    const { cookie } = await registerUser('-res-inline')
    const tree = await createTree(cookie)
    const fA = await uploadFile(cookie, tree.storyId, fileA)
    const fB = await uploadFile(cookie, tree.storyId, fileB)
    const fC = await uploadFile(cookie, tree.storyId, fileC)
    await setBackground(cookie, 'arc', tree.arcId, fA.id)

    // Add inline override message in S1.
    await app.inject({
      method: 'POST',
      url: `/my/scenes/${tree.sceneId}/messages`,
      cookies: { [cookie.name]: cookie.value },
      payload: { type: 'background', backgroundFileId: fB.id },
    })

    // Add S2 (no scene default).
    const s2Id = (
      await app.inject({
        method: 'POST',
        url: `/my/chapters/${tree.chapterId}/scenes`,
        cookies: { [cookie.name]: cookie.value },
        payload: { name: 'Scene 2' },
      })
    ).json().scene.id as string

    // Add S3 with its own default = C.
    const s3Id = (
      await app.inject({
        method: 'POST',
        url: `/my/chapters/${tree.chapterId}/scenes`,
        cookies: { [cookie.name]: cookie.value },
        payload: { name: 'Scene 3' },
      })
    ).json().scene.id as string
    await setBackground(cookie, 'scene', s3Id, fC.id)

    await publishChapterAndStory(tree.storyId, tree.chapterId)

    const chapter = await getChapterContent(tree.storyId, tree.chapterId)
    // Entering = arc default (A).
    expect(chapter.enteringBackgroundUrl).toBe(fA.path)

    // Scene 1: inline override message → emits B block.
    const s1Bgs = chapter.scenes[0].blocks.filter((b) => b.type === 'background').map((b) => b.url)
    expect(s1Bgs).toEqual([fB.path])

    // Scene 2: no own default, no inline → emits NOTHING. The reader keeps
    // the prior active value (B from S1's inline). This is the
    // "inline-override persists past non-firing boundary" behaviour.
    const s2 = chapter.scenes.find((s) => s.id === s2Id)!
    expect(s2.blocks.filter((b) => b.type === 'background')).toHaveLength(0)

    // Scene 3: scene-level firing emits C, overriding the inline B.
    const s3 = chapter.scenes.find((s) => s.id === s3Id)!
    const s3Bgs = s3.blocks.filter((b) => b.type === 'background').map((b) => b.url)
    expect(s3Bgs).toEqual([fC.path])
  })

  test('scene with explicit default overrides inherited arc default at its boundary', async () => {
    const { cookie } = await registerUser('-res-scene-ovr')
    const tree = await createTree(cookie)
    const fA = await uploadFile(cookie, tree.storyId, fileA)
    const fB = await uploadFile(cookie, tree.storyId, fileB)
    await setBackground(cookie, 'arc', tree.arcId, fA.id)
    await setBackground(cookie, 'scene', tree.sceneId, fB.id)
    await publishChapterAndStory(tree.storyId, tree.chapterId)

    const chapter = await getChapterContent(tree.storyId, tree.chapterId)
    // Entering = arc default (A) — chapter has no own default, scene firing
    // is emitted as a block, not folded into entering.
    expect(chapter.enteringBackgroundUrl).toBe(fA.path)
    // Scene firing emits B at the start of the only scene.
    const bgs = chapter.scenes[0].blocks.filter((b) => b.type === 'background').map((b) => b.url)
    expect(bgs).toEqual([fB.path])
  })

  test('inline background message in a prior chapter carries across to next chapter', async () => {
    // Two chapters: chapter 1 has an inline background; chapter 2 has no
    // defaults of its own. Reading chapter 2, enteringBackgroundUrl should
    // be the inline background from chapter 1.
    const { cookie } = await registerUser('-res-carry')
    const tree = await createTree(cookie)
    const fA = await uploadFile(cookie, tree.storyId, fileA)

    // Inline background in chapter 1's scene.
    const msgRes = await app.inject({
      method: 'POST',
      url: `/my/scenes/${tree.sceneId}/messages`,
      cookies: { [cookie.name]: cookie.value },
      payload: { type: 'background', backgroundFileId: fA.id },
    })
    expect(msgRes.statusCode).toBe(201)

    // Create chapter 2 with a scene.
    const chapter2Id = (
      await app.inject({
        method: 'POST',
        url: `/my/arcs/${tree.arcId}/chapters`,
        cookies: { [cookie.name]: cookie.value },
        payload: { name: 'Chapter 2' },
      })
    ).json().chapter.id as string
    await app.inject({
      method: 'POST',
      url: `/my/chapters/${chapter2Id}/scenes`,
      cookies: { [cookie.name]: cookie.value },
      payload: { name: 'Scene 2-1' },
    })

    // Publish both chapters.
    await publishChapterAndStory(tree.storyId, tree.chapterId)
    await prisma.chapter.update({
      where: { id: chapter2Id },
      data: { publishedAt: new Date(), publishedOn: new Date() },
    })

    const ch2 = await getChapterContent(tree.storyId, chapter2Id)
    expect(ch2.enteringBackgroundUrl).toBe(fA.path)
  })
})

// ---------- File promotion on background-set ----------

describe('promoteFileToPublic on background set', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  test('PATCHing a default background flips File.visibility to public', async () => {
    const { cookie } = await registerUser('-promote-default')
    const tree = await createTree(cookie)
    const file = await uploadFile(cookie, tree.storyId, fileA)

    // Sanity: uploaded files start out private.
    const before = await prisma.file.findUniqueOrThrow({ where: { id: file.id } })
    expect(before.visibility).toBe('private')

    const res = await app.inject({
      method: 'PATCH',
      url: `/my/chapters/${tree.chapterId}/background`,
      cookies: { [cookie.name]: cookie.value },
      payload: { backgroundFileId: file.id },
    })
    expect(res.statusCode).toBe(200)

    const after = await prisma.file.findUniqueOrThrow({ where: { id: file.id } })
    expect(after.visibility).toBe('public')
  })

  test('clearing a background does NOT demote the file (one-way promotion)', async () => {
    const { cookie } = await registerUser('-promote-clear')
    const tree = await createTree(cookie)
    const file = await uploadFile(cookie, tree.storyId, fileA)

    // Set then clear.
    await app.inject({
      method: 'PATCH',
      url: `/my/chapters/${tree.chapterId}/background`,
      cookies: { [cookie.name]: cookie.value },
      payload: { backgroundFileId: file.id },
    })
    await app.inject({
      method: 'PATCH',
      url: `/my/chapters/${tree.chapterId}/background`,
      cookies: { [cookie.name]: cookie.value },
      payload: { backgroundFileId: null },
    })

    const after = await prisma.file.findUniqueOrThrow({ where: { id: file.id } })
    expect(after.visibility).toBe('public')
  })

  test('inline background-message creation promotes the file', async () => {
    const { cookie } = await registerUser('-promote-inline')
    const tree = await createTree(cookie)
    const file = await uploadFile(cookie, tree.storyId, fileA)

    const before = await prisma.file.findUniqueOrThrow({ where: { id: file.id } })
    expect(before.visibility).toBe('private')

    const res = await app.inject({
      method: 'POST',
      url: `/my/scenes/${tree.sceneId}/messages`,
      cookies: { [cookie.name]: cookie.value },
      payload: {
        type: 'background',
        backgroundFileId: file.id,
      },
    })
    expect(res.statusCode).toBe(201)

    const after = await prisma.file.findUniqueOrThrow({ where: { id: file.id } })
    expect(after.visibility).toBe('public')
  })

  test('private files block unauthenticated reads (visibility gate, not auth gate)', async () => {
    // Anonymous GETs against /my/files/* used to bounce off requireAuth with
    // a 401 — the change to attachUser means the visibility check inside the
    // handler runs for anonymous requests too. For a never-promoted file,
    // that check resolves to "not the owner" → 404 (collapsed with "no
    // session" so we don't leak existence to non-owners).
    const { cookie } = await registerUser('-private-anon')
    const tree = await createTree(cookie)
    const file = await uploadFile(cookie, tree.storyId, fileA)

    const res = await app.inject({ method: 'GET', url: file.path })
    expect(res.statusCode).toBe(404)
    // Crucially NOT 401 — the visibility check ran, it just didn't allow access.
    expect(res.statusCode).not.toBe(401)
  })

  test('GET /my/files/<unknown> returns 404 anonymously (not 401)', async () => {
    // Same shape as the real-world reader case, but for a path that doesn't
    // resolve to a file row. Asserts attachUser lets the request through to
    // the handler instead of throwing 401 at the preHandler stage.
    const res = await app.inject({ method: 'GET', url: '/my/files/does/not/exist.png' })
    expect(res.statusCode).toBe(404)
  })
})
