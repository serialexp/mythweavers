/**
 * Refresh-token rotation, revocation, and the connections list built on top of
 * them.
 *
 * Rotation is what makes a one-hour access token tolerable, so the failure modes
 * that matter are: the old token must die, a replay must burn the family, and a
 * revoked connection must stop working on the very next request.
 */

import { beforeEach, describe, expect, test } from 'bun:test'
import { createHash, randomBytes } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../src/lib/prisma.js'
import { buildApp, cleanDatabase } from './helpers.js'

const REDIRECT = 'http://localhost:51763/callback'
const MCP_RESOURCE = 'http://localhost:3201/mcp'

describe('OAuth refresh and connections', () => {
  let app: FastifyInstance
  let sessionCookie: { name: string; value: string }
  let clientId: string

  const auth = () => ({ [sessionCookie.name]: sessionCookie.value })

  const tokenRequest = (payload: Record<string, string>) =>
    app.inject({
      method: 'POST',
      url: '/oauth/token',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams(payload).toString(),
    })

  /** Register, authorize, consent, redeem — the whole flow, returning the token pair. */
  async function connect(): Promise<{ access_token: string; refresh_token: string }> {
    const verifier = randomBytes(32).toString('base64url')
    const challenge = createHash('sha256').update(verifier).digest('base64url')

    const query = new URLSearchParams({
      client_id: clientId,
      redirect_uri: REDIRECT,
      response_type: 'code',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    })
    const authorize = await app.inject({ method: 'GET', url: `/oauth/authorize?${query}` })
    const requestId = new URL(String(authorize.headers.location)).searchParams.get('request_id')!

    const decision = await app.inject({
      method: 'POST',
      url: `/oauth/consent/${requestId}`,
      cookies: auth(),
      payload: { decision: 'approve' },
    })
    const code = new URL(decision.json().redirect_to).searchParams.get('code')!

    const token = await tokenRequest({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      redirect_uri: REDIRECT,
      code_verifier: verifier,
    })
    expect(token.statusCode).toBe(200)
    return token.json()
  }

  const callMcp = (bearer: string) =>
    app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: `Bearer ${bearer}`,
      },
      payload: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    })

  beforeEach(async () => {
    app = await buildApp()
    await cleanDatabase()

    const register = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'refresh@example.com', username: 'refreshuser', password: 'password123' },
    })
    sessionCookie = register.cookies[0]

    const client = await app.inject({
      method: 'POST',
      url: '/oauth/register',
      payload: { redirect_uris: [REDIRECT], client_name: 'Claude Code' },
    })
    clientId = client.json().client_id
  })

  describe('grant_type=refresh_token', () => {
    test('rotates both tokens and keeps the connection alive', async () => {
      const first = await connect()

      const response = await tokenRequest({
        grant_type: 'refresh_token',
        refresh_token: first.refresh_token,
        client_id: clientId,
      })

      expect(response.statusCode).toBe(200)
      const second = response.json()
      expect(second.access_token).not.toBe(first.access_token)
      // Rotation, not reuse: a refresh that returned the same refresh token
      // would defeat the whole reuse-detection scheme.
      expect(second.refresh_token).not.toBe(first.refresh_token)
      expect(second.scope).toBe('stories:read stories:write')

      expect((await callMcp(second.access_token)).statusCode).toBe(200)

      // Same family, so the connections list still shows exactly one entry.
      const rows = await prisma.oAuthRefreshToken.findMany({ orderBy: { createdAt: 'asc' } })
      expect(new Set(rows.map((r) => r.familyId)).size).toBe(1)
      expect(rows[0].usedAt).not.toBeNull()
      expect(rows[0].replacedById).toBe(rows[1].id)
    })

    test('carries the audience onto the rotated access token', async () => {
      const first = await connect()

      const response = await tokenRequest({ grant_type: 'refresh_token', refresh_token: first.refresh_token })

      const stored = await prisma.accessToken.findUnique({ where: { token: response.json().access_token } })
      expect(stored?.resource).toBe(MCP_RESOURCE)
    })

    test('reusing a rotated-away token revokes the entire family', async () => {
      const first = await connect()
      const second = (await tokenRequest({ grant_type: 'refresh_token', refresh_token: first.refresh_token })).json()

      const replay = await tokenRequest({ grant_type: 'refresh_token', refresh_token: first.refresh_token })

      expect(replay.statusCode).toBe(400)
      expect(replay.json().error).toBe('invalid_grant')

      // OAuth 2.1 §6.1: we cannot tell the thief from the client, so the live
      // token dies too and the user must re-authorize.
      expect((await callMcp(second.access_token)).statusCode).toBe(401)
      const stillValid = await tokenRequest({ grant_type: 'refresh_token', refresh_token: second.refresh_token })
      expect(stillValid.statusCode).toBe(400)
    })

    test('rejects an unknown, revoked or expired refresh token', async () => {
      const unknown = await tokenRequest({ grant_type: 'refresh_token', refresh_token: `mwr_${'a'.repeat(64)}` })
      expect(unknown.json().error).toBe('invalid_grant')

      const { refresh_token } = await connect()
      await prisma.oAuthRefreshToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } })
      const expired = await tokenRequest({ grant_type: 'refresh_token', refresh_token })
      expect(expired.json().error).toBe('invalid_grant')
    })

    test('rejects a mismatched client_id or resource', async () => {
      const { refresh_token } = await connect()

      const wrongClient = await tokenRequest({
        grant_type: 'refresh_token',
        refresh_token,
        client_id: 'mwc_00000000000000000000000000000000',
      })
      expect(wrongClient.json().error).toBe('invalid_grant')

      const wrongResource = await tokenRequest({
        grant_type: 'refresh_token',
        refresh_token,
        resource: 'https://elsewhere.example/mcp',
      })
      expect(wrongResource.json().error).toBe('invalid_target')
    })

    test('may narrow scope but never widen it', async () => {
      const { refresh_token } = await connect()

      const narrowed = await tokenRequest({
        grant_type: 'refresh_token',
        refresh_token,
        scope: 'stories:read',
      })
      expect(narrowed.statusCode).toBe(200)
      expect(narrowed.json().scope).toBe('stories:read')

      const widened = await tokenRequest({
        grant_type: 'refresh_token',
        refresh_token: narrowed.json().refresh_token,
        scope: 'stories:read stories:write',
      })
      expect(widened.statusCode).toBe(400)
      expect(widened.json().error).toBe('invalid_scope')
    })

    test('requires a refresh_token parameter', async () => {
      const response = await tokenRequest({ grant_type: 'refresh_token' })
      expect(response.statusCode).toBe(400)
      expect(response.json().error).toBe('invalid_request')
    })
  })

  describe('POST /oauth/revoke', () => {
    const revoke = (payload: Record<string, string>) =>
      app.inject({
        method: 'POST',
        url: '/oauth/revoke',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        payload: new URLSearchParams(payload).toString(),
      })

    test('revoking an access token kills its family', async () => {
      const tokens = await connect()

      const response = await revoke({ token: tokens.access_token })

      expect(response.statusCode).toBe(200)
      expect((await callMcp(tokens.access_token)).statusCode).toBe(401)
      expect(
        (await tokenRequest({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token })).statusCode,
      ).toBe(400)
    })

    test('revoking a refresh token kills its family', async () => {
      const tokens = await connect()

      await revoke({ token: tokens.refresh_token, token_type_hint: 'refresh_token' })

      expect((await callMcp(tokens.access_token)).statusCode).toBe(401)
    })

    test('an unknown token still returns 200 (RFC 7009)', async () => {
      // Anything else turns this endpoint into a token oracle.
      const response = await revoke({ token: 'mw_nope' })
      expect(response.statusCode).toBe(200)
    })
  })

  describe('GET /my/access-tokens', () => {
    test('lists one row per connection, not per access token', async () => {
      const tokens = await connect()
      // Chain the rotations — presenting the same refresh token twice would be
      // a reuse and would (correctly) destroy the connection.
      let current = tokens.refresh_token
      for (let i = 0; i < 2; i++) {
        const rotated = await tokenRequest({ grant_type: 'refresh_token', refresh_token: current })
        expect(rotated.statusCode).toBe(200)
        current = rotated.json().refresh_token
      }

      const response = await app.inject({ method: 'GET', url: '/my/access-tokens', cookies: auth() })

      expect(response.statusCode).toBe(200)
      const { connections } = response.json()
      // Three access tokens exist by now; the user should see one connection.
      expect(connections).toHaveLength(1)
      expect(connections[0].kind).toBe('oauth')
      expect(connections[0].name).toBe('Claude Code')
      expect(connections[0].clientId).toBe(clientId)
      expect(connections[0].resource).toBe(MCP_RESOURCE)
    })

    test('includes device-flow and manual tokens as standalone entries', async () => {
      await connect()
      const userId = (await prisma.user.findFirstOrThrow()).id
      await prisma.accessToken.create({
        data: { userId, token: `mw_${'c'.repeat(64)}`, name: 'My laptop' },
      })

      const response = await app.inject({ method: 'GET', url: '/my/access-tokens', cookies: auth() })

      const { connections } = response.json()
      expect(connections).toHaveLength(2)
      const standalone = connections.find((c: { kind: string }) => c.kind === 'token')
      expect(standalone.name).toBe('My laptop')
      expect(standalone.clientId).toBeNull()
    })

    test('requires authentication', async () => {
      const response = await app.inject({ method: 'GET', url: '/my/access-tokens' })
      expect(response.statusCode).toBe(401)
    })

    test('never shows another user their connections', async () => {
      await connect()

      const other = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'other@example.com', username: 'otheruser', password: 'password123' },
      })
      const response = await app.inject({
        method: 'GET',
        url: '/my/access-tokens',
        cookies: { [other.cookies[0].name]: other.cookies[0].value },
      })

      expect(response.json().connections).toHaveLength(0)
    })
  })

  describe('DELETE /my/access-tokens/:id', () => {
    test('revoking a connection kills the token on the next request', async () => {
      const tokens = await connect()
      const list = await app.inject({ method: 'GET', url: '/my/access-tokens', cookies: auth() })
      const id = list.json().connections[0].id

      const response = await app.inject({ method: 'DELETE', url: `/my/access-tokens/${id}`, cookies: auth() })

      expect(response.statusCode).toBe(200)
      expect((await callMcp(tokens.access_token)).statusCode).toBe(401)
      expect(
        (await tokenRequest({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token })).statusCode,
      ).toBe(400)
      const after = await app.inject({ method: 'GET', url: '/my/access-tokens', cookies: auth() })
      expect(after.json().connections).toHaveLength(0)
    })

    test('deletes a standalone token', async () => {
      const userId = (await prisma.user.findFirstOrThrow()).id
      const token = await prisma.accessToken.create({
        data: { userId, token: `mw_${'d'.repeat(64)}`, name: 'Manual' },
      })

      const response = await app.inject({ method: 'DELETE', url: `/my/access-tokens/${token.id}`, cookies: auth() })

      expect(response.statusCode).toBe(200)
      expect(await prisma.accessToken.findUnique({ where: { id: token.id } })).toBeNull()
    })

    test('cannot revoke a connection belonging to someone else', async () => {
      await connect()
      const list = await app.inject({ method: 'GET', url: '/my/access-tokens', cookies: auth() })
      const id = list.json().connections[0].id

      const other = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'thief@example.com', username: 'thief', password: 'password123' },
      })
      const response = await app.inject({
        method: 'DELETE',
        url: `/my/access-tokens/${id}`,
        cookies: { [other.cookies[0].name]: other.cookies[0].value },
      })

      expect(response.statusCode).toBe(404)
      // And the real owner's connection is untouched.
      const still = await app.inject({ method: 'GET', url: '/my/access-tokens', cookies: auth() })
      expect(still.json().connections).toHaveLength(1)
    })

    test('404s for an unknown id', async () => {
      const response = await app.inject({ method: 'DELETE', url: '/my/access-tokens/nope', cookies: auth() })
      expect(response.statusCode).toBe(404)
    })
  })
})
