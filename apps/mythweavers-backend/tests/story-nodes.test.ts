/**
 * Integration tests for the unified node surface: POST /my/nodes,
 * PATCH /my/nodes/:id, POST /my/nodes/:id/move and GET /my/nodes/:id/content.
 *
 * The point of these endpoints is that the kind is derived from the parent and
 * that a field belonging to a different kind fails loudly, so most of what is
 * asserted here is error *text*, not just status codes — that text is the only
 * feedback an agent gets.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { buildApp, cleanDatabase } from './helpers.js'

describe('Unified node endpoints', () => {
  let app: FastifyInstance
  let sessionCookie: { name: string; value: string }
  let storyId: string
  let bookId: string
  let arcId: string
  let chapterId: string

  const auth = () => ({ [sessionCookie.name]: sessionCookie.value })

  beforeEach(async () => {
    app = await buildApp()
    await cleanDatabase()

    const registerResponse = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'nodes@example.com', username: 'nodesuser', password: 'password123' },
    })
    sessionCookie = registerResponse.cookies[0]

    const storyResponse = await app.inject({
      method: 'POST',
      url: '/my/stories',
      cookies: auth(),
      payload: { name: 'Test Story' },
    })
    storyId = storyResponse.json().story.id

    const bookResponse = await app.inject({
      method: 'POST',
      url: `/my/stories/${storyId}/books`,
      cookies: auth(),
      payload: { name: 'Test Book' },
    })
    bookId = bookResponse.json().book.id

    const arcResponse = await app.inject({
      method: 'POST',
      url: `/my/books/${bookId}/arcs`,
      cookies: auth(),
      payload: { name: 'Test Arc' },
    })
    arcId = arcResponse.json().arc.id

    const chapterResponse = await app.inject({
      method: 'POST',
      url: `/my/arcs/${arcId}/chapters`,
      cookies: auth(),
      payload: { name: 'Test Chapter' },
    })
    chapterId = chapterResponse.json().chapter.id
  })

  afterEach(async () => {
    await app.close()
  })

  const createNode = (payload: Record<string, unknown>) =>
    app.inject({ method: 'POST', url: '/my/nodes', cookies: auth(), payload })

  describe('POST /my/nodes — kind derivation', () => {
    test('creates a book under a story', async () => {
      const response = await createNode({ parentId: storyId, name: 'Book Two' })

      expect(response.statusCode).toBe(201)
      expect(response.json().node).toMatchObject({
        kind: 'book',
        name: 'Book Two',
        parentId: storyId,
        storyId,
        sortOrder: 1,
      })
    })

    test('creates an arc under a book', async () => {
      const response = await createNode({ parentId: bookId, name: 'Arc Two' })
      expect(response.statusCode).toBe(201)
      expect(response.json().node.kind).toBe('arc')
    })

    test('creates a chapter under an arc', async () => {
      const response = await createNode({ parentId: arcId, name: 'Chapter Two' })
      expect(response.statusCode).toBe(201)
      expect(response.json().node.kind).toBe('chapter')
    })

    test('creates a scene under a chapter', async () => {
      const response = await createNode({ parentId: chapterId, name: 'Riverbank' })
      expect(response.statusCode).toBe(201)
      expect(response.json().node.kind).toBe('scene')
    })

    test('refuses to create anything under a scene', async () => {
      const scene = await createNode({ parentId: chapterId, name: 'Riverbank' })
      const response = await createNode({ parentId: scene.json().node.id, name: 'Nope' })

      expect(response.statusCode).toBe(400)
      expect(response.json().error).toContain('A scene cannot contain child nodes')
    })

    test('accepts a client-supplied id', async () => {
      const response = await createNode({ parentId: arcId, name: 'Pinned', id: 'my-own-chapter-id' })
      expect(response.statusCode).toBe(201)
      expect(response.json().node.id).toBe('my-own-chapter-id')
    })
  })

  describe('POST /my/nodes — field validation', () => {
    test('names the offending field and where it does belong', async () => {
      const response = await createNode({ parentId: arcId, name: 'Chapter Two', perspective: 'THIRD' })

      expect(response.statusCode).toBe(400)
      const { error } = response.json()
      expect(error).toContain('"perspective" is only valid on scene nodes')
      expect(error).toContain('You are creating a chapter under arc "Test Arc"')
      expect(error).toContain('Valid fields for a chapter:')
      expect(error).toContain('status')
    })

    test('rejects a field that belongs to no kind at all', async () => {
      const response = await createNode({ parentId: arcId, name: 'Chapter Two', wibble: 1 })

      expect(response.statusCode).toBe(400)
      expect(response.json().error).toContain('"wibble" is not a node field')
    })

    test('rejects sortOrder — ordering goes through position', async () => {
      const response = await createNode({ parentId: arcId, name: 'Chapter Two', sortOrder: 5 })
      expect(response.statusCode).toBe(400)
      expect(response.json().error).toContain('"sortOrder" is not a node field')
    })

    test('rejects deleted on create, pointing at update', async () => {
      const response = await createNode({ parentId: arcId, name: 'Chapter Two', deleted: true })
      expect(response.statusCode).toBe(400)
      expect(response.json().error).toContain('can only be set when updating an existing node')
    })

    test('validates enum-like values', async () => {
      const response = await createNode({ parentId: chapterId, name: 'Riverbank', perspective: 'FOURTH' })
      expect(response.statusCode).toBe(400)
      expect(response.json().error).toContain('perspective must be FIRST, SECOND or THIRD')
    })

    test('accepts scene fields on a scene', async () => {
      const response = await createNode({
        parentId: chapterId,
        name: 'Riverbank',
        perspective: 'third',
        goal: 'cross unseen',
        includeInFull: 2,
      })
      expect(response.statusCode).toBe(201)
      expect(response.json().node.kind).toBe('scene')
    })

    test('requires a name', async () => {
      const response = await createNode({ parentId: arcId })
      expect(response.statusCode).toBe(400)
    })

    test('requires a parentId', async () => {
      const response = await createNode({ name: 'Orphan' })
      expect(response.statusCode).toBe(400)
    })
  })

  describe('POST /my/nodes — auth and ownership', () => {
    test('returns 401 without a session', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/my/nodes',
        payload: { parentId: arcId, name: 'Chapter Two' },
      })
      expect(response.statusCode).toBe(401)
    })

    test('returns 404 for a non-existent parent', async () => {
      const response = await createNode({ parentId: 'does-not-exist', name: 'Chapter Two' })
      expect(response.statusCode).toBe(404)
    })

    test("returns 404 for another user's parent", async () => {
      const other = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'other@example.com', username: 'otheruser', password: 'password123' },
      })
      const otherCookie = other.cookies[0]

      const response = await app.inject({
        method: 'POST',
        url: '/my/nodes',
        cookies: { [otherCookie.name]: otherCookie.value },
        payload: { parentId: arcId, name: 'Sneaky Chapter' },
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('POST /my/nodes — positioning', () => {
    test('appends by default', async () => {
      const second = await createNode({ parentId: arcId, name: 'Chapter Two' })
      expect(second.json().node.sortOrder).toBe(1)
    })

    test('honours position: start and renumbers siblings', async () => {
      const first = await createNode({ parentId: arcId, name: 'Chapter Two', position: 'start' })
      expect(first.json().node.sortOrder).toBe(0)

      const outline = await app.inject({
        method: 'GET',
        url: `/my/stories/${storyId}/outline`,
        cookies: auth(),
      })
      const chapters = outline.json().nodes.filter((node: { kind: string }) => node.kind === 'chapter')
      expect(chapters.map((c: { name: string }) => c.name)).toEqual(['Chapter Two', 'Test Chapter'])
      expect(chapters.map((c: { sortOrder: number }) => c.sortOrder)).toEqual([0, 1])
    })

    test('clamps an out-of-range index rather than erroring', async () => {
      const response = await createNode({ parentId: arcId, name: 'Chapter Two', position: 99 })
      expect(response.statusCode).toBe(201)
      expect(response.json().node.sortOrder).toBe(1)
    })
  })

  describe('PATCH /my/nodes/:id', () => {
    test('updates fields on any kind without being told the kind', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/nodes/${chapterId}`,
        cookies: auth(),
        payload: { name: 'Renamed Chapter', summary: 'They cross the river.' },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().node).toMatchObject({ kind: 'chapter', name: 'Renamed Chapter' })
    })

    test('soft-deletes and restores', async () => {
      const deleteResponse = await app.inject({
        method: 'PATCH',
        url: `/my/nodes/${chapterId}`,
        cookies: auth(),
        payload: { deleted: true },
      })
      expect(deleteResponse.statusCode).toBe(200)

      const outline = await app.inject({
        method: 'GET',
        url: `/my/stories/${storyId}/outline`,
        cookies: auth(),
      })
      expect(outline.json().nodes.some((node: { id: string }) => node.id === chapterId)).toBe(false)

      const restoreResponse = await app.inject({
        method: 'PATCH',
        url: `/my/nodes/${chapterId}`,
        cookies: auth(),
        payload: { deleted: false },
      })
      expect(restoreResponse.statusCode).toBe(200)

      const after = await app.inject({
        method: 'GET',
        url: `/my/stories/${storyId}/outline`,
        cookies: auth(),
      })
      expect(after.json().nodes.some((node: { id: string }) => node.id === chapterId)).toBe(true)
    })

    test('rejects a field from another kind, naming the node kind', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/nodes/${chapterId}`,
        cookies: auth(),
        payload: { perspective: 'THIRD' },
      })

      expect(response.statusCode).toBe(400)
      expect(response.json().error).toContain('"perspective" is only valid on scene nodes')
      expect(response.json().error).toContain('This node is a chapter')
    })

    test('rejects an empty patch and lists what it could have taken', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/nodes/${chapterId}`,
        cookies: auth(),
        payload: {},
      })

      expect(response.statusCode).toBe(400)
      expect(response.json().error).toContain('Nothing to update')
      expect(response.json().error).toContain('Valid fields for a chapter')
    })

    test('returns 404 for an unknown node', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/my/nodes/does-not-exist',
        cookies: auth(),
        payload: { name: 'Nope' },
      })
      expect(response.statusCode).toBe(404)
    })

    test('returns 401 without a session', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/nodes/${chapterId}`,
        payload: { name: 'Nope' },
      })
      expect(response.statusCode).toBe(401)
    })
  })

  describe('POST /my/nodes/:id/move', () => {
    test('reorders among siblings and keeps sortOrder contiguous', async () => {
      await createNode({ parentId: arcId, name: 'Chapter Two' })
      const third = await createNode({ parentId: arcId, name: 'Chapter Three' })

      const response = await app.inject({
        method: 'POST',
        url: `/my/nodes/${third.json().node.id}/move`,
        cookies: auth(),
        payload: { position: 0 },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().node.sortOrder).toBe(0)

      const outline = await app.inject({
        method: 'GET',
        url: `/my/stories/${storyId}/outline`,
        cookies: auth(),
      })
      const chapters = outline.json().nodes.filter((node: { kind: string }) => node.kind === 'chapter')
      expect(chapters.map((c: { name: string }) => c.name)).toEqual(['Chapter Three', 'Test Chapter', 'Chapter Two'])
      expect(chapters.map((c: { sortOrder: number }) => c.sortOrder)).toEqual([0, 1, 2])
    })

    test('reparents into another container of the same kind', async () => {
      const otherArc = await createNode({ parentId: bookId, name: 'Arc Two' })

      const response = await app.inject({
        method: 'POST',
        url: `/my/nodes/${chapterId}/move`,
        cookies: auth(),
        payload: { parentId: otherArc.json().node.id },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().node.parentId).toBe(otherArc.json().node.id)
    })

    test('refuses a parent that holds a different kind', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/nodes/${chapterId}/move`,
        cookies: auth(),
        payload: { parentId: bookId },
      })

      expect(response.statusCode).toBe(400)
      expect(response.json().error).toContain('which contains arcs, not chapters')
    })

    test('returns 404 for an unknown node', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/my/nodes/does-not-exist/move',
        cookies: auth(),
        payload: { position: 0 },
      })
      expect(response.statusCode).toBe(404)
    })
  })

  describe('GET /my/nodes/:id/content', () => {
    let sceneId: string

    beforeEach(async () => {
      const scene = await createNode({ parentId: chapterId, name: 'Riverbank' })
      sceneId = scene.json().node.id

      await app.inject({
        method: 'POST',
        url: '/my/prose/edits',
        cookies: auth(),
        payload: {
          edits: [
            {
              op: 'append',
              sceneId,
              text: 'The river ran black under the bridge.\n\nMara counted the guards twice, and twice came up wrong.',
            },
          ],
        },
      })
    })

    test('reads a chapter with paragraph ids attached', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/nodes/${chapterId}/content`,
        cookies: auth(),
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.root).toMatchObject({ kind: 'chapter', id: chapterId })
      expect(body.chapters).toHaveLength(1)
      expect(body.chapters[0].scenes[0].id).toBe(sceneId)

      const paragraphs = body.chapters[0].scenes[0].messages[0].paragraphs
      expect(paragraphs).toHaveLength(2)
      expect(paragraphs[0].id).toBeTruthy()
      expect(paragraphs[0].body).toBe('The river ran black under the bridge.')
      expect(body.words).toBeGreaterThan(0)
    })

    test('reads a single scene with its editable current revision state', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/nodes/${sceneId}/content?includeAllMessages=true`,
        cookies: auth(),
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.root).toMatchObject({ kind: 'scene', id: sceneId })
      const message = body.chapters[0].scenes[0].messages[0]
      expect(message).toMatchObject({
        sortOrder: 0,
        currentMessageRevisionId: expect.any(String),
        revision: { id: expect.any(String) },
      })
      expect(message.paragraphs[0]).toMatchObject({
        messageRevisionId: message.currentMessageRevisionId,
        sortOrder: 0,
        currentParagraphRevisionId: expect.any(String),
        contentSchema: null,
        plotPointActions: [],
        inventoryActions: [],
      })
    })

    test('refuses a read over maxWords with a per-chapter breakdown', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/nodes/${chapterId}/content?maxWords=1`,
        cookies: auth(),
      })

      expect(response.statusCode).toBe(413)
      const { error } = response.json()
      expect(error).toContain('over the 1-word limit')
      expect(error).toContain('Chapters:')
      expect(error).toContain(chapterId)
    })

    test('refuses to read a whole story', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/nodes/${storyId}/content`,
        cookies: auth(),
      })

      expect(response.statusCode).toBe(400)
      expect(response.json().error).toContain('Use the outline')
    })

    test('returns 404 for an unknown node', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/my/nodes/does-not-exist/content',
        cookies: auth(),
      })
      expect(response.statusCode).toBe(404)
    })

    test('returns 401 without a session', async () => {
      const response = await app.inject({ method: 'GET', url: `/my/nodes/${chapterId}/content` })
      expect(response.statusCode).toBe(401)
    })
  })
})

/**
 * Behaviour the per-kind routes gained by delegating to the node service.
 * Kept separate from the /my/nodes suite because it is about the older
 * endpoints, which now share one implementation with the newer ones.
 */
