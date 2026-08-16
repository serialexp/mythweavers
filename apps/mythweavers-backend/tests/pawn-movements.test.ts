import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../src/lib/prisma.js'
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

type Cookies = Record<string, string>

async function registerUser(email: string, username: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email, username, password: 'Password123!' },
  })
  const sessionCookie = response.cookies[0]
  return {
    userId: response.json().user.id,
    cookies: { [sessionCookie.name]: sessionCookie.value } as Cookies,
  }
}

async function createMap(cookies: Cookies, storyId: string, name: string) {
  const response = await app.inject({
    method: 'POST',
    url: `/my/stories/${storyId}/maps`,
    payload: { name },
    cookies,
  })
  return response.json().map
}

async function createPawn(cookies: Cookies, mapId: string, name = 'Falcon') {
  const response = await app.inject({
    method: 'POST',
    url: `/my/maps/${mapId}/pawns`,
    payload: { name, defaultX: 0.5, defaultY: 0.5 },
    cookies,
  })
  return response.json().pawn
}

/** Story + map + pawn, the setup every movement test needs. */
async function createScene(email = 'test@example.com', username = 'testuser') {
  const { cookies } = await registerUser(email, username)

  const storyResponse = await app.inject({
    method: 'POST',
    url: '/my/stories',
    payload: { name: 'Story' },
    cookies,
  })
  const { story } = storyResponse.json()
  const map = await createMap(cookies, story.id, 'Map')
  const pawn = await createPawn(cookies, map.id)

  return { cookies, story, map, pawn }
}

const leg = (startStoryTime: number, endStoryTime: number) => ({
  startStoryTime,
  endStoryTime,
  startX: 0.1,
  startY: 0.2,
  endX: 0.8,
  endY: 0.9,
})

describe('POST /my/pawns/:pawnId/movements', () => {
  test('should create a movement', async () => {
    const { cookies, pawn } = await createScene()

    const response = await app.inject({
      method: 'POST',
      url: `/my/pawns/${pawn.id}/movements`,
      payload: leg(0, 120),
      cookies,
    })

    expect(response.statusCode).toBe(201)
    const { movement } = response.json()
    expect(movement.pawnId).toBe(pawn.id)
    expect(movement.startStoryTime).toBe(0)
    expect(movement.endStoryTime).toBe(120)
    expect(movement.startX).toBe(0.1)
    expect(movement.endY).toBe(0.9)
  })

  test('should derive storyId and mapId from the pawn', async () => {
    const { cookies, story, map, pawn } = await createScene()

    const response = await app.inject({
      method: 'POST',
      url: `/my/pawns/${pawn.id}/movements`,
      payload: leg(0, 120),
      cookies,
    })

    const { movement } = response.json()
    expect(movement.storyId).toBe(story.id)
    expect(movement.mapId).toBe(map.id)
  })

  test('should reject a client-supplied storyId outright', async () => {
    // The body is strict, so there is no path by which a caller can file a movement
    // under a story of its choosing.
    const { cookies, pawn } = await createScene()

    const response = await app.inject({
      method: 'POST',
      url: `/my/pawns/${pawn.id}/movements`,
      payload: { ...leg(0, 120), storyId: 'somewhere-else' },
      cookies,
    })

    expect(response.statusCode).toBe(400)
  })

  test('should honour a client-provided ID', async () => {
    const { cookies, pawn } = await createScene()

    const response = await app.inject({
      method: 'POST',
      url: `/my/pawns/${pawn.id}/movements`,
      payload: { ...leg(0, 120), id: 'client-movement-1' },
      cookies,
    })

    expect(response.statusCode).toBe(201)
    expect(response.json().movement.id).toBe('client-movement-1')
  })

  test('should treat a repeated create as a replay, not a duplicate', async () => {
    const { cookies, pawn } = await createScene()
    const payload = { ...leg(0, 120), id: 'client-movement-1' }

    await app.inject({ method: 'POST', url: `/my/pawns/${pawn.id}/movements`, payload, cookies })
    const replay = await app.inject({ method: 'POST', url: `/my/pawns/${pawn.id}/movements`, payload, cookies })

    expect(replay.statusCode).toBe(201)
    expect(replay.json().movement.id).toBe('client-movement-1')
    expect(await prisma.pawnMovement.count()).toBe(1)
  })

  test('should return 400 when the ID belongs to another pawn', async () => {
    const { cookies, map, pawn } = await createScene()
    const otherPawn = await createPawn(cookies, map.id, 'Ghost')
    const payload = { ...leg(0, 120), id: 'client-movement-1' }

    await app.inject({ method: 'POST', url: `/my/pawns/${pawn.id}/movements`, payload, cookies })

    const response = await app.inject({
      method: 'POST',
      url: `/my/pawns/${otherPawn.id}/movements`,
      payload,
      cookies,
    })

    expect(response.statusCode).toBe(400)
  })

  test('should return 400 when the movement ends before it starts', async () => {
    const { cookies, pawn } = await createScene()

    const response = await app.inject({
      method: 'POST',
      url: `/my/pawns/${pawn.id}/movements`,
      payload: leg(200, 100),
      cookies,
    })

    expect(response.statusCode).toBe(400)
  })

  test('should accept a zero-length movement', async () => {
    // Travel time can round to zero for a very short hop, and the editor emits it.
    const { cookies, pawn } = await createScene()

    const response = await app.inject({
      method: 'POST',
      url: `/my/pawns/${pawn.id}/movements`,
      payload: leg(100, 100),
      cookies,
    })

    expect(response.statusCode).toBe(201)
  })

  test('should accept overlapping movements', async () => {
    // Whether a pawn may be given a leg while already in transit is an authoring
    // decision the editor makes; the API stores what it is told.
    const { cookies, pawn } = await createScene()

    await app.inject({ method: 'POST', url: `/my/pawns/${pawn.id}/movements`, payload: leg(0, 200), cookies })
    const response = await app.inject({
      method: 'POST',
      url: `/my/pawns/${pawn.id}/movements`,
      payload: leg(100, 300),
      cookies,
    })

    expect(response.statusCode).toBe(201)
    expect(await prisma.pawnMovement.count()).toBe(2)
  })

  test('should accept chained movements that share an instant', async () => {
    const { cookies, pawn } = await createScene()

    await app.inject({ method: 'POST', url: `/my/pawns/${pawn.id}/movements`, payload: leg(0, 100), cookies })
    const response = await app.inject({
      method: 'POST',
      url: `/my/pawns/${pawn.id}/movements`,
      payload: leg(100, 200),
      cookies,
    })

    expect(response.statusCode).toBe(201)
  })

  test('should return 404 for a non-existent pawn', async () => {
    const { cookies } = await createScene()

    const response = await app.inject({
      method: 'POST',
      url: '/my/pawns/nonexistent/movements',
      payload: leg(0, 120),
      cookies,
    })

    expect(response.statusCode).toBe(404)
  })

  test('should return 403 for a pawn owned by another user', async () => {
    const { pawn } = await createScene('owner@example.com', 'owner')
    const intruder = await registerUser('intruder@example.com', 'intruder')

    const response = await app.inject({
      method: 'POST',
      url: `/my/pawns/${pawn.id}/movements`,
      payload: leg(0, 120),
      cookies: intruder.cookies,
    })

    expect(response.statusCode).toBe(403)
  })

  test('should return 401 without authentication', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/my/pawns/someid/movements',
      payload: leg(0, 120),
    })

    expect(response.statusCode).toBe(401)
  })
})

