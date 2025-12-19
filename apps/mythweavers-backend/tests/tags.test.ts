import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { buildApp, cleanDatabase } from './helpers.js'

let app: FastifyInstance
let sessionCookie: { name: string; value: string }
let _userId: number
let storyId: string

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
})

describe('Tag Endpoints', () => {
  describe('POST /tags', () => {
    test('should create a new tag', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tags',
        payload: {
          name: 'fantasy',
        },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.created).toBe(true)
      expect(body.tag).toMatchObject({
        id: expect.any(String),
        name: 'fantasy',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      })
    })

    test('should normalize tag name to lowercase', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tags',
        payload: {
          name: 'FANTASY',
        },
      })

      expect(response.statusCode).toBe(201)
      expect(response.json().tag.name).toBe('fantasy')
    })

    test('should return existing tag if already exists', async () => {
      // Create first time
      const response1 = await app.inject({
        method: 'POST',
        url: '/tags',
        payload: {
          name: 'fantasy',
        },
      })

      const tag1 = response1.json().tag

      // Create second time (same name)
      const response2 = await app.inject({
        method: 'POST',
        url: '/tags',
        payload: {
          name: 'fantasy',
        },
      })

      expect(response2.statusCode).toBe(201)
      const body2 = response2.json()
      expect(body2.created).toBe(false) // Not newly created
      expect(body2.tag.id).toBe(tag1.id) // Same tag
    })

    test('should allow hyphens in tag name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tags',
        payload: {
          name: 'sci-fi',
        },
      })

      expect(response.statusCode).toBe(201)
      expect(response.json().tag.name).toBe('sci-fi')
    })

    test('should reject tags with special characters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tags',
        payload: {
          name: 'fantasy!',
        },
      })

      expect(response.statusCode).toBe(400)
      expect(response.json().error).toContain('lowercase letters, numbers, and hyphens')
    })

    test('should reject tags with spaces', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tags',
        payload: {
          name: 'science fiction',
        },
      })

      expect(response.statusCode).toBe(400)
    })

    test('should reject empty tag name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tags',
        payload: {
          name: '',
        },
      })

      expect(response.statusCode).toBe(400)
    })

    test('should reject tags with uppercase after normalization fails validation', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tags',
        payload: {
          name: 'Fantasy@2024',
        },
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('GET /tags', () => {
    beforeEach(async () => {
      // Create some test tags
      await app.inject({
        method: 'POST',
        url: '/tags',
        payload: { name: 'fantasy' },
      })

      await app.inject({
        method: 'POST',
        url: '/tags',
        payload: { name: 'sci-fi' },
      })

      await app.inject({
        method: 'POST',
        url: '/tags',
        payload: { name: 'romance' },
      })
    })

    test('should list all tags', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tags',
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.tags).toHaveLength(3)

      // Should be sorted alphabetically
      expect(body.tags[0].name).toBe('fantasy')
      expect(body.tags[1].name).toBe('romance')
      expect(body.tags[2].name).toBe('sci-fi')
    })

    test('should search tags by name', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tags?search=fan',
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.tags).toHaveLength(1)
      expect(body.tags[0].name).toBe('fantasy')
    })

    test('should respect limit parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tags?limit=2',
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().tags).toHaveLength(2)
    })

    test('should return empty array when no tags exist', async () => {
      await cleanDatabase()

      const response = await app.inject({
        method: 'GET',
        url: '/tags',
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().tags).toHaveLength(0)
    })

    test('should be case-insensitive search', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tags?search=FAN',
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().tags).toHaveLength(1)
    })
  })

  describe('POST /my/stories/:storyId/tags', () => {
    let tagId: string

    beforeEach(async () => {
      // Create a test tag
      const tagResponse = await app.inject({
        method: 'POST',
        url: '/tags',
        payload: { name: 'fantasy' },
      })
      tagId = tagResponse.json().tag.id
    })

    test('should add existing tag to story by tagId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/tags`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          tagId,
        },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.tagCreated).toBe(false)
      expect(body.storyTag).toMatchObject({
        id: expect.any(String),
        storyId,
        tagId,
        tag: {
          id: tagId,
          name: 'fantasy',
        },
      })
    })

    test('should add tag to story by tagName (existing tag)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/tags`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          tagName: 'fantasy',
        },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.tagCreated).toBe(false) // Tag already existed
      expect(body.storyTag.tag.name).toBe('fantasy')
    })

    test('should create new tag when adding by tagName', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/tags`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          tagName: 'new-genre',
        },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.tagCreated).toBe(true) // New tag created
      expect(body.storyTag.tag.name).toBe('new-genre')
    })

    test('should reject duplicate tag on same story', async () => {
      // Add tag first time
      await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/tags`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { tagId },
      })

      // Try to add same tag again
      const response = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/tags`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { tagId },
      })

      expect(response.statusCode).toBe(409)
      expect(response.json().error).toContain('already added')
    })

    test('should reject without tagId or tagName', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/tags`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {},
      })

      expect(response.statusCode).toBe(400)
    })

    test('should reject invalid tagId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/tags`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          tagId: 'nonexistent',
        },
      })

      expect(response.statusCode).toBe(404)
      expect(response.json().error).toContain('Tag not found')
    })

    test('should reject invalid tagName format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/tags`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          tagName: 'invalid tag!',
        },
      })

      expect(response.statusCode).toBe(400)
    })

    test('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/tags`,
        payload: { tagId },
      })

      expect(response.statusCode).toBe(401)
    })

    test('should reject for non-existent story', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/my/stories/nonexistent/tags',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { tagId },
      })

      expect(response.statusCode).toBe(404)
    })

    test('should reject for other user story', async () => {
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

      // Try to add tag to first user's story
      const response = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/tags`,
        cookies: { [otherSessionCookie.name]: otherSessionCookie.value },
        payload: { tagId },
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('GET /my/stories/:storyId/tags', () => {
    beforeEach(async () => {
      // Add some tags to the story
      await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/tags`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { tagName: 'fantasy' },
      })

      await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/tags`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { tagName: 'adventure' },
      })

      await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/tags`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { tagName: 'magic' },
      })
    })

    test('should list story tags', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/stories/${storyId}/tags`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.tags).toHaveLength(3)

      // Should be sorted alphabetically
      expect(body.tags[0].name).toBe('adventure')
      expect(body.tags[1].name).toBe('fantasy')
      expect(body.tags[2].name).toBe('magic')
    })

    test('should return empty array for story with no tags', async () => {
      // Create new story
      const newStoryResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Empty Story' },
      })
      const newStoryId = newStoryResponse.json().story.id

      const response = await app.inject({
        method: 'GET',
        url: `/my/stories/${newStoryId}/tags`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().tags).toHaveLength(0)
    })

    test('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/stories/${storyId}/tags`,
      })

      expect(response.statusCode).toBe(401)
    })

    test('should reject for non-existent story', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/my/stories/nonexistent/tags',
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(404)
    })

    test('should not show other user story tags', async () => {
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

      // Try to view first user's story tags
      const response = await app.inject({
        method: 'GET',
        url: `/my/stories/${storyId}/tags`,
        cookies: { [otherSessionCookie.name]: otherSessionCookie.value },
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('DELETE /my/stories/:storyId/tags/:tagId', () => {
    let tagId: string

    beforeEach(async () => {
      // Add a tag to the story
      const response = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/tags`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { tagName: 'fantasy' },
      })
      tagId = response.json().storyTag.tagId
    })

    test('should remove tag from story', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/my/stories/${storyId}/tags/${tagId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().success).toBe(true)

      // Verify tag is removed
      const listResponse = await app.inject({
        method: 'GET',
        url: `/my/stories/${storyId}/tags`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })
      expect(listResponse.json().tags).toHaveLength(0)
    })

    test('should return 404 for tag not on story', async () => {
      // Create another tag not on story
      const otherTagResponse = await app.inject({
        method: 'POST',
        url: '/tags',
        payload: { name: 'romance' },
      })
      const otherTagId = otherTagResponse.json().tag.id

      const response = await app.inject({
        method: 'DELETE',
        url: `/my/stories/${storyId}/tags/${otherTagId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(404)
      expect(response.json().error).toContain('not found on this story')
    })

    test('should require authentication', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/my/stories/${storyId}/tags/${tagId}`,
      })

      expect(response.statusCode).toBe(401)
    })

    test('should reject for non-existent story', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/my/stories/nonexistent/tags/${tagId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(404)
    })

    test('should not allow removing from other user story', async () => {
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

      // Try to remove tag from first user's story
      const response = await app.inject({
        method: 'DELETE',
        url: `/my/stories/${storyId}/tags/${tagId}`,
        cookies: { [otherSessionCookie.name]: otherSessionCookie.value },
      })

      expect(response.statusCode).toBe(404)
    })
  })
})
