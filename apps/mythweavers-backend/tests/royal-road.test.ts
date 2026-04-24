import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../src/lib/prisma.js'
import { buildApp, cleanDatabase } from './helpers.js'

/**
 * Covers Phase A Royal Road account endpoints:
 *   GET    /my/royal-road/account
 *   POST   /my/royal-road/account
 *   DELETE /my/royal-road/account
 *
 * What we verify:
 *   - Connection status for a brand-new user (disconnected)
 *   - Connecting stores credentials, encrypted (plaintext never in DB)
 *   - Reconnecting rotates the password and clears session/error state
 *   - Disconnecting wipes the row
 *   - 401 on every endpoint without a session
 *   - 400 on invalid email / empty password
 *   - Isolation between users (user A cannot see user B's account)
 */

type SessionCookie = { name: string; value: string }

async function registerUser(
  app: FastifyInstance,
  email: string,
  username: string,
): Promise<SessionCookie> {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email, username, password: 'password123' },
  })
  return response.cookies[0] as SessionCookie
}

// A well-formed 32-byte base64 key for AES-256-GCM. The value only needs to
// be stable across a single test run so encrypt/decrypt round-trips work.
const TEST_ENC_KEY = 'abcdefghijklmnopqrstuvwxyz012345ABCDEFGHIJK='
// Decoded length sanity check: the crypto module validates this at use time.