describe('GET /my/pawns/:pawnId/movements', () => {
  test('should list a pawn movements sorted by start time', async () => {
    const { cookies, pawn } = await createScene()

    await app.inject({ method: 'POST', url: `/my/pawns/${pawn.id}/movements`, payload: leg(300, 400), cookies })
    await app.inject({ method: 'POST', url: `/my/pawns/${pawn.id}/movements`, payload: leg(0, 100), cookies })

    const response = await app.inject({ method: 'GET', url: `/my/pawns/${pawn.id}/movements`, cookies })

    expect(response.statusCode).toBe(200)
    const { movements } = response.json()
    expect(movements.map((m: { startStoryTime: number }) => m.startStoryTime)).toEqual([0, 300])
  })

  test('should not include another pawn movements', async () => {
    const { cookies, map, pawn } = await createScene()
    const otherPawn = await createPawn(cookies, map.id, 'Ghost')

    await app.inject({ method: 'POST', url: `/my/pawns/${pawn.id}/movements`, payload: leg(0, 100), cookies })
    await app.inject({ method: 'POST', url: `/my/pawns/${otherPawn.id}/movements`, payload: leg(0, 100), cookies })

    const response = await app.inject({ method: 'GET', url: `/my/pawns/${pawn.id}/movements`, cookies })

    expect(response.json().movements).toHaveLength(1)
  })

  test('should return 404 for a non-existent pawn', async () => {
    const { cookies } = await createScene()

    const response = await app.inject({ method: 'GET', url: '/my/pawns/nonexistent/movements', cookies })

    expect(response.statusCode).toBe(404)
  })

  test('should return 403 for a pawn owned by another user', async () => {
    const { pawn } = await createScene('owner@example.com', 'owner')
    const intruder = await registerUser('intruder@example.com', 'intruder')

    const response = await app.inject({
      method: 'GET',
      url: `/my/pawns/${pawn.id}/movements`,
      cookies: intruder.cookies,
    })

    expect(response.statusCode).toBe(403)
  })

  test('should return 401 without authentication', async () => {
    const response = await app.inject({ method: 'GET', url: '/my/pawns/someid/movements' })

    expect(response.statusCode).toBe(401)
  })
})

