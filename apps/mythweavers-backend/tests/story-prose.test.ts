/**
 * Integration tests for POST /my/prose/edits.
 *
 * Two properties matter more than the individual ops: the batch is atomic (a
 * failing edit leaves nothing behind), and `expect` on replace turns a
 * concurrent overwrite into a 409 instead of silent data loss. Both are
 * asserted directly.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { buildApp, cleanDatabase } from './helpers.js'

describe('POST /my/prose/edits', () => {
  let app: FastifyInstance
  let sessionCookie: { name: string; value: string }
  let storyId: string
  let chapterId: string
  let sceneId: string

  const auth = () => ({ [sessionCookie.name]: sessionCookie.value })

  const createNode = (payload: Record<string, unknown>) =>
    app.inject({ method: 'POST', url: '/my/nodes', cookies: auth(), payload })

  const edit = (edits: unknown[]) =>
    app.inject({ method: 'POST', url: '/my/prose/edits', cookies: auth(), payload: { edits } })

  /** Paragraph ids in scene order, as an agent would get them from a read. */
  const readParagraphs = async (): Promise<Array<{ id: string; body: string }>> => {
    const response = await app.inject({
      method: 'GET',
      url: `/my/nodes/${sceneId}/content`,
      cookies: auth(),
    })
    return response
      .json()
      .chapters.flatMap((chapter: { scenes: Array<{ messages: Array<{ paragraphs: unknown[] }> }> }) =>
        chapter.scenes.flatMap((scene) => scene.messages.flatMap((message) => message.paragraphs)),
      ) as Array<{ id: string; body: string }>
  }

  beforeEach(async () => {
    app = await buildApp()
    await cleanDatabase()

    const registerResponse = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'prose@example.com', username: 'proseuser', password: 'password123' },
    })
    sessionCookie = registerResponse.cookies[0]

    const storyResponse = await app.inject({
      method: 'POST',
      url: '/my/stories',
      cookies: auth(),
      payload: { name: 'Test Story' },
    })
    storyId = storyResponse.json().story.id

    const bookId = (await createNode({ parentId: storyId, name: 'Book One' })).json().node.id
    const arcId = (await createNode({ parentId: bookId, name: 'Arc One' })).json().node.id
    chapterId = (await createNode({ parentId: arcId, name: 'The Crossing' })).json().node.id
    sceneId = (await createNode({ parentId: chapterId, name: 'Riverbank' })).json().node.id

    await edit([
      {
        op: 'append',
        sceneId,
        text: 'The river ran black under the bridge.\n\nMara counted the guards twice, and twice came up wrong.',
      },
    ])
  })

  afterEach(async () => {
    await app.close()
  })

  describe('append', () => {
    test('creates a message and splits text on blank lines', async () => {
      const paragraphs = await readParagraphs()
      expect(paragraphs).toHaveLength(2)
      expect(paragraphs[0].body).toBe('The river ran black under the bridge.')
      expect(paragraphs[1].body).toBe('Mara counted the guards twice, and twice came up wrong.')
    })

    test('reports what it created and which chapters were recounted', async () => {
      const response = await edit([{ op: 'append', sceneId, text: 'A third line.' }])

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body).toMatchObject({ success: true, applied: 1, updated: [], deleted: [] })
      expect(body.created).toHaveLength(1)
      expect(body.chaptersRecounted).toEqual([chapterId])
    })

    test('updates the cached chapter word count', async () => {
      const before = await app.inject({
        method: 'GET',
        url: `/my/stories/${storyId}/outline`,
        cookies: auth(),
      })
      const beforeWords = before.json().totalWords
      expect(beforeWords).toBeGreaterThan(0)

      await edit([{ op: 'append', sceneId, text: 'One two three four five six seven eight.' }])

      const after = await app.inject({
        method: 'GET',
        url: `/my/stories/${storyId}/outline`,
        cookies: auth(),
      })
      expect(after.json().totalWords).toBeGreaterThan(beforeWords)
    })

    test('returns 404 for a scene the caller does not own', async () => {
      const other = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'other-prose@example.com', username: 'otherprose', password: 'password123' },
      })
      const otherCookie = other.cookies[0]

      const response = await app.inject({
        method: 'POST',
        url: '/my/prose/edits',
        cookies: { [otherCookie.name]: otherCookie.value },
        payload: { edits: [{ op: 'append', sceneId, text: 'Sneaky.' }] },
      })

      expect(response.statusCode).toBe(404)
      expect(response.json().error).toContain('Edit 0 (append)')
    })
  })

  describe('replace', () => {
    test('replaces a paragraph in place and creates a revision', async () => {
      const [first] = await readParagraphs()

      const response = await edit([
        { op: 'replace', paragraphId: first.id, expect: 'The river ran black', text: 'The river ran clear.' },
      ])

      expect(response.statusCode).toBe(200)
      expect(response.json().updated).toEqual([first.id])

      const after = await readParagraphs()
      expect(after[0].id).toBe(first.id)
      expect(after[0].body).toBe('The river ran clear.')

      const revisions = await app.inject({
        method: 'GET',
        url: `/my/paragraphs/${first.id}/revisions`,
        cookies: auth(),
      })
      expect(revisions.statusCode).toBe(200)
      expect(revisions.json().revisions.length).toBeGreaterThan(1)
    })

    test('splitting text produces extra paragraphs after the original', async () => {
      const [first] = await readParagraphs()

      const response = await edit([
        {
          op: 'replace',
          paragraphId: first.id,
          expect: 'The river ran black',
          text: 'The river ran clear.\n\nAnd shallow.',
        },
      ])

      expect(response.json().created).toHaveLength(1)
      const after = await readParagraphs()
      expect(after.map((p) => p.body)).toEqual([
        'The river ran clear.',
        'And shallow.',
        'Mara counted the guards twice, and twice came up wrong.',
      ])
    })

    test('rejects with 409 when the paragraph changed since it was read', async () => {
      const [first] = await readParagraphs()

      const response = await edit([
        { op: 'replace', paragraphId: first.id, expect: 'A completely different opening', text: 'Nope.' },
      ])

      expect(response.statusCode).toBe(409)
      const { error } = response.json()
      expect(error).toContain('does not start with the expected text')
      expect(error).toContain('Re-read the scene and retry')

      const after = await readParagraphs()
      expect(after[0].body).toBe('The river ran black under the bridge.')
    })

    test('ignores markup differences when matching expect', async () => {
      const [first] = await readParagraphs()
      await edit([
        {
          op: 'replace',
          paragraphId: first.id,
          expect: 'The river ran black',
          text: 'The <em>river</em> ran black under the bridge.',
        },
      ])

      const response = await edit([
        { op: 'replace', paragraphId: first.id, expect: 'The river ran black', text: 'Rewritten.' },
      ])
      expect(response.statusCode).toBe(200)
    })

    test('rejects an expect too short to be a real guard', async () => {
      const [first] = await readParagraphs()

      const response = await edit([{ op: 'replace', paragraphId: first.id, expect: 'The', text: 'Nope.' }])

      expect(response.statusCode).toBe(400)
      expect(response.json().error).toContain('too short to be a meaningful guard')
    })

    test('rejects a replace with no expect at all', async () => {
      const [first] = await readParagraphs()

      const response = await edit([{ op: 'replace', paragraphId: first.id, text: 'Nope.' }])
      expect(response.statusCode).toBe(400)
    })
  })

  describe('insert and delete', () => {
    test('insert_after places text between existing paragraphs', async () => {
      const [first] = await readParagraphs()

      await edit([{ op: 'insert_after', paragraphId: first.id, text: 'A shape moved on the far bank.' }])

      const after = await readParagraphs()
      expect(after.map((p) => p.body)).toEqual([
        'The river ran black under the bridge.',
        'A shape moved on the far bank.',
        'Mara counted the guards twice, and twice came up wrong.',
      ])
    })

    test('insert_before places text ahead of the anchor', async () => {
      const [first] = await readParagraphs()

      await edit([{ op: 'insert_before', paragraphId: first.id, text: 'Night fell early.' }])

      const after = await readParagraphs()
      expect(after[0].body).toBe('Night fell early.')
      expect(after[1].body).toBe('The river ran black under the bridge.')
    })

    test('delete removes a paragraph', async () => {
      const [first] = await readParagraphs()

      const response = await edit([{ op: 'delete', paragraphId: first.id }])

      expect(response.statusCode).toBe(200)
      expect(response.json().deleted).toEqual([first.id])

      const after = await readParagraphs()
      expect(after).toHaveLength(1)
      expect(after[0].body).toBe('Mara counted the guards twice, and twice came up wrong.')
    })

    test('delete honours an optional expect guard', async () => {
      const [first] = await readParagraphs()

      const response = await edit([{ op: 'delete', paragraphId: first.id, expect: 'Something else entirely' }])

      expect(response.statusCode).toBe(409)
      expect(await readParagraphs()).toHaveLength(2)
    })
  })

  describe('batching', () => {
    test('applies several edits in order', async () => {
      const [first, second] = await readParagraphs()

      const response = await edit([
        { op: 'replace', paragraphId: first.id, expect: 'The river ran black', text: 'The river ran clear.' },
        { op: 'delete', paragraphId: second.id },
        { op: 'append', sceneId, text: 'She went anyway.' },
      ])

      expect(response.statusCode).toBe(200)
      expect(response.json().applied).toBe(3)

      const after = await readParagraphs()
      expect(after.map((p) => p.body)).toEqual(['The river ran clear.', 'She went anyway.'])
    })

    test('rolls back entirely when one edit in the batch fails', async () => {
      const [first, second] = await readParagraphs()

      const response = await edit([
        { op: 'replace', paragraphId: first.id, expect: 'The river ran black', text: 'The river ran clear.' },
        { op: 'replace', paragraphId: second.id, expect: 'Wrong expectation here', text: 'Should not land.' },
      ])

      expect(response.statusCode).toBe(409)
      expect(response.json().error).toContain('Edit 1')

      const after = await readParagraphs()
      expect(after.map((p) => p.body)).toEqual([
        'The river ran black under the bridge.',
        'Mara counted the guards twice, and twice came up wrong.',
      ])
    })

    test('rolls back when a later edit names a paragraph that does not exist', async () => {
      const [first] = await readParagraphs()

      const response = await edit([
        { op: 'replace', paragraphId: first.id, expect: 'The river ran black', text: 'The river ran clear.' },
        { op: 'delete', paragraphId: 'does-not-exist' },
      ])

      expect(response.statusCode).toBe(404)
      expect(response.json().error).toContain('Edit 1 (delete)')

      const after = await readParagraphs()
      expect(after[0].body).toBe('The river ran black under the bridge.')
    })
  })

  describe('validation and auth', () => {
    test('returns 400 for an empty edit list', async () => {
      const response = await edit([])
      expect(response.statusCode).toBe(400)
    })

    test('returns 400 for an unknown op', async () => {
      const response = await edit([{ op: 'obliterate', paragraphId: 'p1' }])
      expect(response.statusCode).toBe(400)
    })

    test('returns 400 for empty text', async () => {
      const response = await edit([{ op: 'append', sceneId, text: '' }])
      expect(response.statusCode).toBe(400)
    })

    test('returns 400 for whitespace-only text', async () => {
      const response = await edit([{ op: 'append', sceneId, text: '   \n\n  ' }])
      expect(response.statusCode).toBe(400)
    })

    test('returns 401 without a session', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/my/prose/edits',
        payload: { edits: [{ op: 'append', sceneId, text: 'Nope.' }] },
      })
      expect(response.statusCode).toBe(401)
    })
  })
})
