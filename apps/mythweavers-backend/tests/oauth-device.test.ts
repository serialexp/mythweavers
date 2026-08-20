/**
 * Regression net for the RFC 8628 device authorization grant.
 *
 * These routes predate the authorization-code work and had no test coverage.
 * They are pinned here *before* `/oauth/token` grows grant dispatch, so any
 * behavioural drift in the device flow shows up as a failure rather than as a
 * broken CLI login discovered weeks later.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../src/lib/prisma.js'
import { buildApp, cleanDatabase } from './helpers.js'

const DEVICE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code'

describe('OAuth device flow', () => {
  let app: FastifyInstance
  let sessionCookie: { name: string; value: string }
  let userId: number

  beforeEach(async () => {
    app = await buildApp()
    await cleanDatabase()

    const registerResponse = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: 'device@example.com',
        username: 'deviceuser',
        password: 'password123',
      },
    })

    sessionCookie = registerResponse.cookies[0]
    userId = registerResponse.json().user.id
  })

  afterEach(async () => {
    await app.close()
  })

  async function startDeviceFlow() {
    const response = await app.inject({
      method: 'POST',
      url: '/oauth/device',
      payload: {},
    })
    expect(response.statusCode).toBe(200)
    return response.json() as {
      device_code: string
      user_code: string
      verification_uri: string
      expires_in: number
      interval: number
    }
  }

  describe('POST /oauth/device', () => {
    test('issues a device code, a formatted user code and a local verification URI by default', async () => {
      const body = await startDeviceFlow()

      expect(body.device_code).toMatch(/^[0-9a-f]{64}$/)
      expect(body.user_code).toMatch(/^[A-HJ-NP-Z]{4}-[2-9]{4}$/)
      expect(body.verification_uri).toBe('http://localhost:3203/device')
      expect(body.expires_in).toBe(900)
      expect(body.interval).toBe(5)
    })

    test('derives the public write host from API_URL when EDITOR_URL is unset', async () => {
      const originalApiUrl = process.env.API_URL
      const originalEditorUrl = process.env.EDITOR_URL
      process.env.API_URL = 'https://api.example.com'
      process.env.EDITOR_URL = undefined

      try {
        const body = await startDeviceFlow()
        expect(body.verification_uri).toBe('https://write.example.com/device')
      } finally {
        process.env.API_URL = originalApiUrl
        process.env.EDITOR_URL = originalEditorUrl
      }
    })

    test('persists an unapproved, unowned device code', async () => {
      const body = await startDeviceFlow()

      const record = await prisma.deviceCode.findUnique({ where: { deviceCode: body.device_code } })
      expect(record).not.toBeNull()
      expect(record?.approved).toBe(false)
      expect(record?.userId).toBeNull()
      expect(record?.expiresAt.getTime()).toBeGreaterThan(Date.now())
    })

    test('issues distinct codes across calls', async () => {
      const first = await startDeviceFlow()
      const second = await startDeviceFlow()

      expect(first.device_code).not.toBe(second.device_code)
      expect(first.user_code).not.toBe(second.user_code)
    })
  })

  describe('POST /oauth/token (device grant)', () => {
    test('returns authorization_pending until the user approves', async () => {
      const { device_code } = await startDeviceFlow()

      const response = await app.inject({
        method: 'POST',
        url: '/oauth/token',
        payload: { grant_type: DEVICE_GRANT, device_code },
      })

      expect(response.statusCode).toBe(400)
      expect(response.json().error).toBe('authorization_pending')
    })

    test('returns invalid_request for an unknown device code', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/oauth/token',
        payload: { grant_type: DEVICE_GRANT, device_code: 'nope' },
      })

      expect(response.statusCode).toBe(400)
      expect(response.json().error).toBe('invalid_request')
    })

    test('returns expired_token and deletes the row once the code has expired', async () => {
      const { device_code } = await startDeviceFlow()
      await prisma.deviceCode.update({
        where: { deviceCode: device_code },
        data: { expiresAt: new Date(Date.now() - 1000) },
      })

      const response = await app.inject({
        method: 'POST',
        url: '/oauth/token',
        payload: { grant_type: DEVICE_GRANT, device_code },
      })

      expect(response.statusCode).toBe(400)
      expect(response.json().error).toBe('expired_token')
      expect(await prisma.deviceCode.findUnique({ where: { deviceCode: device_code } })).toBeNull()
    })

    test('mints an audience-less 60-day mw_ token after approval', async () => {
      const { device_code, user_code } = await startDeviceFlow()

      const approve = await app.inject({
        method: 'POST',
        url: '/oauth/approve',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { user_code },
      })
      expect(approve.statusCode).toBe(200)

      const response = await app.inject({
        method: 'POST',
        url: '/oauth/token',
        payload: { grant_type: DEVICE_GRANT, device_code },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.access_token).toMatch(/^mw_[0-9a-f]{64}$/)
      expect(body.token_type).toBe('Bearer')
      expect(body.expires_in).toBe(60 * 24 * 60 * 60)

      const stored = await prisma.accessToken.findUnique({ where: { token: body.access_token } })
      expect(stored?.userId).toBe(userId)
      expect(stored?.name).toBe('Claude Artifact')
      // Device-flow tokens carry no audience. `/mcp` treats a null resource as
      // "valid everywhere", which is what keeps pre-OAuth tokens working.
      expect(stored?.resource ?? null).toBeNull()

      // The device code is consumed, so a second poll cannot mint a second token.
      expect(await prisma.deviceCode.findUnique({ where: { deviceCode: device_code } })).toBeNull()
    })

    test('accepts a form-encoded body as well as JSON', async () => {
      const { device_code, user_code } = await startDeviceFlow()

      await app.inject({
        method: 'POST',
        url: '/oauth/approve',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { user_code },
      })

      const response = await app.inject({
        method: 'POST',
        url: '/oauth/token',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        payload: new URLSearchParams({ grant_type: DEVICE_GRANT, device_code }).toString(),
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().access_token).toMatch(/^mw_[0-9a-f]{64}$/)
    })
  })

  describe('POST /oauth/approve', () => {
    test('requires authentication', async () => {
      const { user_code } = await startDeviceFlow()

      const response = await app.inject({
        method: 'POST',
        url: '/oauth/approve',
        payload: { user_code },
      })

      expect(response.statusCode).toBe(401)
    })

    test('normalizes lowercase and hyphen-less codes', async () => {
      const { user_code } = await startDeviceFlow()
      const mangled = user_code.replace('-', '').toLowerCase()

      const response = await app.inject({
        method: 'POST',
        url: '/oauth/approve',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { user_code: mangled },
      })

      expect(response.statusCode).toBe(200)
      const record = await prisma.deviceCode.findUnique({ where: { userCode: user_code } })
      expect(record?.approved).toBe(true)
      expect(record?.userId).toBe(userId)
    })

    test('404s on an unknown code and 400s on a code already used', async () => {
      const unknown = await app.inject({
        method: 'POST',
        url: '/oauth/approve',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { user_code: 'ZZZZ-9999' },
      })
      expect(unknown.statusCode).toBe(404)

      const { user_code } = await startDeviceFlow()
      const payload = { user_code }
      const cookies = { [sessionCookie.name]: sessionCookie.value }

      expect((await app.inject({ method: 'POST', url: '/oauth/approve', cookies, payload })).statusCode).toBe(200)
      const second = await app.inject({ method: 'POST', url: '/oauth/approve', cookies, payload })
      expect(second.statusCode).toBe(400)
      expect(second.json().error).toBe('Code already used')
    })
  })
})