describe('GET /my/maps/:mapId/pawn-movements', () => {
  test('should list movements for every pawn on the map', async () => {
    const { cookies, map, pawn } = await createScene()
    const otherPawn = await createPawn(cookies, map.id, 'Ghost')

    await app.inject({ method: 'POST', url: `/my/pawns/${pawn.id}/movements`, payload: leg(0, 100), cookies })
    await app.inject({ method: 'POST', url: `/my/pawns/${otherPawn.id}/movements`, payload: leg(50, 150), cookies })

    const response = await app.inject({ method: 'GET', url: `/my/maps/${map.id}/pawn-movements`, cookies })

    expect(response.statusCode).toBe(200)
    expect(response.json().movements).toHaveLength(2)
  })

  test('should exclude movements from another map in the same story', async () => {
    const { cookies, story, map, pawn } = await createScene()
    const otherMap = await createMap(cookies, story.id, 'Other Map')
    const otherPawn = await createPawn(cookies, otherMap.id, 'Elsewhere')

    await app.inject({ method: 'POST', url: `/my/pawns/${pawn.id}/movements`, payload: leg(0, 100), cookies })
    await app.inject({ method: 'POST', url: `/my/pawns/${otherPawn.id}/movements`, payload: leg(0, 100), cookies })

    const response = await app.inject({ method: 'GET', url: `/my/maps/${map.id}/pawn-movements`, cookies })

    expect(response.json().movements).toHaveLength(1)
    expect(response.json().movements[0].mapId).toBe(map.id)
  })

  test('should return 404 for a non-existent map', async () => {
    const { cookies } = await createScene()

    const response = await app.inject({ method: 'GET', url: '/my/maps/nonexistent/pawn-movements', cookies })

    expect(response.statusCode).toBe(404)
  })

  test('should return 403 for a map owned by another user', async () => {
    const { map } = await createScene('owner@example.com', 'owner')
    const intruder = await registerUser('intruder@example.com', 'intruder')

    const response = await app.inject({
      method: 'GET',
      url: `/my/maps/${map.id}/pawn-movements`,
      cookies: intruder.cookies,
    })

    expect(response.statusCode).toBe(403)
  })

  test('should return 401 without authentication', async () => {
    const response = await app.inject({ method: 'GET', url: '/my/maps/someid/pawn-movements' })

    expect(response.statusCode).toBe(401)
  })
})

describe('GET /my/pawn-movements/:id', () => {
  test('should return a single movement', async () => {
    const { cookies, pawn } = await createScene()
    const created = await app.inject({
      method: 'POST',
      url: `/my/pawns/${pawn.id}/movements`,
      payload: leg(0, 120),
      cookies,
    })
    const { movement } = created.json()

    const response = await app.inject({ method: 'GET', url: `/my/pawn-movements/${movement.id}`, cookies })

    expect(response.statusCode).toBe(200)
    expect(response.json().movement.id).toBe(movement.id)
  })

  test('should return 404 for a non-existent movement', async () => {
    const { cookies } = await createScene()

    const response = await app.inject({ method: 'GET', url: '/my/pawn-movements/nonexistent', cookies })

    expect(response.statusCode).toBe(404)
  })

  test('should return 403 for a movement owned by another user', async () => {
    const { cookies, pawn } = await createScene('owner@example.com', 'owner')
    const created = await app.inject({
      method: 'POST',
      url: `/my/pawns/${pawn.id}/movements`,
      payload: leg(0, 120),
      cookies,
    })
    const intruder = await registerUser('intruder@example.com', 'intruder')

    const response = await app.inject({
      method: 'GET',
      url: `/my/pawn-movements/${created.json().movement.id}`,
      cookies: intruder.cookies,
    })

    expect(response.statusCode).toBe(403)
  })

  test('should return 401 without authentication', async () => {
    const response = await app.inject({ method: 'GET', url: '/my/pawn-movements/someid' })

    expect(response.statusCode).toBe(401)
  })
})

