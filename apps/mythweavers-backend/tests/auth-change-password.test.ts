import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { buildApp, cleanDatabase } from './helpers.js'

/**
 * Tests for POST /auth/change-password.
 *
 * Verifies the current-password gate, the password-length validation, and
 * that the new password actually replaces the old one (login with old fails,
 * login with new succeeds).
 */

type SessionCookie = { name: string; value: string }

async function registerUser(
  app: FastifyInstance,
  email: string,
  username: string,
  password = 'old-password-123',
): Promise<SessionCookie> {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email, username, password },
  })
  expect(res.statusCode).toBe(201)
  return res.cookies[0] as SessionCookie
}

describe('POST /auth/change-password', () => {
  let app: FastifyInstance
  let cookie: SessionCookie

  beforeEach(async () => {
    app = await buildApp()
    await cleanDatabase()
    cookie = await registerUser(app, 'alice@example.com', 'alice')
  })

  afterEach(async () => {
    await app.close()
  })

  test('changes the password when the current password is correct', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/change-password',
      cookies: { [cookie.name]: cookie.value },
      payload: { currentPassword: 'old-password-123', newPassword: 'new-password-456' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ success: true })

    // Old password should now fail.
    const loginOld = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'alice', password: 'old-password-123' },
    })
    expect(loginOld.statusCode).toBe(401)

    // New password should succeed.
    const loginNew = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'alice', password: 'new-password-456' },
    })
    expect(loginNew.statusCode).toBe(200)
  })

  test('rejects an incorrect current password with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/change-password',
      cookies: { [cookie.name]: cookie.value },
      payload: { currentPassword: 'wrong-password', newPassword: 'new-password-456' },
    })
    expect(res.statusCode).toBe(401)
  })

  test('rejects a too-short new password with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/change-password',
      cookies: { [cookie.name]: cookie.value },
      payload: { currentPassword: 'old-password-123', newPassword: 'short' },
    })
    expect(res.statusCode).toBe(400)
  })

  test('returns 401 when not authenticated', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/change-password',
      payload: { currentPassword: 'old-password-123', newPassword: 'new-password-456' },
    })
    expect(res.statusCode).toBe(401)
  })
})
