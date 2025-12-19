import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { buildApp, cleanDatabase } from './helpers.js'

describe('Character Endpoints', () => {
  let app: FastifyInstance
  let sessionCookie: { name: string; value: string }
  let _userId: number
  let storyId: string

  beforeEach(async () => {
    app = await buildApp()
    await cleanDatabase()

    // Register a test user and get session cookie
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123',
      },
    })

    sessionCookie = registerResponse.cookies[0]
    _userId = registerResponse.json().user.id

    // Create a test story
    const storyResponse = await app.inject({
      method: 'POST',
      url: '/my/stories',
      cookies: {
        [sessionCookie.name]: sessionCookie.value,
      },
      payload: {
        name: 'Test Story',
        summary: 'A test story for character tests',
      },
    })

    storyId = storyResponse.json().story.id
  })

  afterEach(async () => {
    await app.close()
  })

  describe('POST /my/stories/:storyId/characters', () => {
    test('should create a new character with all fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/characters`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          firstName: 'John',
          middleName: 'Andrew',
          lastName: 'Smith',
          nickname: 'Johnny',
          description: 'A brave warrior seeking redemption',
          background: 'Born in a small village in the northern mountains',
          personality: 'Courageous but impulsive',
          personalityQuirks: 'Always whistles when nervous',
          likes: 'Swordfighting, stargazing, apple pie',
          dislikes: 'Dishonesty, crowded places',
          age: '28',
          gender: 'male',
          sexualOrientation: 'heterosexual',
          height: 180,
          hairColor: 'brown',
          eyeColor: 'blue',
          distinguishingFeatures: 'Scar across left cheek',
          writingStyle: 'Formal and concise',
          isMainCharacter: true,
          birthdate: 1000,
        },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.character).toMatchObject({
        id: expect.any(String),
        storyId,
        pictureFileId: null,
        firstName: 'John',
        middleName: 'Andrew',
        lastName: 'Smith',
        nickname: 'Johnny',
        description: 'A brave warrior seeking redemption',
        background: 'Born in a small village in the northern mountains',
        personality: 'Courageous but impulsive',
        personalityQuirks: 'Always whistles when nervous',
        likes: 'Swordfighting, stargazing, apple pie',
        dislikes: 'Dishonesty, crowded places',
        age: '28',
        gender: 'male',
        sexualOrientation: 'heterosexual',
        height: 180,
        hairColor: 'brown',
        eyeColor: 'blue',
        distinguishingFeatures: 'Scar across left cheek',
        writingStyle: 'Formal and concise',
        isMainCharacter: true,
        laterVersionOfId: null,
        significantActions: null,
        birthdate: 1000,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      })
    })

    test('should create character with minimal fields (firstName only)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/characters`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          firstName: 'Jane',
        },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.character.firstName).toBe('Jane')
      expect(body.character.middleName).toBeNull()
      expect(body.character.lastName).toBeNull()
      expect(body.character.isMainCharacter).toBe(true)
    })

    test('should reject creation with empty firstName', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/characters`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          firstName: '',
        },
      })

      expect(response.statusCode).toBe(400)
      expect(response.json().error).toBeDefined()
    })

    test('should reject creation without firstName', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/characters`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          lastName: 'Smith',
        },
      })

      expect(response.statusCode).toBe(400)
      expect(response.json().error).toBeDefined()
    })

    test('should reject creation for non-existent story', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/my/stories/nonexistent-story-id/characters',
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          firstName: 'John',
        },
      })

      expect(response.statusCode).toBe(404)
      expect(response.json().error).toBe('Story not found')
    })

    test('should reject creation without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/characters`,
        payload: {
          firstName: 'John',
        },
      })

      expect(response.statusCode).toBe(401)
    })

    test('should reject creation with invalid laterVersionOfId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/characters`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          firstName: 'John',
          laterVersionOfId: 'nonexistent-character-id',
        },
      })

      expect(response.statusCode).toBe(400)
      expect(response.json().error).toBe('Previous character version not found in this story')
    })

    test('should create character with valid laterVersionOfId', async () => {
      // Create first character
      const firstResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/characters`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          firstName: 'John',
          lastName: 'Smith',
        },
      })

      const firstCharacterId = firstResponse.json().character.id

      // Create second character as later version
      const secondResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/characters`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          firstName: 'John',
          lastName: 'Smith Jr',
          laterVersionOfId: firstCharacterId,
        },
      })

      expect(secondResponse.statusCode).toBe(201)
      expect(secondResponse.json().character.laterVersionOfId).toBe(firstCharacterId)
    })
  })

  describe('GET /my/stories/:storyId/characters', () => {
    test('should list all characters in a story', async () => {
      // Create two characters
      await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/characters`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          firstName: 'John',
          lastName: 'Smith',
        },
      })

      await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/characters`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          firstName: 'Jane',
          lastName: 'Doe',
        },
      })

      const response = await app.inject({
        method: 'GET',
        url: `/my/stories/${storyId}/characters`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.characters).toHaveLength(2)
      expect(body.characters[0].firstName).toBe('John')
      expect(body.characters[1].firstName).toBe('Jane')
    })

    test('should return empty array for story with no characters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/stories/${storyId}/characters`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().characters).toEqual([])
    })

    test('should reject listing for non-existent story', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/my/stories/nonexistent-story-id/characters',
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
      })

      expect(response.statusCode).toBe(404)
      expect(response.json().error).toBe('Story not found')
    })

    test('should reject listing without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/stories/${storyId}/characters`,
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('GET /my/characters/:id', () => {
    test('should get a single character', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/characters`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          firstName: 'John',
          lastName: 'Smith',
          description: 'A brave warrior',
        },
      })

      const characterId = createResponse.json().character.id

      const response = await app.inject({
        method: 'GET',
        url: `/my/characters/${characterId}`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.character.id).toBe(characterId)
      expect(body.character.firstName).toBe('John')
      expect(body.character.lastName).toBe('Smith')
      expect(body.character.description).toBe('A brave warrior')
    })

    test('should return 404 for non-existent character', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/my/characters/nonexistent-character-id',
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
      })

      expect(response.statusCode).toBe(404)
      expect(response.json().error).toBe('Character not found')
    })

    test('should reject getting character without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/my/characters/some-character-id',
      })

      expect(response.statusCode).toBe(401)
    })

    test("should not allow accessing another user's character", async () => {
      // Create another user
      const otherUserResponse = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'other@example.com',
          username: 'otheruser',
          password: 'password123',
        },
      })

      const otherSessionCookie = otherUserResponse.cookies[0]

      // Create a story for the other user
      const otherStoryResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: {
          [otherSessionCookie.name]: otherSessionCookie.value,
        },
        payload: {
          name: 'Other User Story',
        },
      })

      const otherStoryId = otherStoryResponse.json().story.id

      // Create a character for the other user
      const createCharacterResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${otherStoryId}/characters`,
        cookies: {
          [otherSessionCookie.name]: otherSessionCookie.value,
        },
        payload: {
          firstName: 'Other User Character',
        },
      })

      const otherCharacterId = createCharacterResponse.json().character.id

      // Try to access the other user's character with the first user's session
      const response = await app.inject({
        method: 'GET',
        url: `/my/characters/${otherCharacterId}`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('PATCH /my/characters/:id', () => {
    let characterId: string

    beforeEach(async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/characters`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          firstName: 'John',
          lastName: 'Smith',
        },
      })

      characterId = createResponse.json().character.id
    })

    test('should update character fields', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/characters/${characterId}`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          firstName: 'Jonathan',
          nickname: 'Johnny',
          age: '30',
        },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.character.firstName).toBe('Jonathan')
      expect(body.character.lastName).toBe('Smith') // Unchanged
      expect(body.character.nickname).toBe('Johnny')
      expect(body.character.age).toBe('30')
    })

    test('should allow setting fields to null', async () => {
      // First update with values
      await app.inject({
        method: 'PATCH',
        url: `/my/characters/${characterId}`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          nickname: 'Johnny',
          age: '30',
        },
      })

      // Then set to null
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/characters/${characterId}`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          nickname: null,
          age: null,
        },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().character.nickname).toBeNull()
      expect(response.json().character.age).toBeNull()
    })

    test('should return 404 for non-existent character', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/my/characters/nonexistent-character-id',
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          firstName: 'Jonathan',
        },
      })

      expect(response.statusCode).toBe(404)
      expect(response.json().error).toBe('Character not found')
    })

    test('should reject update without authentication', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/characters/${characterId}`,
        payload: {
          firstName: 'Jonathan',
        },
      })

      expect(response.statusCode).toBe(401)
    })

    test('should reject empty firstName', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/my/characters/${characterId}`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          firstName: '',
        },
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('DELETE /my/characters/:id', () => {
    let characterId: string

    beforeEach(async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/characters`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
        payload: {
          firstName: 'John',
          lastName: 'Smith',
        },
      })

      characterId = createResponse.json().character.id
    })

    test('should delete a character', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/my/characters/${characterId}`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().success).toBe(true)

      // Verify character is deleted
      const getResponse = await app.inject({
        method: 'GET',
        url: `/my/characters/${characterId}`,
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
      })

      expect(getResponse.statusCode).toBe(404)
    })

    test('should return 404 for non-existent character', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/my/characters/nonexistent-character-id',
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
      })

      expect(response.statusCode).toBe(404)
      expect(response.json().error).toBe('Character not found')
    })

    test('should reject delete without authentication', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/my/characters/${characterId}`,
      })

      expect(response.statusCode).toBe(401)
    })
  })
})
