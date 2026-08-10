/**
 * Integration tests for GET /my/stories/:storyId/outline and .../search.
 *
 * These are the two reads that make the story navigable without pulling every
 * paragraph body, so the assertions are about shape and scoping: the outline
 * must flatten correctly and respect depth, and search must only ever return
 * current revisions of live content from a story the caller owns.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { buildApp, cleanDatabase } from './helpers.js'

describe('Outline and search endpoints', () => {
  let app: FastifyInstance
  let sessionCookie: { name: string; value: string }
  let storyId: string
  let bookId: string
  let arcId: string
  let chapterId: string
  let sceneId: string

  const auth = () => ({ [sessionCookie.name]: sessionCookie.value })

  const createNode = (payload: Record<string, unknown>) =>
    app.inject({ method: 'POST', url: '/my/nodes', cookies: auth(), payload })

  beforeEach(async () => {
    app = await buildApp()
    await cleanDatabase()

    const registerResponse = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'outline@example.com', username: 'outlineuser', password: 'password123' },
    })
    sessionCookie = registerResponse.cookies[0]

    const storyResponse = await app.inject({
      method: 'POST',
      url: '/my/stories',
      cookies: auth(),
      payload: { name: 'Test Story' },
    })
    storyId = storyResponse.json().story.id

    bookId = (await createNode({ parentId: storyId, name: 'Book One' })).json().node.id
    arcId = (await createNode({ parentId: bookId, name: 'Arc One' })).json().node.id
    chapterId = (await createNode({ parentId: arcId, name: 'The Crossing', summary: 'They cross the river.' })).json()
      .node.id
    sceneId = (await createNode({ parentId: chapterId, name: 'Riverbank', perspective: 'THIRD' })).json().node.id

    await app.inject({
      method: 'POST',
      url: '/my/prose/edits',
      cookies: auth(),
      payload: {
        edits: [
          {
            op: 'append',
            sceneId,
            text: 'The river ran black under the bridge, and the amulet burned at her throat.',
          },
        ],
      },
    })
  })

  afterEach(async () => {
    await app.close()
  })

  const outline = (query = '') =>
    app.inject({ method: 'GET', url: `/my/stories/${storyId}/outline${query}`, cookies: auth() })

  const search = (query: string) =>
    app.inject({ method: 'GET', url: `/my/stories/${storyId}/search?${query}`, cookies: auth() })

  describe('GET /my/stories/:storyId/outline', () => {
    test('returns a depth-first flattening with parentId and depth', async () => {
      const response = await outline()

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body).toMatchObject({
        storyId,
        storyName: 'Test Story',
        depth: 'chapter',
        root: { kind: 'story', id: storyId },
      })

      expect(body.nodes.map((node: { id: string }) => node.id)).toEqual([bookId, arcId, chapterId])
      expect(body.nodes.map((node: { depth: number }) => node.depth)).toEqual([0, 1, 2])
      expect(body.nodes.map((node: { parentId: string | null }) => node.parentId)).toEqual([null, bookId, arcId])
    })

    test('stops at chapters by default', async () => {
      const body = (await outline()).json()
      expect(body.nodes.some((node: { kind: string }) => node.kind === 'scene')).toBe(false)
      expect(body.counts).toMatchObject({ book: 1, arc: 1, chapter: 1, scene: 0 })
    })

    test('includes scenes when asked', async () => {
      const body = (await outline('?depth=scene')).json()
      const scene = body.nodes.find((node: { kind: string }) => node.kind === 'scene')
      expect(scene).toMatchObject({ id: sceneId, name: 'Riverbank', parentId: chapterId, depth: 3 })
      expect(body.counts.scene).toBe(1)
    })

    test('includes scene detail alongside depth=scene', async () => {
      const body = (await outline('?depth=scene&includeSceneDetail=true')).json()
      const scene = body.nodes.find((node: { kind: string }) => node.kind === 'scene')
      expect(scene.perspective).toBe('THIRD')
    })

    test('omits summaries unless requested', async () => {
      const without = (await outline()).json()
      const chapterWithout = without.nodes.find((node: { id: string }) => node.id === chapterId)
      expect(chapterWithout.summary).toBeUndefined()

      const withSummaries = (await outline('?includeSummaries=true')).json()
      const chapterWith = withSummaries.nodes.find((node: { id: string }) => node.id === chapterId)
      expect(chapterWith.summary).toBe('They cross the river.')
    })

    test('reports cached word counts and rolls them up', async () => {
      const body = (await outline()).json()
      const chapter = body.nodes.find((node: { id: string }) => node.id === chapterId)
      const book = body.nodes.find((node: { id: string }) => node.id === bookId)

      expect(chapter.wordCount).toBeGreaterThan(0)
      expect(book.wordCount).toBe(chapter.wordCount)
      expect(body.totalWords).toBe(chapter.wordCount)
    })

    test('scopes to a subtree with rootId', async () => {
      const otherBook = (await createNode({ parentId: storyId, name: 'Book Two' })).json().node.id

      const body = (await outline(`?rootId=${arcId}`)).json()
      expect(body.root).toMatchObject({ kind: 'arc', id: arcId })
      expect(body.nodes.map((node: { id: string }) => node.id)).toEqual([chapterId])
      expect(body.nodes.some((node: { id: string }) => node.id === otherBook)).toBe(false)
    })

    test('excludes soft-deleted nodes', async () => {
      await app.inject({
        method: 'PATCH',
        url: `/my/nodes/${chapterId}`,
        cookies: auth(),
        payload: { deleted: true },
      })

      const body = (await outline()).json()
      expect(body.nodes.some((node: { id: string }) => node.id === chapterId)).toBe(false)
      expect(body.counts.chapter).toBe(0)
    })

    test('returns an empty node list for an empty story', async () => {
      const emptyStory = await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: auth(),
        payload: { name: 'Empty Story' },
      })
      const response = await app.inject({
        method: 'GET',
        url: `/my/stories/${emptyStory.json().story.id}/outline`,
        cookies: auth(),
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().nodes).toEqual([])
      expect(response.json().totalWords).toBe(0)
    })

    test('returns 404 for a story the caller does not own', async () => {
      const other = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'other-outline@example.com', username: 'otheroutline', password: 'password123' },
      })
      const otherCookie = other.cookies[0]

      const response = await app.inject({
        method: 'GET',
        url: `/my/stories/${storyId}/outline`,
        cookies: { [otherCookie.name]: otherCookie.value },
      })
      expect(response.statusCode).toBe(404)
    })

    test('returns 401 without a session', async () => {
      const response = await app.inject({ method: 'GET', url: `/my/stories/${storyId}/outline` })
      expect(response.statusCode).toBe(401)
    })

    test('returns 400 for an unknown depth', async () => {
      const response = await outline('?depth=paragraph')
      expect(response.statusCode).toBe(400)
    })
  })

  describe('GET /my/stories/:storyId/search', () => {
    beforeEach(async () => {
      await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/characters`,
        cookies: auth(),
        payload: { firstName: 'Mara', description: 'A smuggler who guards the amulet.' },
      })
      await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/context-items`,
        cookies: auth(),
        payload: { type: 'plot', name: 'The Amulet', description: 'It burns when danger is near.' },
      })
    })

    test('finds prose and reports where it lives', async () => {
      const response = await search('q=amulet&scope=prose')

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.scope).toBe('prose')
      expect(body.hits).toHaveLength(1)
      expect(body.hits[0]).toMatchObject({
        kind: 'prose',
        sceneId,
        sceneName: 'Riverbank',
        chapterId,
        chapterName: 'The Crossing',
      })
      expect(body.hits[0].paragraphId).toBeTruthy()
      expect(body.hits[0].snippet.toLowerCase()).toContain('amulet')
    })

    test('is case-insensitive', async () => {
      const body = (await search('q=AMULET&scope=prose')).json()
      expect(body.hits).toHaveLength(1)
    })

    test('searches characters and context items', async () => {
      const characters = (await search('q=smuggler&scope=characters')).json()
      expect(characters.hits[0]).toMatchObject({ kind: 'character', name: 'Mara', field: 'description' })

      const context = (await search('q=burns&scope=context')).json()
      expect(context.hits[0]).toMatchObject({ kind: 'contextItem', name: 'The Amulet', type: 'plot' })
    })

    test('searches node summaries', async () => {
      const body = (await search('q=cross%20the%20river&scope=summaries')).json()
      expect(body.hits[0]).toMatchObject({ kind: 'summary', nodeKind: 'chapter', id: chapterId, field: 'summary' })
    })

    test('scope=all spans every source', async () => {
      const body = (await search('q=amulet&scope=all')).json()
      const kinds = new Set(body.hits.map((hit: { kind: string }) => hit.kind))
      expect(kinds.has('prose')).toBe(true)
      expect(kinds.has('character')).toBe(true)
      expect(kinds.has('contextItem')).toBe(true)
    })

    test('defaults to scope=all', async () => {
      const body = (await search('q=amulet')).json()
      expect(body.scope).toBe('all')
    })

    test('returns no hits rather than erroring when nothing matches', async () => {
      const body = (await search('q=zzzznothing')).json()
      expect(body.hits).toEqual([])
      expect(body.truncated).toBe(false)
    })

    test('only searches the current paragraph revision', async () => {
      const content = await app.inject({
        method: 'GET',
        url: `/my/nodes/${sceneId}/content`,
        cookies: auth(),
      })
      const paragraphId = content.json().chapters[0].scenes[0].messages[0].paragraphs[0].id

      await app.inject({
        method: 'POST',
        url: '/my/prose/edits',
        cookies: auth(),
        payload: {
          edits: [
            {
              op: 'replace',
              paragraphId,
              expect: 'The river ran black',
              text: 'The river ran clear, and the pendant was cold at her throat.',
            },
          ],
        },
      })

      const stale = (await search('q=amulet&scope=prose')).json()
      expect(stale.hits).toEqual([])

      const fresh = (await search('q=pendant&scope=prose')).json()
      expect(fresh.hits).toHaveLength(1)
    })

    test('respects limit and reports truncation', async () => {
      const body = (await search('q=amulet&scope=all&limit=1')).json()
      expect(body.truncated).toBe(true)
    })

    test('returns 400 for a query under two characters', async () => {
      const response = await search('q=a')
      expect(response.statusCode).toBe(400)
    })

    test('returns 400 when q is missing', async () => {
      const response = await search('scope=prose')
      expect(response.statusCode).toBe(400)
    })

    test('returns 401 without a session', async () => {
      const response = await app.inject({ method: 'GET', url: `/my/stories/${storyId}/search?q=amulet` })
      expect(response.statusCode).toBe(401)
    })

    test('returns 404 for a story the caller does not own', async () => {
      const other = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'other-search@example.com', username: 'othersearch', password: 'password123' },
      })
      const otherCookie = other.cookies[0]

      const response = await app.inject({
        method: 'GET',
        url: `/my/stories/${storyId}/search?q=amulet`,
        cookies: { [otherCookie.name]: otherCookie.value },
      })
      expect(response.statusCode).toBe(404)
    })
  })
})
