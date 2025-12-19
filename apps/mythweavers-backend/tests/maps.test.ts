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

describe('Map Endpoints', () => {
  describe('POST /my/stories/:storyId/maps', () => {
    test('should create map for story', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Test Story' },
        cookies,
      })
      const { story } = storyResponse.json()

      const response = await app.inject({
        method: 'POST',
        url: `/my/stories/${story.id}/maps`,
        payload: {
          name: 'Galaxy Map',
          borderColor: '#FF0000',
        },
        cookies,
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.map.name).toBe('Galaxy Map')
      expect(body.map.borderColor).toBe('#FF0000')
      expect(body.map.storyId).toBe(story.id)
    })

    test('should return 404 for non-existent story', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const response = await app.inject({
        method: 'POST',
        url: '/my/stories/nonexistent/maps',
        payload: { name: 'Map' },
        cookies,
      })

      expect(response.statusCode).toBe(404)
    })

    test('should return 403 for story owned by another user', async () => {
      const user1 = await registerUser('user1@example.com', 'user1')
      const user2 = await registerUser('user2@example.com', 'user2')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Story' },
        cookies: user1.cookies,
      })
      const { story } = storyResponse.json()

      const response = await app.inject({
        method: 'POST',
        url: `/my/stories/${story.id}/maps`,
        payload: { name: 'Map' },
        cookies: user2.cookies,
      })

      expect(response.statusCode).toBe(403)
    })

    test('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/my/stories/someid/maps',
        payload: { name: 'Map' },
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('GET /my/stories/:storyId/maps', () => {
    test('should list maps for story', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Story' },
        cookies,
      })
      const { story } = storyResponse.json()

      // Create multiple maps
      await app.inject({
        method: 'POST',
        url: `/my/stories/${story.id}/maps`,
        payload: { name: 'Map 1' },
        cookies,
      })

      await app.inject({
        method: 'POST',
        url: `/my/stories/${story.id}/maps`,
        payload: { name: 'Map 2' },
        cookies,
      })

      const response = await app.inject({
        method: 'GET',
        url: `/my/stories/${story.id}/maps`,
        cookies,
      })

      expect(response.statusCode).toBe(200)
      const { maps } = response.json()
      expect(maps).toBeArray()
      expect(maps.length).toBe(2)
      expect(maps[0].name).toBe('Map 1')
      expect(maps[1].name).toBe('Map 2')
    })
  })

  describe('GET /my/maps/:id', () => {
    test('should get map by id', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Story' },
        cookies,
      })

      const mapResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyResponse.json().story.id}/maps`,
        payload: { name: 'Test Map' },
        cookies,
      })
      const { map } = mapResponse.json()

      const response = await app.inject({
        method: 'GET',
        url: `/my/maps/${map.id}`,
        cookies,
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().map.id).toBe(map.id)
      expect(response.json().map.name).toBe('Test Map')
    })

    test('should return 404 for non-existent map', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const response = await app.inject({
        method: 'GET',
        url: '/my/maps/nonexistent',
        cookies,
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('PUT /my/maps/:id', () => {
    test('should update map', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Story' },
        cookies,
      })

      const mapResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyResponse.json().story.id}/maps`,
        payload: { name: 'Original Name' },
        cookies,
      })
      const { map } = mapResponse.json()

      const response = await app.inject({
        method: 'PUT',
        url: `/my/maps/${map.id}`,
        payload: {
          name: 'Updated Name',
          borderColor: '#00FF00',
        },
        cookies,
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.map.name).toBe('Updated Name')
      expect(body.map.borderColor).toBe('#00FF00')
    })
  })

  describe('DELETE /my/maps/:id', () => {
    test('should delete map', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Story' },
        cookies,
      })

      const mapResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyResponse.json().story.id}/maps`,
        payload: { name: 'Map' },
        cookies,
      })
      const { map } = mapResponse.json()

      const response = await app.inject({
        method: 'DELETE',
        url: `/my/maps/${map.id}`,
        cookies,
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().success).toBe(true)

      // Verify deleted
      const getResponse = await app.inject({
        method: 'GET',
        url: `/my/maps/${map.id}`,
        cookies,
      })
      expect(getResponse.statusCode).toBe(404)
    })
  })
})

describe('Landmark Endpoints', () => {
  describe('POST /my/maps/:mapId/landmarks', () => {
    test('should create landmark on map', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Story' },
        cookies,
      })

      const mapResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyResponse.json().story.id}/maps`,
        payload: { name: 'Map' },
        cookies,
      })
      const { map } = mapResponse.json()

      const response = await app.inject({
        method: 'POST',
        url: `/my/maps/${map.id}/landmarks`,
        payload: {
          x: 100.5,
          y: 200.3,
          name: 'Coruscant',
          description: 'Capital world',
          type: 'system',
          population: '1 trillion',
        },
        cookies,
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.landmark.name).toBe('Coruscant')
      expect(body.landmark.x).toBe(100.5)
      expect(body.landmark.y).toBe(200.3)
      expect(body.landmark.population).toBe('1 trillion')
    })

    test('should return 404 for non-existent map', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const response = await app.inject({
        method: 'POST',
        url: '/my/maps/nonexistent/landmarks',
        payload: {
          x: 100,
          y: 200,
          name: 'Test',
          description: 'Test',
        },
        cookies,
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('GET /my/maps/:mapId/landmarks', () => {
    test('should list landmarks for map', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Story' },
        cookies,
      })

      const mapResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyResponse.json().story.id}/maps`,
        payload: { name: 'Map' },
        cookies,
      })
      const { map } = mapResponse.json()

      // Create landmarks
      await app.inject({
        method: 'POST',
        url: `/my/maps/${map.id}/landmarks`,
        payload: { x: 1, y: 2, name: 'Landmark 1', description: 'Test' },
        cookies,
      })

      await app.inject({
        method: 'POST',
        url: `/my/maps/${map.id}/landmarks`,
        payload: { x: 3, y: 4, name: 'Landmark 2', description: 'Test' },
        cookies,
      })

      const response = await app.inject({
        method: 'GET',
        url: `/my/maps/${map.id}/landmarks`,
        cookies,
      })

      expect(response.statusCode).toBe(200)
      const { landmarks } = response.json()
      expect(landmarks).toBeArray()
      expect(landmarks.length).toBe(2)
    })
  })

  describe('PUT /my/landmarks/:id', () => {
    test('should update landmark', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Story' },
        cookies,
      })

      const mapResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyResponse.json().story.id}/maps`,
        payload: { name: 'Map' },
        cookies,
      })
      const { map } = mapResponse.json()

      const landmarkResponse = await app.inject({
        method: 'POST',
        url: `/my/maps/${map.id}/landmarks`,
        payload: { x: 1, y: 2, name: 'Old Name', description: 'Test' },
        cookies,
      })
      const { landmark } = landmarkResponse.json()

      const response = await app.inject({
        method: 'PUT',
        url: `/my/landmarks/${landmark.id}`,
        payload: {
          name: 'New Name',
          x: 10,
          y: 20,
        },
        cookies,
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.landmark.name).toBe('New Name')
      expect(body.landmark.x).toBe(10)
      expect(body.landmark.y).toBe(20)
    })
  })

  describe('DELETE /my/landmarks/:id', () => {
    test('should delete landmark', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Story' },
        cookies,
      })

      const mapResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyResponse.json().story.id}/maps`,
        payload: { name: 'Map' },
        cookies,
      })
      const { map } = mapResponse.json()

      const landmarkResponse = await app.inject({
        method: 'POST',
        url: `/my/maps/${map.id}/landmarks`,
        payload: { x: 1, y: 2, name: 'Test', description: 'Test' },
        cookies,
      })
      const { landmark } = landmarkResponse.json()

      const response = await app.inject({
        method: 'DELETE',
        url: `/my/landmarks/${landmark.id}`,
        cookies,
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().success).toBe(true)
    })
  })
})

describe('Pawn Endpoints', () => {
  describe('POST /my/maps/:mapId/pawns', () => {
    test('should create pawn on map', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Story' },
        cookies,
      })

      const mapResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyResponse.json().story.id}/maps`,
        payload: { name: 'Map' },
        cookies,
      })
      const { map } = mapResponse.json()

      const response = await app.inject({
        method: 'POST',
        url: `/my/maps/${map.id}/pawns`,
        payload: {
          name: 'Millennium Falcon',
          description: 'Fast freighter',
          designation: 'YT-1300',
          speed: 2.0,
          defaultX: 100,
          defaultY: 200,
          color: '#FFFF00',
        },
        cookies,
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.pawn.name).toBe('Millennium Falcon')
      expect(body.pawn.speed).toBe(2.0)
      expect(body.pawn.designation).toBe('YT-1300')
    })

    test('should use default speed', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Story' },
        cookies,
      })

      const mapResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyResponse.json().story.id}/maps`,
        payload: { name: 'Map' },
        cookies,
      })
      const { map } = mapResponse.json()

      const response = await app.inject({
        method: 'POST',
        url: `/my/maps/${map.id}/pawns`,
        payload: {
          name: 'Ship',
          defaultX: 0,
          defaultY: 0,
        },
        cookies,
      })

      expect(response.statusCode).toBe(201)
      expect(response.json().pawn.speed).toBe(1.0)
    })
  })

  describe('GET /my/maps/:mapId/pawns', () => {
    test('should list pawns for map', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Story' },
        cookies,
      })

      const mapResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyResponse.json().story.id}/maps`,
        payload: { name: 'Map' },
        cookies,
      })
      const { map } = mapResponse.json()

      await app.inject({
        method: 'POST',
        url: `/my/maps/${map.id}/pawns`,
        payload: { name: 'Pawn 1', defaultX: 0, defaultY: 0 },
        cookies,
      })

      await app.inject({
        method: 'POST',
        url: `/my/maps/${map.id}/pawns`,
        payload: { name: 'Pawn 2', defaultX: 1, defaultY: 1 },
        cookies,
      })

      const response = await app.inject({
        method: 'GET',
        url: `/my/maps/${map.id}/pawns`,
        cookies,
      })

      expect(response.statusCode).toBe(200)
      const { pawns } = response.json()
      expect(pawns).toBeArray()
      expect(pawns.length).toBe(2)
    })
  })

  describe('PUT /my/pawns/:id', () => {
    test('should update pawn', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Story' },
        cookies,
      })

      const mapResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyResponse.json().story.id}/maps`,
        payload: { name: 'Map' },
        cookies,
      })
      const { map } = mapResponse.json()

      const pawnResponse = await app.inject({
        method: 'POST',
        url: `/my/maps/${map.id}/pawns`,
        payload: { name: 'Old Name', defaultX: 0, defaultY: 0 },
        cookies,
      })
      const { pawn } = pawnResponse.json()

      const response = await app.inject({
        method: 'PUT',
        url: `/my/pawns/${pawn.id}`,
        payload: {
          name: 'New Name',
          speed: 3.0,
        },
        cookies,
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.pawn.name).toBe('New Name')
      expect(body.pawn.speed).toBe(3.0)
    })
  })

  describe('DELETE /my/pawns/:id', () => {
    test('should delete pawn', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Story' },
        cookies,
      })

      const mapResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyResponse.json().story.id}/maps`,
        payload: { name: 'Map' },
        cookies,
      })
      const { map } = mapResponse.json()

      const pawnResponse = await app.inject({
        method: 'POST',
        url: `/my/maps/${map.id}/pawns`,
        payload: { name: 'Test', defaultX: 0, defaultY: 0 },
        cookies,
      })
      const { pawn } = pawnResponse.json()

      const response = await app.inject({
        method: 'DELETE',
        url: `/my/pawns/${pawn.id}`,
        cookies,
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().success).toBe(true)
    })
  })
})

