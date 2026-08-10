/**
 * End-to-end tests for POST /mcp.
 *
 * These drive the real JSON-RPC envelope through the Streamable HTTP transport
 * rather than calling the tool handlers directly, because the parts most likely
 * to break — auth, stateless transport setup, the Accept-header contract, and
 * the error-vs-exception distinction in the tool wrapper — only exist at that
 * layer.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../src/lib/prisma.js'
import { buildApp, cleanDatabase } from './helpers.js'

describe('MCP endpoint', () => {
  let app: FastifyInstance
  let sessionCookie: { name: string; value: string }
  let token: string
  let storyId: string
  let chapterId: string
  let sceneId: string

  const auth = () => ({ [sessionCookie.name]: sessionCookie.value })

  const createNode = (payload: Record<string, unknown>) =>
    app.inject({ method: 'POST', url: '/my/nodes', cookies: auth(), payload })

  /** One JSON-RPC request over the Streamable HTTP transport. */
  const rpc = async (method: string, params?: unknown, bearer: string | null = token) => {
    const response = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        'content-type': 'application/json',
        // The transport rejects a POST that doesn't accept both.
        accept: 'application/json, text/event-stream',
        ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
      },
      payload: { jsonrpc: '2.0', id: 1, method, ...(params ? { params } : {}) },
    })
    return response
  }

  /** Call a tool and return the flattened text plus the isError flag. */
  const callTool = async (name: string, args: Record<string, unknown> = {}) => {
    const response = await rpc('tools/call', { name, arguments: args })
    expect(response.statusCode).toBe(200)
    const result = response.json().result
    return {
      isError: result?.isError === true,
      text: (result?.content ?? []).map((part: { text?: string }) => part.text ?? '').join('\n'),
      raw: response.json(),
    }
  }

  beforeEach(async () => {
    app = await buildApp()
    await cleanDatabase()

    const registerResponse = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'mcp@example.com', username: 'mcpuser', password: 'password123' },
    })
    sessionCookie = registerResponse.cookies[0]
    const userId = registerResponse.json().user.id

    // The device flow mints these in production; creating one directly keeps
    // the test about MCP rather than about OAuth.
    token = `mw_${'a'.repeat(64)}`
    await prisma.accessToken.create({ data: { userId, token, name: 'Test MCP token' } })

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

  describe('transport and auth', () => {
    test('rejects an unauthenticated request', async () => {
      const response = await rpc('tools/list', undefined, null)
      expect(response.statusCode).toBe(401)
    })

    test('rejects an unknown bearer token', async () => {
      const response = await rpc('tools/list', undefined, `mw_${'b'.repeat(64)}`)
      expect(response.statusCode).toBe(401)
    })

    test('rejects a POST that does not accept text/event-stream', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/mcp',
        headers: { 'content-type': 'application/json', accept: 'application/json', authorization: `Bearer ${token}` },
        payload: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      })
      expect(response.statusCode).toBe(406)
    })

    test('answers initialize with server info and instructions', async () => {
      const response = await rpc('initialize', {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' },
      })

      expect(response.statusCode).toBe(200)
      const { result } = response.json()
      expect(result.serverInfo).toMatchObject({ name: 'mythweavers' })
      expect(result.instructions).toContain('story → books → arcs → chapters → scenes')
      expect(result.capabilities.tools).toBeDefined()
    })

    test('refuses GET and DELETE, which stateless mode cannot serve', async () => {
      for (const method of ['GET', 'DELETE'] as const) {
        const response = await app.inject({
          method,
          url: '/mcp',
          headers: { authorization: `Bearer ${token}` },
        })
        expect(response.statusCode).toBe(405)
        expect(response.json().error.message).toContain('stateless')
      }
    })
  })

  describe('tools/list', () => {
    test('advertises exactly the six story tools', async () => {
      const response = await rpc('tools/list')

      expect(response.statusCode).toBe(200)
      const names = response.json().result.tools.map((tool: { name: string }) => tool.name)
      expect(names.sort()).toEqual(['mw_entity', 'mw_node', 'mw_outline', 'mw_prose', 'mw_read', 'mw_search'])
    })

    test('each tool carries a description and a JSON schema', async () => {
      const { tools } = (await rpc('tools/list')).json().result
      for (const tool of tools) {
        expect(typeof tool.description).toBe('string')
        expect(tool.inputSchema.type).toBe('object')
      }
    })
  })

  describe('mw_outline', () => {
    test('lists stories when called with no arguments', async () => {
      const { isError, text } = await callTool('mw_outline')
      expect(isError).toBe(false)
      expect(text).toContain(`[story:${storyId}] Test Story`)
    })

    test('renders the tree with [kind:id] tags', async () => {
      const { text } = await callTool('mw_outline', { storyId })
      expect(text).toContain(`[chapter:${chapterId}] The Crossing`)
      expect(text).toContain('1 book, 1 arc, 1 chapter')
    })

    test('includes scenes at depth=scene', async () => {
      const { text } = await callTool('mw_outline', { storyId, depth: 'scene' })
      expect(text).toContain(`[scene:${sceneId}] Riverbank`)
    })

    test('reports a missing story as a tool error, not a crash', async () => {
      const { isError, text } = await callTool('mw_outline', { storyId: 'does-not-exist' })
      expect(isError).toBe(true)
      expect(text.length).toBeGreaterThan(0)
    })
  })

  describe('mw_read', () => {
    test('returns prose with paragraph ids attached', async () => {
      const { isError, text } = await callTool('mw_read', { nodeId: chapterId })
      expect(isError).toBe(false)
      expect(text).toMatch(/\[p:[^\]]+\] The river ran black/)
      expect(text).toContain(`[scene:${sceneId}]`)
    })

    test('refuses an oversized read with a breakdown', async () => {
      const { isError, text } = await callTool('mw_read', { nodeId: chapterId, maxWords: 1 })
      expect(isError).toBe(true)
      expect(text).toContain('over the 1-word limit')
      expect(text).toContain('Chapters:')
    })
  })

  describe('mw_search', () => {
    test('finds prose and names where it lives', async () => {
      const { isError, text } = await callTool('mw_search', { storyId, query: 'amulet', scope: 'prose' })
      expect(isError).toBe(false)
      expect(text).toContain('1 match for "amulet"')
      expect(text).toContain('The Crossing › Riverbank')
    })

    test('says so plainly when nothing matches', async () => {
      const { text } = await callTool('mw_search', { storyId, query: 'zzzznothing' })
      expect(text).toContain('No matches')
    })
  })

  describe('mw_node', () => {
    test('creates a node whose kind comes from the parent', async () => {
      const { isError, text } = await callTool('mw_node', { parentId: chapterId, name: 'Second Scene' })
      expect(isError).toBe(false)
      expect(text).toContain('Created scene "Second Scene"')
    })

    test('returns the per-kind field error as a tool error', async () => {
      const { isError, text } = await callTool('mw_node', {
        parentId: (await createNode({ parentId: storyId, name: 'Book Two' })).json().node.id,
        name: 'Arc Two',
        perspective: 'THIRD',
      })

      expect(isError).toBe(true)
      expect(text).toContain('"perspective" is only valid on scene nodes')
      expect(text).toContain('Valid fields for an arc:')
    })

    test('refuses both parentId and nodeId', async () => {
      const { isError, text } = await callTool('mw_node', { parentId: chapterId, nodeId: sceneId, name: 'Nope' })
      expect(isError).toBe(true)
      expect(text).toContain('not both')
    })

    test('refuses neither parentId nor nodeId', async () => {
      const { isError, text } = await callTool('mw_node', { name: 'Nope' })
      expect(isError).toBe(true)
      expect(text).toContain('Pass parentId to create a node')
    })

    test('updates an existing node', async () => {
      const { isError, text } = await callTool('mw_node', { nodeId: chapterId, name: 'The Fording' })
      expect(isError).toBe(false)
      expect(text).toContain('Updated chapter "The Fording"')
    })

    test('soft-deletes and explains how to restore', async () => {
      const { text } = await callTool('mw_node', { nodeId: sceneId, deleted: true })
      expect(text).toContain('Soft-deleted scene')
      expect(text).toContain('Set deleted:false to restore')

      const outline = await callTool('mw_outline', { storyId, depth: 'scene' })
      expect(outline.text).not.toContain(`[scene:${sceneId}]`)
    })

    test('moves a node to a new parent', async () => {
      const bookTwo = (await createNode({ parentId: storyId, name: 'Book Two' })).json().node.id
      const arcTwo = (await createNode({ parentId: bookTwo, name: 'Arc Two' })).json().node.id

      const { isError, text } = await callTool('mw_node', { nodeId: chapterId, moveToParentId: arcTwo })
      expect(isError).toBe(false)
      expect(text).toContain('Moved chapter')
    })
  })

  describe('mw_prose', () => {
    const paragraphIdFromRead = async (): Promise<string> => {
      const { text } = await callTool('mw_read', { nodeId: sceneId })
      const match = text.match(/\[p:([^\]]+)\]/)
      expect(match).toBeTruthy()
      return match![1]
    }

    test('replaces a paragraph the caller has read', async () => {
      const paragraphId = await paragraphIdFromRead()

      const { isError, text } = await callTool('mw_prose', {
        edits: [
          { op: 'replace', paragraphId, expect: 'The river ran black', text: 'The river ran clear, and she waded in.' },
        ],
      })

      expect(isError).toBe(false)
      expect(text).toContain('Applied 1 edit.')
      expect(text).toContain(`Revised: ${paragraphId}`)

      const after = await callTool('mw_read', { nodeId: sceneId })
      expect(after.text).toContain('The river ran clear, and she waded in.')
    })

    test('rejects a stale replace rather than overwriting it', async () => {
      const paragraphId = await paragraphIdFromRead()

      const { isError, text } = await callTool('mw_prose', {
        edits: [{ op: 'replace', paragraphId, expect: 'Something else entirely', text: 'Should not land.' }],
      })

      expect(isError).toBe(true)
      expect(text).toContain('changed since you read it')

      const after = await callTool('mw_read', { nodeId: sceneId })
      expect(after.text).toContain('The river ran black under the bridge')
    })

    test('applies nothing when one edit in a batch fails', async () => {
      const paragraphId = await paragraphIdFromRead()

      const { isError } = await callTool('mw_prose', {
        edits: [
          { op: 'replace', paragraphId, expect: 'The river ran black', text: 'Rewritten.' },
          { op: 'delete', paragraphId: 'does-not-exist' },
        ],
      })

      expect(isError).toBe(true)
      const after = await callTool('mw_read', { nodeId: sceneId })
      expect(after.text).toContain('The river ran black under the bridge')
      expect(after.text).not.toContain('Rewritten.')
    })

    test('appends new prose to a scene', async () => {
      const { isError, text } = await callTool('mw_prose', {
        edits: [{ op: 'append', sceneId, text: 'She went anyway.\n\nThe bridge held.' }],
      })

      expect(isError).toBe(false)
      expect(text).toContain('Applied 1 edit.')

      const after = await callTool('mw_read', { nodeId: sceneId })
      expect(after.text).toContain('She went anyway.')
      expect(after.text).toContain('The bridge held.')
    })
  })

  describe('mw_entity', () => {
    test('creates a character', async () => {
      const { isError, text } = await callTool('mw_entity', {
        storyId,
        kind: 'character',
        firstName: 'Mara',
        lastName: 'Vane',
        description: 'A smuggler who guards the amulet.',
      })

      expect(isError).toBe(false)
      expect(text).toContain('Created character "Mara Vane"')
    })

    test('creates a context item', async () => {
      const { isError, text } = await callTool('mw_entity', {
        storyId,
        kind: 'contextItem',
        type: 'plot',
        name: 'The Amulet',
        description: 'It burns when danger is near.',
      })

      expect(isError).toBe(false)
      expect(text).toContain('Created contextItem "The Amulet"')
    })

    test('lists both kinds with their ids', async () => {
      await callTool('mw_entity', { storyId, kind: 'character', firstName: 'Mara', description: 'A smuggler.' })
      await callTool('mw_entity', {
        storyId,
        kind: 'contextItem',
        type: 'plot',
        name: 'The Amulet',
        description: 'It burns.',
      })

      const { text } = await callTool('mw_entity', { storyId, list: true })
      expect(text).toContain('Characters:')
      expect(text).toMatch(/\[character:[^\]]+\] Mara/)
      expect(text).toContain('Context items:')
      expect(text).toMatch(/\[contextItem:[^\]]+\] The Amulet/)
    })

    test('updates an existing entity by id', async () => {
      const created = await callTool('mw_entity', {
        storyId,
        kind: 'character',
        firstName: 'Mara',
        description: 'A smuggler.',
      })
      const id = created.text.match(/\[character:([^\]]+)\]/)![1]

      const { isError, text } = await callTool('mw_entity', {
        storyId,
        kind: 'character',
        id,
        description: 'A smuggler who has stopped running.',
      })

      expect(isError).toBe(false)
      expect(text).toContain('Updated character')
    })

    test('requires a kind unless listing', async () => {
      const { isError, text } = await callTool('mw_entity', { storyId, firstName: 'Nameless' })
      expect(isError).toBe(true)
      expect(text).toContain('kind is required')
    })

    test('deletes an entity by id', async () => {
      const created = await callTool('mw_entity', {
        storyId,
        kind: 'contextItem',
        type: 'theme',
        name: 'Debt',
        description: 'Everyone owes someone.',
      })
      const id = created.text.match(/\[contextItem:([^\]]+)\]/)![1]

      const { isError, text } = await callTool('mw_entity', { storyId, kind: 'contextItem', id, delete: true })
      expect(isError).toBe(false)
      expect(text).toContain('Deleted contextItem "Debt"')

      const list = await callTool('mw_entity', { storyId, list: true })
      expect(list.text).not.toContain('Debt')
    })
  })

  describe('isolation between users', () => {
    test("one user's token cannot reach another user's story", async () => {
      const other = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'other-mcp@example.com', username: 'othermcp', password: 'password123' },
      })
      const otherToken = `mw_${'c'.repeat(64)}`
      await prisma.accessToken.create({
        data: { userId: other.json().user.id, token: otherToken, name: 'Other token' },
      })

      const response = await rpc('tools/call', { name: 'mw_outline', arguments: { storyId } }, otherToken)

      const result = response.json().result
      expect(result.isError).toBe(true)
    })
  })
})
