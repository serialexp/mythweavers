import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { buildApp, cleanDatabase } from './helpers.js'

describe('Public Story Endpoints', () => {
  let app: FastifyInstance
  let sessionCookie: { name: string; value: string }

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
  })

  afterEach(async () => {
    await app.close()
  })

  describe('GET /stories', () => {
    test('should list only published stories', async () => {
      // Create published story
      const publishedResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Published Story', summary: 'Public story' },
      })
      const publishedId = publishedResponse.json().story.id

      // Publish it
      await app.inject({
        method: 'PATCH',
        url: `/my/stories/${publishedId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { published: true },
      })

      // Create unpublished story
      await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Draft Story', summary: 'Not public yet' },
      })

      // Browse public stories (no auth)
      const response = await app.inject({
        method: 'GET',
        url: '/stories',
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.stories).toHaveLength(1)
      expect(body.stories[0].name).toBe('Published Story')
      expect(body.stories[0].owner.username).toBe('testuser')
    })

    test('should return empty list when no published stories', async () => {
      // Create only unpublished stories
      await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Draft Story' },
      })

      const response = await app.inject({
        method: 'GET',
        url: '/stories',
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.stories).toHaveLength(0)
      expect(body.pagination.total).toBe(0)
    })

    test('should paginate published stories', async () => {
      // Create and publish 25 stories
      for (let i = 1; i <= 25; i++) {
        const createResponse = await app.inject({
          method: 'POST',
          url: '/my/stories',
          cookies: { [sessionCookie.name]: sessionCookie.value },
          payload: { name: `Story ${i}` },
        })

        const storyId = createResponse.json().story.id

        await app.inject({
          method: 'PATCH',
          url: `/my/stories/${storyId}`,
          cookies: { [sessionCookie.name]: sessionCookie.value },
          payload: { published: true },
        })
      }

      // Get first page
      const page1Response = await app.inject({
        method: 'GET',
        url: '/stories?page=1&pageSize=10',
      })

      expect(page1Response.statusCode).toBe(200)
      const page1Body = page1Response.json()
      expect(page1Body.stories).toHaveLength(10)
      expect(page1Body.pagination).toMatchObject({
        page: 1,
        pageSize: 10,
        total: 25,
        totalPages: 3,
      })

      // Get second page
      const page2Response = await app.inject({
        method: 'GET',
        url: '/stories?page=2&pageSize=10',
      })

      const page2Body = page2Response.json()
      expect(page2Body.stories).toHaveLength(10)
      expect(page2Body.pagination.page).toBe(2)
    })

    test('should search published stories by name', async () => {
      // Create and publish stories
      const story1 = await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Dragon Quest', summary: 'Fight dragons' },
      })

      await app.inject({
        method: 'PATCH',
        url: `/my/stories/${story1.json().story.id}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { published: true },
      })

      const story2 = await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Space Adventure', summary: 'Explore space' },
      })

      await app.inject({
        method: 'PATCH',
        url: `/my/stories/${story2.json().story.id}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { published: true },
      })

      const response = await app.inject({
        method: 'GET',
        url: '/stories?search=dragon',
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.stories).toHaveLength(1)
      expect(body.stories[0].name).toBe('Dragon Quest')
    })

    test('should filter by status', async () => {
      // Create completed story
      const completed = await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Completed Story' },
      })

      await app.inject({
        method: 'PATCH',
        url: `/my/stories/${completed.json().story.id}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { status: 'COMPLETED', published: true },
      })

      // Create ongoing story
      const ongoing = await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Ongoing Story' },
      })

      await app.inject({
        method: 'PATCH',
        url: `/my/stories/${ongoing.json().story.id}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { status: 'ONGOING', published: true },
      })

      // Filter by completed
      const response = await app.inject({
        method: 'GET',
        url: '/stories?status=COMPLETED',
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.stories).toHaveLength(1)
      expect(body.stories[0].name).toBe('Completed Story')
      expect(body.stories[0].status).toBe('COMPLETED')
    })

    test('should filter by type', async () => {
      // Create original story (default is ORIGINAL)
      const original = await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Original Story', type: 'ORIGINAL' },
      })

      await app.inject({
        method: 'PATCH',
        url: `/my/stories/${original.json().story.id}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { published: true },
      })

      // Create fanfiction story
      const fanfic = await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Fanfic Story', type: 'FANFICTION' },
      })

      await app.inject({
        method: 'PATCH',
        url: `/my/stories/${fanfic.json().story.id}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { published: true },
      })

      // Filter by fanfiction
      const response = await app.inject({
        method: 'GET',
        url: '/stories?type=FANFICTION',
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.stories).toHaveLength(1)
      expect(body.stories[0].name).toBe('Fanfic Story')
      expect(body.stories[0].type).toBe('FANFICTION')
    })

    test('should sort by recent (default)', async () => {
      // Create and publish stories with delays
      const story1 = await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Old Story' },
      })

      await app.inject({
        method: 'PATCH',
        url: `/my/stories/${story1.json().story.id}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { published: true },
      })

      // Brief delay
      await new Promise((resolve) => setTimeout(resolve, 10))

      const story2 = await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'New Story' },
      })

      await app.inject({
        method: 'PATCH',
        url: `/my/stories/${story2.json().story.id}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { published: true },
      })

      const response = await app.inject({
        method: 'GET',
        url: '/stories',
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.stories[0].name).toBe('New Story')
      expect(body.stories[1].name).toBe('Old Story')
    })

    test('should sort by title', async () => {
      // Create stories
      const storyB = await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Bravo Story' },
      })

      await app.inject({
        method: 'PATCH',
        url: `/my/stories/${storyB.json().story.id}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { published: true },
      })

      const storyA = await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Alpha Story' },
      })

      await app.inject({
        method: 'PATCH',
        url: `/my/stories/${storyA.json().story.id}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { published: true },
      })

      const response = await app.inject({
        method: 'GET',
        url: '/stories?sortBy=title',
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.stories[0].name).toBe('Alpha Story')
      expect(body.stories[1].name).toBe('Bravo Story')
    })

    test('should not expose sensitive owner information', async () => {
      const story = await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Test Story' },
      })

      await app.inject({
        method: 'PATCH',
        url: `/my/stories/${story.json().story.id}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { published: true },
      })

      const response = await app.inject({
        method: 'GET',
        url: '/stories',
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      const storyData = body.stories[0]

      // Should have owner with id and username
      expect(storyData.owner).toHaveProperty('id')
      expect(storyData.owner).toHaveProperty('username')

      // Should NOT have owner email or password
      expect(storyData.owner).not.toHaveProperty('email')
      expect(storyData.owner).not.toHaveProperty('passwordHash')

      // Should NOT have owner info directly on story
      expect(storyData).not.toHaveProperty('ownerId')
    })
  })

  describe('GET /stories/:id', () => {
    test('should view published story', async () => {
      // Create and publish story
      const createResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Test Story', summary: 'Test summary' },
      })

      const storyId = createResponse.json().story.id

      await app.inject({
        method: 'PATCH',
        url: `/my/stories/${storyId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { published: true },
      })

      // View story (no auth)
      const response = await app.inject({
        method: 'GET',
        url: `/stories/${storyId}`,
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.story.id).toBe(storyId)
      expect(body.story.name).toBe('Test Story')
      expect(body.story.owner.username).toBe('testuser')
    })

    test('should return 404 for unpublished story', async () => {
      // Create unpublished story
      const createResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Draft Story' },
      })

      const storyId = createResponse.json().story.id

      // Try to view (no auth)
      const response = await app.inject({
        method: 'GET',
        url: `/stories/${storyId}`,
      })

      expect(response.statusCode).toBe(404)
      const body = response.json()
      expect(body.error).toBe('Story not found')
    })

    test('should return 404 for non-existent story', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/stories/nonexistent',
      })

      expect(response.statusCode).toBe(404)
      const body = response.json()
      expect(body.error).toBe('Story not found')
    })

    test('should work without authentication', async () => {
      // Create and publish story
      const createResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Public Story' },
      })

      const storyId = createResponse.json().story.id

      await app.inject({
        method: 'PATCH',
        url: `/my/stories/${storyId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { published: true },
      })

      // View without auth
      const response = await app.inject({
        method: 'GET',
        url: `/stories/${storyId}`,
        // No cookies
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().story.name).toBe('Public Story')
    })
  })
})