describe('PUT /my/pawn-movements/:id', () => {
  async function createMovement() {
    const scene = await createScene()
    const response = await app.inject({
      method: 'POST',
      url: `/my/pawns/${scene.pawn.id}/movements`,
      payload: leg(0, 120),
      cookies: scene.cookies,
    })
    return { ...scene, movement: response.json().movement }
  }

  test('should update part of a movement', async () => {
    const { cookies, movement } = await createMovement()

    const response = await app.inject({
      method: 'PUT',
      url: `/my/pawn-movements/${movement.id}`,
      payload: { endX: 0.42 },
      cookies,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().movement.endX).toBe(0.42)
    expect(response.json().movement.startStoryTime).toBe(0)
  })

  test('should validate the time order against the merged movement', async () => {
    // Only the start time moves here, but it moves past the untouched end time.
    const { cookies, movement } = await createMovement()

    const response = await app.inject({
      method: 'PUT',
      url: `/my/pawn-movements/${movement.id}`,
      payload: { startStoryTime: 999 },
      cookies,
    })

    expect(response.statusCode).toBe(400)
  })

  test('should allow a partial update that keeps the times ordered', async () => {
    const { cookies, movement } = await createMovement()

    const response = await app.inject({
      method: 'PUT',
      url: `/my/pawn-movements/${movement.id}`,
      payload: { endStoryTime: 500 },
      cookies,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().movement.endStoryTime).toBe(500)
  })

  test('should reject an attempt to reassign the pawn', async () => {
    const { cookies, movement } = await createMovement()

    const response = await app.inject({
      method: 'PUT',
      url: `/my/pawn-movements/${movement.id}`,
      payload: { pawnId: 'someone-else' },
      cookies,
    })

    expect(response.statusCode).toBe(400)
  })

  test('should return 404 for a non-existent movement', async () => {
    const { cookies } = await createScene()

    const response = await app.inject({
      method: 'PUT',
      url: '/my/pawn-movements/nonexistent',
      payload: { endX: 0.5 },
      cookies,
    })

    expect(response.statusCode).toBe(404)
  })

  test('should return 403 for a movement owned by another user', async () => {
    const { movement } = await createMovement()
    const intruder = await registerUser('intruder@example.com', 'intruder')

    const response = await app.inject({
      method: 'PUT',
      url: `/my/pawn-movements/${movement.id}`,
      payload: { endX: 0.5 },
      cookies: intruder.cookies,
    })

    expect(response.statusCode).toBe(403)
  })

  test('should return 401 without authentication', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/my/pawn-movements/someid',
      payload: { endX: 0.5 },
    })

    expect(response.statusCode).toBe(401)
  })
})

describe('DELETE /my/pawn-movements/:id', () => {
  test('should delete a movement', async () => {
    const { cookies, pawn } = await createScene()
    const created = await app.inject({
      method: 'POST',
      url: `/my/pawns/${pawn.id}/movements`,
      payload: leg(0, 120),
      cookies,
    })
    const { movement } = created.json()

    const response = await app.inject({ method: 'DELETE', url: `/my/pawn-movements/${movement.id}`, cookies })

    expect(response.statusCode).toBe(200)
    expect(response.json().success).toBe(true)

    const getResponse = await app.inject({ method: 'GET', url: `/my/pawn-movements/${movement.id}`, cookies })
    expect(getResponse.statusCode).toBe(404)
  })

  test('should return 404 when deleting twice', async () => {
    const { cookies, pawn } = await createScene()
    const created = await app.inject({
      method: 'POST',
      url: `/my/pawns/${pawn.id}/movements`,
      payload: leg(0, 120),
      cookies,
    })
    const { movement } = created.json()

    await app.inject({ method: 'DELETE', url: `/my/pawn-movements/${movement.id}`, cookies })
    const response = await app.inject({ method: 'DELETE', url: `/my/pawn-movements/${movement.id}`, cookies })

    expect(response.statusCode).toBe(404)
  })

  test('should return 403 for a movement owned by another user', async () => {
    const { cookies, pawn } = await createScene('owner@example.com', 'owner')
    const created = await app.inject({
      method: 'POST',
      url: `/my/pawns/${pawn.id}/movements`,
      payload: leg(0, 120),
      cookies,
    })
    const intruder = await registerUser('intruder@example.com', 'intruder')

    const response = await app.inject({
      method: 'DELETE',
      url: `/my/pawn-movements/${created.json().movement.id}`,
      cookies: intruder.cookies,
    })

    expect(response.statusCode).toBe(403)
  })

  test('should return 401 without authentication', async () => {
    const response = await app.inject({ method: 'DELETE', url: '/my/pawn-movements/someid' })

    expect(response.statusCode).toBe(401)
  })
})

describe('PawnMovement cascade', () => {
  test('should delete a pawn movements along with the pawn', async () => {
    const { cookies, pawn } = await createScene()
    await app.inject({ method: 'POST', url: `/my/pawns/${pawn.id}/movements`, payload: leg(0, 120), cookies })

    await app.inject({ method: 'DELETE', url: `/my/pawns/${pawn.id}`, cookies })

    expect(await prisma.pawnMovement.count()).toBe(0)
  })
})
