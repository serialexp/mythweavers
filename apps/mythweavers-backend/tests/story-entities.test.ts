/**
 * Service-level tests for characters and context items.
 *
 * These call the service directly rather than through HTTP, because the
 * behaviour under test is what the service guarantees to *every* caller — the
 * REST routes, the MCP tools, and anything added later. `mw_entity` happens not
 * to expose `laterVersionOfId` today, so a test driven through MCP would pass
 * whether or not the check existed.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { listEntities, upsertEntity } from '../src/services/story/index.js'
import { buildApp, cleanDatabase } from './helpers.js'

describe('Entity service', () => {
  let app: FastifyInstance
  let sessionCookie: { name: string; value: string }
  let userId: number
  let storyId: string
  let otherStoryId: string

  const auth = () => ({ [sessionCookie.name]: sessionCookie.value })

  beforeEach(async () => {
    app = await buildApp()
    await cleanDatabase()

    const registerResponse = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'entities@example.com', username: 'entitiesuser', password: 'password123' },
    })
    sessionCookie = registerResponse.cookies[0]
    userId = registerResponse.json().user.id

    const first = await app.inject({
      method: 'POST',
      url: '/my/stories',
      cookies: auth(),
      payload: { name: 'Test Story' },
    })
    storyId = first.json().story.id

    const second = await app.inject({
      method: 'POST',
      url: '/my/stories',
      cookies: auth(),
      payload: { name: 'Other Story' },
    })
    otherStoryId = second.json().story.id
  })

  afterEach(async () => {
    await app.close()
  })

  describe('laterVersionOfId', () => {
    test('accepts a previous version from the same story', async () => {
      const earlier = await upsertEntity(userId, { storyId, kind: 'character', firstName: 'Young Mara' })

      const later = await upsertEntity(userId, {
        storyId,
        kind: 'character',
        firstName: 'Mara',
        laterVersionOfId: earlier.id,
      })

      expect(later.created).toBe(true)
    })

    test('refuses a character from a different story', async () => {
      const foreign = await upsertEntity(userId, {
        storyId: otherStoryId,
        kind: 'character',
        firstName: 'Elsewhere',
      })

      // The foreign key alone would accept this: any Character row satisfies
      // it, including one in another user's story.
      expect(
        upsertEntity(userId, {
          storyId,
          kind: 'character',
          firstName: 'Mara',
          laterVersionOfId: foreign.id,
        }),
      ).rejects.toThrow('Previous character version not found in this story')
    })

    test('refuses an id that does not exist at all', async () => {
      expect(
        upsertEntity(userId, {
          storyId,
          kind: 'character',
          firstName: 'Mara',
          laterVersionOfId: 'does-not-exist',
        }),
      ).rejects.toThrow('Previous character version not found in this story')
    })

    test('is also enforced on update', async () => {
      const foreign = await upsertEntity(userId, {
        storyId: otherStoryId,
        kind: 'character',
        firstName: 'Elsewhere',
      })
      const mara = await upsertEntity(userId, { storyId, kind: 'character', firstName: 'Mara' })

      expect(
        upsertEntity(userId, {
          storyId,
          kind: 'character',
          id: mara.id,
          laterVersionOfId: foreign.id,
        }),
      ).rejects.toThrow('Previous character version not found in this story')
    })

    test('allows clearing it', async () => {
      const earlier = await upsertEntity(userId, { storyId, kind: 'character', firstName: 'Young Mara' })
      const mara = await upsertEntity(userId, {
        storyId,
        kind: 'character',
        firstName: 'Mara',
        laterVersionOfId: earlier.id,
      })

      const cleared = await upsertEntity(userId, {
        storyId,
        kind: 'character',
        id: mara.id,
        laterVersionOfId: null,
      })
      expect(cleared.created).toBe(false)
    })
  })

  describe('scoping', () => {
    test('refuses to write into a story the caller does not own', async () => {
      const other = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'other-entities@example.com', username: 'otherentities', password: 'password123' },
      })

      expect(upsertEntity(other.json().user.id, { storyId, kind: 'character', firstName: 'Sneaky' })).rejects.toThrow(
        `No story found with id "${storyId}".`,
      )
    })

    test('listing is scoped to one story', async () => {
      await upsertEntity(userId, { storyId, kind: 'character', firstName: 'Mara' })
      await upsertEntity(userId, { storyId: otherStoryId, kind: 'character', firstName: 'Elsewhere' })

      const listed = await listEntities(userId, storyId)
      expect(listed.characters.map((character) => character.firstName)).toEqual(['Mara'])
    })

    test('rejects a field belonging to the other kind, and says where it belongs', async () => {
      expect(upsertEntity(userId, { storyId, kind: 'character', firstName: 'Mara', isGlobal: true })).rejects.toThrow(
        'belong(s) to contextItem',
      )
    })

    test('requires firstName when creating a character', async () => {
      expect(upsertEntity(userId, { storyId, kind: 'character', description: 'No name' })).rejects.toThrow(
        'firstName is required',
      )
    })

    test('requires type, name and description when creating a context item', async () => {
      expect(upsertEntity(userId, { storyId, kind: 'contextItem', name: 'The Amulet' })).rejects.toThrow(
        'description is required',
      )
    })
  })
})
