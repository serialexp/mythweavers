import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { buildApp, cleanDatabase } from './helpers.js'

let app: FastifyInstance
let sessionCookie: { name: string; value: string }
let _userId: number
let storyId: string
let characterId: string

beforeAll(async () => {
  app = await buildApp()
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(async () => {
  await cleanDatabase()

  // Register and login a user
  const registerResponse = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: {
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
    },
  })

  const body = registerResponse.json()
  _userId = body.user.id
  sessionCookie = registerResponse.cookies[0]

  // Create a test story
  const storyResponse = await app.inject({
    method: 'POST',
    url: '/my/stories',
    cookies: { [sessionCookie.name]: sessionCookie.value },
    payload: {
      name: 'Test Story',
    },
  })
  storyId = storyResponse.json().story.id

  // Create a test character
  const characterResponse = await app.inject({
    method: 'POST',
    url: `/my/stories/${storyId}/characters`,
    cookies: { [sessionCookie.name]: sessionCookie.value },
    payload: {
      firstName: 'Test',
      lastName: 'Character',
    },
  })
  characterId = characterResponse.json().character.id
})

describe('Character Inventory Endpoints', () => {
  describe('POST /my/characters/:characterId/inventory', () => {
    test('should add item to character inventory', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/characters/${characterId}/inventory`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          name: 'Magic Sword',
          description: 'A legendary blade',
          amount: 1,
        },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.item).toMatchObject({
        id: expect.any(String),
        characterId,
        name: 'Magic Sword',
        description: 'A legendary blade',
        amount: 1,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      })
    })

    test('should add item with minimal fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/characters/${characterId}/inventory`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          name: 'Simple Potion',
        },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.item.name).toBe('Simple Potion')
      expect(body.item.description).toBeNull()
      expect(body.item.amount).toBe(1)
    })

    test('should add item with custom amount', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/characters/${characterId}/inventory`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          name: 'Gold Coins',
          amount: 100,
        },
      })

      expect(response.statusCode).toBe(201)
      expect(response.json().item.amount).toBe(100)
    })

    test('should reject duplicate item name for same character', async () => {
      // Add first item
      await app.inject({
        method: 'POST',
        url: `/my/characters/${characterId}/inventory`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          name: 'Magic Sword',
        },
      })

      // Try to add duplicate
      const response = await app.inject({
        method: 'POST',
        url: `/my/characters/${characterId}/inventory`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          name: 'Magic Sword',
        },
      })

      expect(response.statusCode).toBe(409)
      expect(response.json().error).toContain('already exists')
    })

    test('should allow same item name for different characters', async () => {
      // Create another character
      const char2Response = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/characters`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          firstName: 'Other',
          lastName: 'Character',
        },
      })
      const characterId2 = char2Response.json().character.id

      // Add item to first character
      await app.inject({
        method: 'POST',
        url: `/my/characters/${characterId}/inventory`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          name: 'Magic Sword',
        },
      })

      // Add same item to second character (should succeed)
      const response = await app.inject({
        method: 'POST',
        url: `/my/characters/${characterId2}/inventory`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          name: 'Magic Sword',
        },
      })

      expect(response.statusCode).toBe(201)
    })

    test('should reject with empty name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/characters/${characterId}/inventory`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          name: '',
        },
      })

      expect(response.statusCode).toBe(400)
    })

    test('should reject without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/characters/${characterId}/inventory`,
        payload: {
          name: 'Magic Sword',
        },
      })

      expect(response.statusCode).toBe(401)
    })

    test('should reject for non-existent character', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/my/characters/nonexistent/inventory',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          name: 'Magic Sword',
        },
      })

      expect(response.statusCode).toBe(404)
    })

    test('should reject for other user character', async () => {
      // Create another user
      const otherUserResponse = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          username: 'otheruser',
          email: 'other@example.com',
          password: 'password123',
        },
      })
      const otherSessionCookie = otherUserResponse.cookies[0]

      // Try to add item to first user's character
      const response = await app.inject({
        method: 'POST',
        url: `/my/characters/${characterId}/inventory`,
        cookies: { [otherSessionCookie.name]: otherSessionCookie.value },
        payload: {
          name: 'Magic Sword',
        },
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('GET /my/characters/:characterId/inventory', () => {
    beforeEach(async () => {
      // Add some test items
      await app.inject({
        method: 'POST',
        url: `/my/characters/${characterId}/inventory`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          name: 'Magic Sword',
          description: 'A legendary blade',
          amount: 1,
        },
      })

      await app.inject({
        method: 'POST',
        url: `/my/characters/${characterId}/inventory`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          name: 'Health Potion',
          amount: 5,
        },
      })

      await app.inject({
        method: 'POST',
        url: `/my/characters/${characterId}/inventory`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          name: 'Gold Coins',
          amount: 100,
        },
      })
    })

    test('should list character inventory', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/characters/${characterId}/inventory`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.items).toHaveLength(3)

      // Should be sorted alphabetically by name
      expect(body.items[0].name).toBe('Gold Coins')
      expect(body.items[1].name).toBe('Health Potion')
      expect(body.items[2].name).toBe('Magic Sword')
    })

    test('should return empty array for character with no items', async () => {
      // Create a new character
      const newCharResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/characters`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          firstName: 'Empty',
          lastName: 'Inventory',
        },
      })
      const newCharId = newCharResponse.json().character.id

      const response = await app.inject({
        method: 'GET',
        url: `/my/characters/${newCharId}/inventory`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().items).toHaveLength(0)
    })

    test('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/characters/${characterId}/inventory`,
      })

      expect(response.statusCode).toBe(401)
    })

    test('should reject for non-existent character', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/my/characters/nonexistent/inventory',
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(404)
    })

    test('should not show other user inventory', async () => {
      // Create another user
      const otherUserResponse = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          username: 'otheruser',
          email: 'other@example.com',
          password: 'password123',
        },
      })
      const otherSessionCookie = otherUserResponse.cookies[0]

      // Try to access first user's character inventory
      const response = await app.inject({
        method: 'GET',
        url: `/my/characters/${characterId}/inventory`,
        cookies: { [otherSessionCookie.name]: otherSessionCookie.value },
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('GET /my/characters/:characterId/inventory/:id', () => {
    let itemId: string

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/characters/${characterId}/inventory`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          name: 'Magic Sword',
          description: 'A legendary blade',
          amount: 1,
        },
      })
      itemId = response.json().item.id
    })

    test('should get single item', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/characters/${characterId}/inventory/${itemId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.item.id).toBe(itemId)
      expect(body.item.name).toBe('Magic Sword')
      expect(body.item.characterId).toBe(characterId)
    })

    test('should return 404 for non-existent item', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/characters/${characterId}/inventory/nonexistent`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(404)
    })

    test('should return 404 for wrong character', async () => {
      // Create another character
      const char2Response = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/characters`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          firstName: 'Other',
          lastName: 'Character',
        },
      })
      const characterId2 = char2Response.json().character.id

      // Try to access item through wrong character
      const response = await app.inject({
        method: 'GET',
        url: `/my/characters/${characterId2}/inventory/${itemId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(404)
    })

    test('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/characters/${characterId}/inventory/${itemId}`,
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('PATCH /my/characters/:characterId/inventory/:id', () => {
    let itemId: string

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/characters/${characterId}/inventory`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          name: 'Magic Sword',
          description: 'A legendary blade',
          amount: 1,
        },
      })
      itemId = response.json().item.id
    })

    test('should update item name', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/characters/${characterId}/inventory/${itemId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          name: 'Epic Sword of Destiny',
        },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.item.name).toBe('Epic Sword of Destiny')
      expect(body.item.description).toBe('A legendary blade') // Unchanged
    })

    test('should update item description', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/characters/${characterId}/inventory/${itemId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          description: 'An even more legendary blade',
        },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().item.description).toBe('An even more legendary blade')
    })

    test('should update item amount', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/characters/${characterId}/inventory/${itemId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          amount: 5,
        },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().item.amount).toBe(5)
    })

    test('should allow setting amount to 0', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/characters/${characterId}/inventory/${itemId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          amount: 0,
        },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().item.amount).toBe(0)
    })

    test('should set description to null', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/characters/${characterId}/inventory/${itemId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          description: null,
        },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().item.description).toBeNull()
    })

    test('should reject duplicate name', async () => {
      // Add another item
      await app.inject({
        method: 'POST',
        url: `/my/characters/${characterId}/inventory`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          name: 'Health Potion',
        },
      })

      // Try to rename first item to match second
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/characters/${characterId}/inventory/${itemId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          name: 'Health Potion',
        },
      })

      expect(response.statusCode).toBe(409)
      expect(response.json().error).toContain('already exists')
    })

    test('should return 404 for non-existent item', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/characters/${characterId}/inventory/nonexistent`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          amount: 5,
        },
      })

      expect(response.statusCode).toBe(404)
    })

    test('should require authentication', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/characters/${characterId}/inventory/${itemId}`,
        payload: {
          amount: 5,
        },
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('DELETE /my/characters/:characterId/inventory/:id', () => {
    let itemId: string

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/characters/${characterId}/inventory`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          name: 'Magic Sword',
        },
      })
      itemId = response.json().item.id
    })

    test('should delete item', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/my/characters/${characterId}/inventory/${itemId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().success).toBe(true)

      // Verify item is gone
      const getResponse = await app.inject({
        method: 'GET',
        url: `/my/characters/${characterId}/inventory/${itemId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })
      expect(getResponse.statusCode).toBe(404)
    })

    test('should return 404 for non-existent item', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/my/characters/${characterId}/inventory/nonexistent`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(404)
    })

    test('should return 404 for wrong character', async () => {
      // Create another character
      const char2Response = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/characters`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          firstName: 'Other',
          lastName: 'Character',
        },
      })
      const characterId2 = char2Response.json().character.id

      // Try to delete item through wrong character
      const response = await app.inject({
        method: 'DELETE',
        url: `/my/characters/${characterId2}/inventory/${itemId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(404)
    })

    test('should require authentication', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/my/characters/${characterId}/inventory/${itemId}`,
      })

      expect(response.statusCode).toBe(401)
    })

    test('should not allow other user to delete', async () => {
      // Create another user
      const otherUserResponse = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          username: 'otheruser',
          email: 'other@example.com',
          password: 'password123',
        },
      })
      const otherSessionCookie = otherUserResponse.cookies[0]

      // Try to delete first user's item
      const response = await app.inject({
        method: 'DELETE',
        url: `/my/characters/${characterId}/inventory/${itemId}`,
        cookies: { [otherSessionCookie.name]: otherSessionCookie.value },
      })

      expect(response.statusCode).toBe(404)
    })
  })
})
