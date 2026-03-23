import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { buildApp, cleanDatabase } from './helpers.js'

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp()
})

afterAll(async () => {
  await app.close()
})

beforeEach(async () => {
  await cleanDatabase()
})

// Helper to register user and get session cookie
async function registerUser(email: string, username: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: {
      email,
      username,
      password: 'Password123!',
    },
  })
  const sessionCookie = response.cookies[0]
  return {
    userId: response.json().user.id,
    cookies: { [sessionCookie.name]: sessionCookie.value },
  }
}

// Helper to create a story
async function createStory(cookies: Record<string, string>, name = 'Test Story') {
  const response = await app.inject({
    method: 'POST',
    url: '/my/stories',
    payload: { name },
    cookies,
  })
  return response.json().story
}

describe('Language Endpoints', () => {
  describe('POST /my/stories/:storyId/languages', () => {
    test('should create language for story', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')
      const story = await createStory(cookies)

      const response = await app.inject({
        method: 'POST',
        url: `/my/stories/${story.id}/languages`,
        payload: { name: 'Scottish Gaelic', label: 'Gaelic' },
        cookies,
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.language.name).toBe('Scottish Gaelic')
      expect(body.language.label).toBe('Gaelic')
      expect(body.language.storyId).toBe(story.id)
    })

    test('should set as default when setAsDefault is true', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')
      const story = await createStory(cookies)

      const response = await app.inject({
        method: 'POST',
        url: `/my/stories/${story.id}/languages`,
        payload: { name: 'English', label: 'English', setAsDefault: true },
        cookies,
      })

      expect(response.statusCode).toBe(201)
      const langId = response.json().language.id

      // Verify it's the default
      const listResponse = await app.inject({
        method: 'GET',
        url: `/my/stories/${story.id}/languages`,
        cookies,
      })
      const langs = listResponse.json().languages
      const defaultLang = langs.find((l: any) => l.isDefault)
      expect(defaultLang).toBeDefined()
      expect(defaultLang.id).toBe(langId)
    })

    test('should return 404 for non-existent story', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const response = await app.inject({
        method: 'POST',
        url: '/my/stories/nonexistent/languages',
        payload: { name: 'English', label: 'English' },
        cookies,
      })

      expect(response.statusCode).toBe(404)
    })

    test('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/my/stories/someid/languages',
        payload: { name: 'English', label: 'English' },
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('GET /my/stories/:storyId/languages', () => {
    test('should list languages for story', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')
      const story = await createStory(cookies)

      // Create two languages
      await app.inject({
        method: 'POST',
        url: `/my/stories/${story.id}/languages`,
        payload: { name: 'English', label: 'English', setAsDefault: true },
        cookies,
      })
      await app.inject({
        method: 'POST',
        url: `/my/stories/${story.id}/languages`,
        payload: { name: 'Scottish Gaelic', label: 'Gaelic' },
        cookies,
      })

      const response = await app.inject({
        method: 'GET',
        url: `/my/stories/${story.id}/languages`,
        cookies,
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.languages).toHaveLength(2)
      expect(body.languages[0].name).toBe('English')
      expect(body.languages[0].isDefault).toBe(true)
      expect(body.languages[1].name).toBe('Scottish Gaelic')
      expect(body.languages[1].isDefault).toBe(false)
    })

    test('should return empty array for story with no languages', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')
      const story = await createStory(cookies)

      const response = await app.inject({
        method: 'GET',
        url: `/my/stories/${story.id}/languages`,
        cookies,
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().languages).toHaveLength(0)
    })
  })

  describe('GET /my/languages/:id', () => {
    test('should get single language', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')
      const story = await createStory(cookies)

      const createResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${story.id}/languages`,
        payload: { name: 'English', label: 'English' },
        cookies,
      })
      const langId = createResponse.json().language.id

      const response = await app.inject({
        method: 'GET',
        url: `/my/languages/${langId}`,
        cookies,
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().language.name).toBe('English')
    })

    test('should return 404 for non-existent language', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const response = await app.inject({
        method: 'GET',
        url: '/my/languages/nonexistent',
        cookies,
      })

      expect(response.statusCode).toBe(404)
    })

    test('should return 403 for language owned by another user', async () => {
      const user1 = await registerUser('user1@example.com', 'user1')
      const user2 = await registerUser('user2@example.com', 'user2')
      const story = await createStory(user1.cookies)

      const createResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${story.id}/languages`,
        payload: { name: 'English', label: 'English' },
        cookies: user1.cookies,
      })
      const langId = createResponse.json().language.id

      const response = await app.inject({
        method: 'GET',
        url: `/my/languages/${langId}`,
        cookies: user2.cookies,
      })

      expect(response.statusCode).toBe(403)
    })
  })

  describe('PUT /my/languages/:id', () => {
    test('should update language', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')
      const story = await createStory(cookies)

      const createResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${story.id}/languages`,
        payload: { name: 'Gaelic', label: 'Gaelic' },
        cookies,
      })
      const langId = createResponse.json().language.id

      const response = await app.inject({
        method: 'PUT',
        url: `/my/languages/${langId}`,
        payload: { name: 'Scottish Gaelic', label: 'Gàidhlig' },
        cookies,
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().language.name).toBe('Scottish Gaelic')
      expect(response.json().language.label).toBe('Gàidhlig')
    })

    test('should allow partial update', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')
      const story = await createStory(cookies)

      const createResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${story.id}/languages`,
        payload: { name: 'English', label: 'English' },
        cookies,
      })
      const langId = createResponse.json().language.id

      const response = await app.inject({
        method: 'PUT',
        url: `/my/languages/${langId}`,
        payload: { label: 'EN' },
        cookies,
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().language.name).toBe('English')
      expect(response.json().language.label).toBe('EN')
    })
  })

  describe('DELETE /my/languages/:id', () => {
    test('should delete non-default language', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')
      const story = await createStory(cookies)

      const createResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${story.id}/languages`,
        payload: { name: 'English', label: 'English' },
        cookies,
      })
      const langId = createResponse.json().language.id

      const response = await app.inject({
        method: 'DELETE',
        url: `/my/languages/${langId}`,
        cookies,
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().success).toBe(true)

      // Verify it's gone
      const listResponse = await app.inject({
        method: 'GET',
        url: `/my/stories/${story.id}/languages`,
        cookies,
      })
      expect(listResponse.json().languages).toHaveLength(0)
    })

    test('should allow deleting default language and clear the default', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')
      const story = await createStory(cookies)

      const createResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${story.id}/languages`,
        payload: { name: 'English', label: 'English', setAsDefault: true },
        cookies,
      })
      const langId = createResponse.json().language.id

      const response = await app.inject({
        method: 'DELETE',
        url: `/my/languages/${langId}`,
        cookies,
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().success).toBe(true)

      // Verify no default remains
      const listResponse = await app.inject({
        method: 'GET',
        url: `/my/stories/${story.id}/languages`,
        cookies,
      })
      expect(listResponse.json().languages).toHaveLength(0)
    })
  })

  describe('PUT /my/stories/:storyId/default-language', () => {
    test('should set default language', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')
      const story = await createStory(cookies)

      // Create two languages
      const create1 = await app.inject({
        method: 'POST',
        url: `/my/stories/${story.id}/languages`,
        payload: { name: 'English', label: 'English', setAsDefault: true },
        cookies,
      })
      const lang1Id = create1.json().language.id

      const create2 = await app.inject({
        method: 'POST',
        url: `/my/stories/${story.id}/languages`,
        payload: { name: 'Scottish Gaelic', label: 'Gaelic' },
        cookies,
      })
      const lang2Id = create2.json().language.id

      // Change default to language 2
      const response = await app.inject({
        method: 'PUT',
        url: `/my/stories/${story.id}/default-language`,
        payload: { languageId: lang2Id },
        cookies,
      })

      expect(response.statusCode).toBe(200)

      // Verify new default
      const listResponse = await app.inject({
        method: 'GET',
        url: `/my/stories/${story.id}/languages`,
        cookies,
      })
      const langs = listResponse.json().languages
      expect(langs.find((l: any) => l.id === lang1Id).isDefault).toBe(false)
      expect(langs.find((l: any) => l.id === lang2Id).isDefault).toBe(true)
    })

    test('should allow clearing default language with null', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')
      const story = await createStory(cookies)

      await app.inject({
        method: 'POST',
        url: `/my/stories/${story.id}/languages`,
        payload: { name: 'English', label: 'English', setAsDefault: true },
        cookies,
      })

      const response = await app.inject({
        method: 'PUT',
        url: `/my/stories/${story.id}/default-language`,
        payload: { languageId: null },
        cookies,
      })

      expect(response.statusCode).toBe(200)

      // Verify no default
      const listResponse = await app.inject({
        method: 'GET',
        url: `/my/stories/${story.id}/languages`,
        cookies,
      })
      const langs = listResponse.json().languages
      expect(langs.every((l: any) => !l.isDefault)).toBe(true)
    })

    test('should return 400 for language from different story', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')
      const story1 = await createStory(cookies, 'Story 1')
      const story2 = await createStory(cookies, 'Story 2')

      const createResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${story2.id}/languages`,
        payload: { name: 'English', label: 'English' },
        cookies,
      })
      const lang2Id = createResponse.json().language.id

      const response = await app.inject({
        method: 'PUT',
        url: `/my/stories/${story1.id}/default-language`,
        payload: { languageId: lang2Id },
        cookies,
      })

      expect(response.statusCode).toBe(400)
    })
  })
})