describe('Path Endpoints', () => {
  describe('POST /my/maps/:mapId/paths', () => {
    test('should create path on map', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Story' },
        cookies,
      })

      const mapResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyResponse.json().story.id}/maps`,
        payload: { name: 'Map' },
        cookies,
      })
      const { map } = mapResponse.json()

      const response = await app.inject({
        method: 'POST',
        url: `/my/maps/${map.id}/paths`,
        payload: {
          speedMultiplier: 15.0,
        },
        cookies,
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.path.speedMultiplier).toBe(15.0)
    })

    test('should use default speedMultiplier', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Story' },
        cookies,
      })

      const mapResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyResponse.json().story.id}/maps`,
        payload: { name: 'Map' },
        cookies,
      })
      const { map } = mapResponse.json()

      const response = await app.inject({
        method: 'POST',
        url: `/my/maps/${map.id}/paths`,
        payload: {},
        cookies,
      })

      expect(response.statusCode).toBe(201)
      expect(response.json().path.speedMultiplier).toBe(10.0)
    })
  })

  describe('GET /my/maps/:mapId/paths', () => {
    test('should list paths for map', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Story' },
        cookies,
      })

      const mapResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyResponse.json().story.id}/maps`,
        payload: { name: 'Map' },
        cookies,
      })
      const { map } = mapResponse.json()

      await app.inject({
        method: 'POST',
        url: `/my/maps/${map.id}/paths`,
        payload: { speedMultiplier: 5 },
        cookies,
      })

      await app.inject({
        method: 'POST',
        url: `/my/maps/${map.id}/paths`,
        payload: { speedMultiplier: 15 },
        cookies,
      })

      const response = await app.inject({
        method: 'GET',
        url: `/my/maps/${map.id}/paths`,
        cookies,
      })

      expect(response.statusCode).toBe(200)
      const { paths } = response.json()
      expect(paths).toBeArray()
      expect(paths.length).toBe(2)
    })
  })

  describe('PUT /my/paths/:id', () => {
    test('should update path', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Story' },
        cookies,
      })

      const mapResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyResponse.json().story.id}/maps`,
        payload: { name: 'Map' },
        cookies,
      })
      const { map } = mapResponse.json()

      const pathResponse = await app.inject({
        method: 'POST',
        url: `/my/maps/${map.id}/paths`,
        payload: { speedMultiplier: 10 },
        cookies,
      })
      const { path } = pathResponse.json()

      const response = await app.inject({
        method: 'PUT',
        url: `/my/paths/${path.id}`,
        payload: {
          speedMultiplier: 20,
        },
        cookies,
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.path.speedMultiplier).toBe(20)
    })
  })

  describe('DELETE /my/paths/:id', () => {
    test('should delete path', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Story' },
        cookies,
      })

      const mapResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyResponse.json().story.id}/maps`,
        payload: { name: 'Map' },
        cookies,
      })
      const { map } = mapResponse.json()

      const pathResponse = await app.inject({
        method: 'POST',
        url: `/my/maps/${map.id}/paths`,
        payload: {},
        cookies,
      })
      const { path } = pathResponse.json()

      const response = await app.inject({
        method: 'DELETE',
        url: `/my/paths/${path.id}`,
        cookies,
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().success).toBe(true)
    })
  })
})

describe('PathSegment Endpoints', () => {
  describe('POST /my/paths/:pathId/segments', () => {
    test('should create segment for path', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Story' },
        cookies,
      })

      const mapResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyResponse.json().story.id}/maps`,
        payload: { name: 'Map' },
        cookies,
      })
      const { map } = mapResponse.json()

      const pathResponse = await app.inject({
        method: 'POST',
        url: `/my/maps/${map.id}/paths`,
        payload: {},
        cookies,
      })
      const { path } = pathResponse.json()

      const response = await app.inject({
        method: 'POST',
        url: `/my/paths/${path.id}/segments`,
        payload: {
          order: 0,
          startX: 10.5,
          startY: 20.3,
          endX: 30.2,
          endY: 40.8,
        },
        cookies,
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.segment.order).toBe(0)
      expect(body.segment.startX).toBe(10.5)
      expect(body.segment.startY).toBe(20.3)
      expect(body.segment.endX).toBe(30.2)
      expect(body.segment.endY).toBe(40.8)
    })

    test('should create segment with landmark references', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Story' },
        cookies,
      })

      const mapResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyResponse.json().story.id}/maps`,
        payload: { name: 'Map' },
        cookies,
      })
      const { map } = mapResponse.json()

      // Create landmarks
      const landmark1Response = await app.inject({
        method: 'POST',
        url: `/my/maps/${map.id}/landmarks`,
        payload: { x: 10, y: 20, name: 'Start', description: 'Start point' },
        cookies,
      })
      const landmark1 = landmark1Response.json().landmark

      const landmark2Response = await app.inject({
        method: 'POST',
        url: `/my/maps/${map.id}/landmarks`,
        payload: { x: 30, y: 40, name: 'End', description: 'End point' },
        cookies,
      })
      const landmark2 = landmark2Response.json().landmark

      const pathResponse = await app.inject({
        method: 'POST',
        url: `/my/maps/${map.id}/paths`,
        payload: {},
        cookies,
      })
      const { path } = pathResponse.json()

      const response = await app.inject({
        method: 'POST',
        url: `/my/paths/${path.id}/segments`,
        payload: {
          order: 0,
          startX: 10,
          startY: 20,
          endX: 30,
          endY: 40,
          startLandmarkId: landmark1.id,
          endLandmarkId: landmark2.id,
        },
        cookies,
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.segment.startLandmarkId).toBe(landmark1.id)
      expect(body.segment.endLandmarkId).toBe(landmark2.id)
    })

    test('should return 400 for invalid landmark ID', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Story' },
        cookies,
      })

      const mapResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyResponse.json().story.id}/maps`,
        payload: { name: 'Map' },
        cookies,
      })
      const { map } = mapResponse.json()

      const pathResponse = await app.inject({
        method: 'POST',
        url: `/my/maps/${map.id}/paths`,
        payload: {},
        cookies,
      })
      const { path } = pathResponse.json()

      const response = await app.inject({
        method: 'POST',
        url: `/my/paths/${path.id}/segments`,
        payload: {
          order: 0,
          startX: 10,
          startY: 20,
          endX: 30,
          endY: 40,
          startLandmarkId: 'nonexistent',
        },
        cookies,
      })

      expect(response.statusCode).toBe(400)
      expect(response.json().error).toContain('Invalid start landmark')
    })

    test('should return 404 for non-existent path', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const response = await app.inject({
        method: 'POST',
        url: '/my/paths/nonexistent/segments',
        payload: {
          order: 0,
          startX: 10,
          startY: 20,
          endX: 30,
          endY: 40,
        },
        cookies,
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('GET /my/paths/:pathId/segments', () => {
    test('should list segments for path in order', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Story' },
        cookies,
      })

      const mapResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyResponse.json().story.id}/maps`,
        payload: { name: 'Map' },
        cookies,
      })
      const { map } = mapResponse.json()

      const pathResponse = await app.inject({
        method: 'POST',
        url: `/my/maps/${map.id}/paths`,
        payload: {},
        cookies,
      })
      const { path } = pathResponse.json()

      // Create segments in reverse order
      await app.inject({
        method: 'POST',
        url: `/my/paths/${path.id}/segments`,
        payload: { order: 2, startX: 50, startY: 60, endX: 70, endY: 80 },
        cookies,
      })

      await app.inject({
        method: 'POST',
        url: `/my/paths/${path.id}/segments`,
        payload: { order: 0, startX: 10, startY: 20, endX: 30, endY: 40 },
        cookies,
      })

      await app.inject({
        method: 'POST',
        url: `/my/paths/${path.id}/segments`,
        payload: { order: 1, startX: 30, startY: 40, endX: 50, endY: 60 },
        cookies,
      })

      const response = await app.inject({
        method: 'GET',
        url: `/my/paths/${path.id}/segments`,
        cookies,
      })

      expect(response.statusCode).toBe(200)
      const { segments } = response.json()
      expect(segments).toBeArray()
      expect(segments.length).toBe(3)
      // Should be sorted by order
      expect(segments[0].order).toBe(0)
      expect(segments[1].order).toBe(1)
      expect(segments[2].order).toBe(2)
    })
  })

  describe('PUT /my/path-segments/:id', () => {
    test('should update segment', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Story' },
        cookies,
      })

      const mapResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyResponse.json().story.id}/maps`,
        payload: { name: 'Map' },
        cookies,
      })
      const { map } = mapResponse.json()

      const pathResponse = await app.inject({
        method: 'POST',
        url: `/my/maps/${map.id}/paths`,
        payload: {},
        cookies,
      })
      const { path } = pathResponse.json()

      const segmentResponse = await app.inject({
        method: 'POST',
        url: `/my/paths/${path.id}/segments`,
        payload: { order: 0, startX: 10, startY: 20, endX: 30, endY: 40 },
        cookies,
      })
      const { segment } = segmentResponse.json()

      const response = await app.inject({
        method: 'PUT',
        url: `/my/path-segments/${segment.id}`,
        payload: {
          order: 1,
          endX: 50,
          endY: 60,
        },
        cookies,
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.segment.order).toBe(1)
      expect(body.segment.endX).toBe(50)
      expect(body.segment.endY).toBe(60)
      // Unchanged values should remain
      expect(body.segment.startX).toBe(10)
      expect(body.segment.startY).toBe(20)
    })
  })

  describe('DELETE /my/path-segments/:id', () => {
    test('should delete segment', async () => {
      const { cookies } = await registerUser('test@example.com', 'testuser')

      const storyResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        payload: { name: 'Story' },
        cookies,
      })

      const mapResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyResponse.json().story.id}/maps`,
        payload: { name: 'Map' },
        cookies,
      })
      const { map } = mapResponse.json()

      const pathResponse = await app.inject({
        method: 'POST',
        url: `/my/maps/${map.id}/paths`,
        payload: {},
        cookies,
      })
      const { path } = pathResponse.json()

      const segmentResponse = await app.inject({
        method: 'POST',
        url: `/my/paths/${path.id}/segments`,
        payload: { order: 0, startX: 10, startY: 20, endX: 30, endY: 40 },
        cookies,
      })
      const { segment } = segmentResponse.json()

      const response = await app.inject({
        method: 'DELETE',
        url: `/my/path-segments/${segment.id}`,
        cookies,
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().success).toBe(true)

      // Verify deleted
      const getResponse = await app.inject({
        method: 'GET',
        url: `/my/path-segments/${segment.id}`,
        cookies,
      })
      expect(getResponse.statusCode).toBe(404)
    })
  })
})