describe('Per-kind routes delegating to the node service', () => {
  let app: FastifyInstance
  let sessionCookie: { name: string; value: string }
  let storyId: string
  let bookId: string
  let arcId: string
  let chapterId: string

  const auth = () => ({ [sessionCookie.name]: sessionCookie.value })

  beforeEach(async () => {
    app = await buildApp()
    await cleanDatabase()

    const registerResponse = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'perkind@example.com', username: 'perkinduser', password: 'password123' },
    })
    sessionCookie = registerResponse.cookies[0]

    storyId = (
      await app.inject({ method: 'POST', url: '/my/stories', cookies: auth(), payload: { name: 'Test Story' } })
    ).json().story.id
    bookId = (
      await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/books`,
        cookies: auth(),
        payload: { name: 'Test Book' },
      })
    ).json().book.id
    arcId = (
      await app.inject({
        method: 'POST',
        url: `/my/books/${bookId}/arcs`,
        cookies: auth(),
        payload: { name: 'Test Arc' },
      })
    ).json().arc.id
    chapterId = (
      await app.inject({
        method: 'POST',
        url: `/my/arcs/${arcId}/chapters`,
        cookies: auth(),
        payload: { name: 'Test Chapter' },
      })
    ).json().chapter.id
  })

  afterEach(async () => {
    await app.close()
  })

  test('chapter create honours status, which the old inline handler dropped', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/my/arcs/${arcId}/chapters`,
      cookies: auth(),
      payload: { name: 'Chapter Two', status: 'needs_work' },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json().chapter.status).toBe('needs_work')
  })

  test('scene create honours status, which the old inline handler dropped', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/my/chapters/${chapterId}/scenes`,
      cookies: auth(),
      payload: { name: 'Riverbank', status: 'review' },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json().scene.status).toBe('review')
  })

  test('explicit sortOrder is still honoured on create', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/my/arcs/${arcId}/chapters`,
      cookies: auth(),
      payload: { name: 'Chapter Two', sortOrder: 7 },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json().chapter.sortOrder).toBe(7)
  })

  test('scene defaults includeInFull to full content', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/my/chapters/${chapterId}/scenes`,
      cookies: auth(),
      payload: { name: 'Riverbank' },
    })
    expect(response.json().scene.includeInFull).toBe(2)
  })

  test('a parent of the wrong kind is a 404 explaining what it actually is', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/my/stories/${bookId}/books`,
      cookies: auth(),
      payload: { name: 'Nope' },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json().error).toContain('Expected a parent containing books')
    expect(response.json().error).toContain('is a book')
  })

  test('a parent that does not exist keeps the per-kind 404 message', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/my/stories/does-not-exist/books',
      cookies: auth(),
      payload: { name: 'Nope' },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json().error).toBe('Story not found')
  })

  test('patching a chapter through the books route is a 404, not a silent write', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/my/books/${chapterId}`,
      cookies: auth(),
      payload: { name: 'Wrong kind' },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json().error).toContain('but it is a chapter')
  })

  test('trusted fields stay rejected on the derived-kind surface', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/my/nodes/${chapterId}`,
      cookies: auth(),
      payload: { royalRoadId: 12345 },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().error).toContain('"royalRoadId" is not a node field')
  })

  test('but are accepted through the chapter route', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/my/chapters/${chapterId}`,
      cookies: auth(),
      payload: { royalRoadId: 12345, publishedOn: '2026-01-02T03:04:05.000Z' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().chapter.royalRoadId).toBe(12345)
    expect(response.json().chapter.publishedOn).toBe('2026-01-02T03:04:05.000Z')
  })
})