describe('Royal Road account endpoints', () => {
  let app: FastifyInstance
  const originalEncKey = process.env.ROYAL_ROAD_ENC_KEY

  beforeAll(async () => {
    process.env.ROYAL_ROAD_ENC_KEY = TEST_ENC_KEY
    app = await buildApp()
  })

  afterAll(async () => {
    await app.close()
    if (originalEncKey === undefined) {
      delete process.env.ROYAL_ROAD_ENC_KEY
    } else {
      process.env.ROYAL_ROAD_ENC_KEY = originalEncKey
    }
  })

  beforeEach(async () => {
    await cleanDatabase()
  })

  test('GET /my/royal-road/account returns disconnected for a fresh user', async () => {
    const cookie = await registerUser(app, 'rr-a@example.com', 'rrA')

    const res = await app.inject({
      method: 'GET',
      url: '/my/royal-road/account',
      cookies: { [cookie.name]: cookie.value },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      connected: false,
      email: null,
      lastLoginAt: null,
      lastError: null,
    })
  })

  test('POST /my/royal-road/account connects, encrypts password, and never returns it', async () => {
    const cookie = await registerUser(app, 'rr-b@example.com', 'rrB')

    const res = await app.inject({
      method: 'POST',
      url: '/my/royal-road/account',
      cookies: { [cookie.name]: cookie.value },
      payload: { email: 'writer@example.com', password: 'super-secret' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.connected).toBe(true)
    expect(body.email).toBe('writer@example.com')
    expect(body.lastLoginAt).toBeNull()
    expect(body.lastError).toBeNull()
    // Response must not leak the plaintext password under any key.
    expect(JSON.stringify(body)).not.toContain('super-secret')

    const stored = await prisma.royalRoadAccount.findFirst({
      where: { email: 'writer@example.com' },
    })
    expect(stored).not.toBeNull()
    // Encrypted blob must not contain the plaintext.
    expect(stored!.encryptedPassword).not.toContain('super-secret')
    expect(stored!.encryptedPassword.length).toBeGreaterThan(0)
    expect(stored!.storageStateJson).toBeNull()
  })

  test('POST /my/royal-road/account re-connect rotates credentials and resets session state', async () => {
    const cookie = await registerUser(app, 'rr-c@example.com', 'rrC')

    // Initial connect.
    await app.inject({
      method: 'POST',
      url: '/my/royal-road/account',
      cookies: { [cookie.name]: cookie.value },
      payload: { email: 'writer@example.com', password: 'old-password' },
    })

    // Simulate a prior worker run: storageState cached and an outstanding error.
    await prisma.royalRoadAccount.updateMany({
      where: { email: 'writer@example.com' },
      data: {
        storageStateJson: { cookies: ['fake'] },
        lastError: 'Login failed: captcha',
        lastLoginAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    })

    const before = await prisma.royalRoadAccount.findFirst({
      where: { email: 'writer@example.com' },
    })
    const oldEncrypted = before!.encryptedPassword

    // Re-connect with a new password.
    const res = await app.inject({
      method: 'POST',
      url: '/my/royal-road/account',
      cookies: { [cookie.name]: cookie.value },
      payload: { email: 'writer@example.com', password: 'new-password' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().lastError).toBeNull()

    const after = await prisma.royalRoadAccount.findFirst({
      where: { email: 'writer@example.com' },
    })
    expect(after!.encryptedPassword).not.toBe(oldEncrypted)
    expect(after!.storageStateJson).toBeNull()
    expect(after!.lastError).toBeNull()
  })

  test('DELETE /my/royal-road/account disconnects', async () => {
    const cookie = await registerUser(app, 'rr-d@example.com', 'rrD')
    await app.inject({
      method: 'POST',
      url: '/my/royal-road/account',
      cookies: { [cookie.name]: cookie.value },
      payload: { email: 'writer@example.com', password: 'secret' },
    })

    const del = await app.inject({
      method: 'DELETE',
      url: '/my/royal-road/account',
      cookies: { [cookie.name]: cookie.value },
    })
    expect(del.statusCode).toBe(200)
    expect(del.json()).toEqual({ success: true })

    const status = await app.inject({
      method: 'GET',
      url: '/my/royal-road/account',
      cookies: { [cookie.name]: cookie.value },
    })
    expect(status.json().connected).toBe(false)
  })

  test('all endpoints require authentication', async () => {
    const get = await app.inject({ method: 'GET', url: '/my/royal-road/account' })
    expect(get.statusCode).toBe(401)

    const post = await app.inject({
      method: 'POST',
      url: '/my/royal-road/account',
      payload: { email: 'a@b.com', password: 'x' },
    })
    expect(post.statusCode).toBe(401)

    const del = await app.inject({ method: 'DELETE', url: '/my/royal-road/account' })
    expect(del.statusCode).toBe(401)
  })

  test('POST rejects invalid email and empty password', async () => {
    const cookie = await registerUser(app, 'rr-e@example.com', 'rrE')

    const badEmail = await app.inject({
      method: 'POST',
      url: '/my/royal-road/account',
      cookies: { [cookie.name]: cookie.value },
      payload: { email: 'not-an-email', password: 'x' },
    })
    expect(badEmail.statusCode).toBe(400)

    const emptyPw = await app.inject({
      method: 'POST',
      url: '/my/royal-road/account',
      cookies: { [cookie.name]: cookie.value },
      payload: { email: 'writer@example.com', password: '' },
    })
    expect(emptyPw.statusCode).toBe(400)
  })

  test('users are isolated from each other', async () => {
    const cookieA = await registerUser(app, 'rr-f@example.com', 'rrF')
    const cookieB = await registerUser(app, 'rr-g@example.com', 'rrG')

    // A connects.
    await app.inject({
      method: 'POST',
      url: '/my/royal-road/account',
      cookies: { [cookieA.name]: cookieA.value },
      payload: { email: 'A@rr.com', password: 'a-secret' },
    })

    // B still reads disconnected.
    const bStatus = await app.inject({
      method: 'GET',
      url: '/my/royal-road/account',
      cookies: { [cookieB.name]: cookieB.value },
    })
    expect(bStatus.json().connected).toBe(false)

    // B's DELETE must not touch A's account.
    await app.inject({
      method: 'DELETE',
      url: '/my/royal-road/account',
      cookies: { [cookieB.name]: cookieB.value },
    })
    const aStillConnected = await prisma.royalRoadAccount.findFirst({
      where: { email: 'A@rr.com' },
    })
    expect(aStillConnected).not.toBeNull()
  })
})
