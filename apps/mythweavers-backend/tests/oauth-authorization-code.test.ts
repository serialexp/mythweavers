/**
 * Dynamic registration and the authorization-code flow, end to end.
 *
 * The happy path is driven the way a real client drives it: register, hit
 * /oauth/authorize, follow the redirect to the consent screen, approve, and
 * redeem the code with a PKCE verifier.
 */

import { beforeEach, describe, expect, test } from 'bun:test'
import { createHash, randomBytes } from 'node:crypto'
import { OAuthClientInformationFullSchema } from '@modelcontextprotocol/sdk/shared/auth.js'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../src/lib/prisma.js'
import { buildApp, cleanDatabase } from './helpers.js'

const REDIRECT = 'http://localhost:51763/callback'

function pkcePair() {
  const verifier = randomBytes(32).toString('base64url')
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') }
}

describe('OAuth authorization code flow', () => {
  let app: FastifyInstance
  let sessionCookie: { name: string; value: string }
  let userId: number

  const auth = () => ({ [sessionCookie.name]: sessionCookie.value })

  beforeEach(async () => {
    app = await buildApp()
    await cleanDatabase()

    const register = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'oauth@example.com', username: 'oauthuser', password: 'password123' },
    })
    sessionCookie = register.cookies[0]
    userId = register.json().user.id
  })

  async function registerClient(overrides: Record<string, unknown> = {}) {
    const response = await app.inject({
      method: 'POST',
      url: '/oauth/register',
      payload: { redirect_uris: [REDIRECT], client_name: 'Claude Code', ...overrides },
    })
    return response
  }

  /** Walk authorize → consent → approve and return the parsed callback URL. */
  async function authorizeAndApprove(
    clientId: string,
    challenge: string,
    extra: Record<string, string> = {},
  ): Promise<URL> {
    const query = new URLSearchParams({
      client_id: clientId,
      redirect_uri: REDIRECT,
      response_type: 'code',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      ...extra,
    })
    const authorize = await app.inject({ method: 'GET', url: `/oauth/authorize?${query}` })
    expect(authorize.statusCode).toBe(302)

    const consentUrl = new URL(String(authorize.headers.location))
    const requestId = consentUrl.searchParams.get('request_id')!

    const decision = await app.inject({
      method: 'POST',
      url: `/oauth/consent/${requestId}`,
      cookies: auth(),
      payload: { decision: 'approve' },
    })
    expect(decision.statusCode).toBe(200)
    return new URL(decision.json().redirect_to)
  }

  function tokenRequest(payload: Record<string, string>) {
    return app.inject({
      method: 'POST',
      url: '/oauth/token',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams(payload).toString(),
    })
  }

  describe('POST /oauth/register', () => {
    test('registers a public client the SDK can parse', async () => {
      const response = await registerClient()

      expect(response.statusCode).toBe(201)
      const parsed = OAuthClientInformationFullSchema.parse(response.json())
      expect(parsed.client_id).toMatch(/^mwc_[0-9a-f]{32}$/)
      // Public client: no secret is issued, so nothing has to be kept confidential.
      expect(parsed.client_secret).toBeUndefined()
      expect(parsed.token_endpoint_auth_method).toBe('none')
      expect(parsed.redirect_uris).toEqual([REDIRECT])
    })

    test('echoes back metadata it does not model', async () => {
      const response = await registerClient({ software_statement: 'xyz', some_future_field: 42 })

      expect(response.statusCode).toBe(201)
      expect(response.json().some_future_field).toBe(42)
    })

    test('accepts https and loopback redirect URIs', async () => {
      for (const uri of ['https://claude.ai/api/mcp/auth_callback', 'http://127.0.0.1:9999/cb', 'http://[::1]/cb']) {
        const response = await registerClient({ redirect_uris: [uri] })
        expect(response.statusCode).toBe(201)
      }
    })

    test('rejects plaintext non-loopback, fragments and dangerous schemes', async () => {
      for (const uri of ['http://evil.example/cb', 'javascript:alert(1)', 'https://ok.example/cb#frag', 'not a url']) {
        const response = await registerClient({ redirect_uris: [uri] })
        expect(response.statusCode).toBe(400)
        expect(response.json().error).toBe('invalid_redirect_uri')
      }
    })

    test('rejects confidential clients and unsupported grants', async () => {
      const secretClient = await registerClient({ token_endpoint_auth_method: 'client_secret_post' })
      expect(secretClient.json().error).toBe('invalid_client_metadata')

      const badGrant = await registerClient({ grant_types: ['implicit'] })
      expect(badGrant.json().error).toBe('invalid_client_metadata')
    })

    test('requires at least one redirect URI', async () => {
      const response = await registerClient({ redirect_uris: [] })
      expect(response.statusCode).toBe(400)
      expect(response.json().error).toBe('invalid_redirect_uri')
    })
  })

  describe('GET /oauth/authorize', () => {
    test('redirects to the editor consent page', async () => {
      const { client_id } = (await registerClient()).json()
      const { challenge } = pkcePair()

      const query = new URLSearchParams({
        client_id,
        redirect_uri: REDIRECT,
        response_type: 'code',
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state: 'abc+/=123',
      })
      const response = await app.inject({ method: 'GET', url: `/oauth/authorize?${query}` })

      expect(response.statusCode).toBe(302)
      const location = new URL(String(response.headers.location))
      expect(location.origin).toBe('http://localhost:3203')
      expect(location.pathname).toBe('/oauth/consent')
      expect(location.searchParams.get('request_id')).toMatch(/^[0-9a-f]{64}$/)
    })

    test('an unknown client is rendered, never redirected', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/oauth/authorize?client_id=nope&redirect_uri=${encodeURIComponent(REDIRECT)}&response_type=code`,
      })

      expect(response.statusCode).toBe(401)
      // Redirecting here would make this an open redirector.
      expect(response.headers.location).toBeUndefined()
      expect(response.json().error).toBe('invalid_client')
    })

    test('an unregistered redirect_uri is rendered, never redirected', async () => {
      const { client_id } = (await registerClient()).json()

      const response = await app.inject({
        method: 'GET',
        url: `/oauth/authorize?client_id=${client_id}&redirect_uri=https%3A%2F%2Fevil.example%2Fcb&response_type=code`,
      })

      expect(response.statusCode).toBe(400)
      expect(response.headers.location).toBeUndefined()
    })

    test('accepts a different loopback port than the one registered (RFC 8252)', async () => {
      // Claude Code binds a fresh ephemeral port every run; exact matching would
      // work once and then fail forever.
      const { client_id } = (await registerClient()).json()
      const { challenge } = pkcePair()

      const query = new URLSearchParams({
        client_id,
        redirect_uri: 'http://localhost:44444/callback',
        response_type: 'code',
        code_challenge: challenge,
        code_challenge_method: 'S256',
      })
      const response = await app.inject({ method: 'GET', url: `/oauth/authorize?${query}` })

      expect(response.statusCode).toBe(302)
      expect(String(response.headers.location)).toContain('/oauth/consent')
    })

    test('does not unify localhost with 127.0.0.1', async () => {
      const { client_id } = (await registerClient()).json()
      const { challenge } = pkcePair()

      const query = new URLSearchParams({
        client_id,
        redirect_uri: 'http://127.0.0.1:51763/callback',
        response_type: 'code',
        code_challenge: challenge,
        code_challenge_method: 'S256',
      })
      const response = await app.inject({ method: 'GET', url: `/oauth/authorize?${query}` })

      expect(response.statusCode).toBe(400)
    })

    test('post-validation failures come back as a redirect with state echoed', async () => {
      const { client_id } = (await registerClient()).json()

      const query = new URLSearchParams({
        client_id,
        redirect_uri: REDIRECT,
        response_type: 'token',
        state: 'keep me',
      })
      const response = await app.inject({ method: 'GET', url: `/oauth/authorize?${query}` })

      expect(response.statusCode).toBe(302)
      const location = new URL(String(response.headers.location))
      expect(location.origin).toBe('http://localhost:51763')
      expect(location.searchParams.get('error')).toBe('unsupported_response_type')
      expect(location.searchParams.get('state')).toBe('keep me')
    })

    test('rejects a missing or non-S256 code_challenge', async () => {
      const { client_id } = (await registerClient()).json()

      const missing = await app.inject({
        method: 'GET',
        url: `/oauth/authorize?client_id=${client_id}&redirect_uri=${encodeURIComponent(REDIRECT)}&response_type=code`,
      })
      expect(new URL(String(missing.headers.location)).searchParams.get('error')).toBe('invalid_request')

      const plain = new URLSearchParams({
        client_id,
        redirect_uri: REDIRECT,
        response_type: 'code',
        code_challenge: 'whatever',
        code_challenge_method: 'plain',
      })
      const plainResponse = await app.inject({ method: 'GET', url: `/oauth/authorize?${plain}` })
      expect(new URL(String(plainResponse.headers.location)).searchParams.get('error')).toBe('invalid_request')
    })

    test('rejects a resource that is not on this server', async () => {
      const { client_id } = (await registerClient()).json()
      const { challenge } = pkcePair()

      const query = new URLSearchParams({
        client_id,
        redirect_uri: REDIRECT,
        response_type: 'code',
        code_challenge: challenge,
        code_challenge_method: 'S256',
        resource: 'https://elsewhere.example/mcp',
      })
      const response = await app.inject({ method: 'GET', url: `/oauth/authorize?${query}` })

      expect(new URL(String(response.headers.location)).searchParams.get('error')).toBe('invalid_target')
    })
  })

  describe('consent', () => {
    test('requires authentication, and describes the request once signed in', async () => {
      const { client_id } = (await registerClient()).json()
      const { challenge } = pkcePair()
      const query = new URLSearchParams({
        client_id,
        redirect_uri: REDIRECT,
        response_type: 'code',
        code_challenge: challenge,
        code_challenge_method: 'S256',
      })
      const authorize = await app.inject({ method: 'GET', url: `/oauth/authorize?${query}` })
      const requestId = new URL(String(authorize.headers.location)).searchParams.get('request_id')!

      const anonymous = await app.inject({ method: 'GET', url: `/oauth/consent/${requestId}` })
      expect(anonymous.statusCode).toBe(401)

      const details = await app.inject({ method: 'GET', url: `/oauth/consent/${requestId}`, cookies: auth() })
      expect(details.statusCode).toBe(200)
      const body = details.json()
      expect(body.client_name).toBe('Claude Code')
      // Showing the redirect URI is how a user tells "my own CLI" from an
      // attacker's server.
      expect(body.redirect_uri).toBe(REDIRECT)
      expect(body.scopes.map((s: { scope: string }) => s.scope)).toEqual(['stories:read', 'stories:write'])
      expect(body.scopes[0].description.length).toBeGreaterThan(0)
    })

    test('404s for unknown, expired and already-answered requests', async () => {
      const { client_id } = (await registerClient()).json()
      const { challenge } = pkcePair()

      const unknown = await app.inject({ method: 'GET', url: '/oauth/consent/nope', cookies: auth() })
      expect(unknown.statusCode).toBe(404)

      const callback = await authorizeAndApprove(client_id, challenge)
      expect(callback.searchParams.get('code')).toBeTruthy()

      const requestId = (await prisma.oAuthAuthorizationRequest.findFirst({ where: { clientId: client_id } }))!
        .requestId
      const answered = await app.inject({ method: 'GET', url: `/oauth/consent/${requestId}`, cookies: auth() })
      expect(answered.statusCode).toBe(404)
    })

    test('deny sends access_denied back to the client', async () => {
      const { client_id } = (await registerClient()).json()
      const { challenge } = pkcePair()
      const query = new URLSearchParams({
        client_id,
        redirect_uri: REDIRECT,
        response_type: 'code',
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state: 'st',
      })
      const authorize = await app.inject({ method: 'GET', url: `/oauth/authorize?${query}` })
      const requestId = new URL(String(authorize.headers.location)).searchParams.get('request_id')!

      const decision = await app.inject({
        method: 'POST',
        url: `/oauth/consent/${requestId}`,
        cookies: auth(),
        payload: { decision: 'deny' },
      })

      expect(decision.statusCode).toBe(200)
      const redirect = new URL(decision.json().redirect_to)
      expect(redirect.searchParams.get('error')).toBe('access_denied')
      expect(redirect.searchParams.get('state')).toBe('st')
      expect(redirect.searchParams.get('code')).toBeNull()
    })
  })

  describe('POST /oauth/token (authorization_code)', () => {
    test('the happy path yields a working, audience-bound token pair', async () => {
      const { client_id } = (await registerClient()).json()
      const { verifier, challenge } = pkcePair()

      const callback = await authorizeAndApprove(client_id, challenge, { state: 'xyz' })
      expect(callback.searchParams.get('state')).toBe('xyz')
      const code = callback.searchParams.get('code')!

      const response = await tokenRequest({
        grant_type: 'authorization_code',
        code,
        client_id,
        redirect_uri: REDIRECT,
        code_verifier: verifier,
      })

      expect(response.statusCode).toBe(200)
      expect(response.headers['cache-control']).toBe('no-store')
      const body = response.json()
      expect(body.access_token).toMatch(/^mw_[0-9a-f]{64}$/)
      // The serializer must not swallow these — a strictObject response schema
      // would drop them silently and the client would re-prompt every hour.
      expect(body.refresh_token).toMatch(/^mwr_[0-9a-f]{64}$/)
      expect(body.scope).toBe('stories:read stories:write')
      expect(body.expires_in).toBe(3600)
      expect(body.token_type).toBe('Bearer')

      const stored = await prisma.accessToken.findUnique({ where: { token: body.access_token } })
      expect(stored?.userId).toBe(userId)
      expect(stored?.clientId).toBe(client_id)
      // Audience-bound even though the client never sent a resource parameter.
      expect(stored?.resource).toBe('http://localhost:3201/mcp')

      // And it actually works against /mcp.
      const mcp = await app.inject({
        method: 'POST',
        url: '/mcp',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          authorization: `Bearer ${body.access_token}`,
        },
        payload: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      })
      expect(mcp.statusCode).toBe(200)
    })

    test('carries an explicit resource through to the token', async () => {
      const { client_id } = (await registerClient()).json()
      const { verifier, challenge } = pkcePair()
      const resource = 'http://localhost:3201/mcp'

      const callback = await authorizeAndApprove(client_id, challenge, { resource })
      const response = await tokenRequest({
        grant_type: 'authorization_code',
        code: callback.searchParams.get('code')!,
        client_id,
        redirect_uri: REDIRECT,
        code_verifier: verifier,
        resource,
      })

      expect(response.statusCode).toBe(200)
      const stored = await prisma.accessToken.findUnique({ where: { token: response.json().access_token } })
      expect(stored?.resource).toBe(resource)
    })

    test('rejects a wrong PKCE verifier', async () => {
      const { client_id } = (await registerClient()).json()
      const { challenge } = pkcePair()
      const other = pkcePair()

      const callback = await authorizeAndApprove(client_id, challenge)
      const response = await tokenRequest({
        grant_type: 'authorization_code',
        code: callback.searchParams.get('code')!,
        client_id,
        redirect_uri: REDIRECT,
        code_verifier: other.verifier,
      })

      expect(response.statusCode).toBe(400)
      expect(response.json().error).toBe('invalid_grant')
    })

    test('replaying a code revokes everything the first redemption produced', async () => {
      const { client_id } = (await registerClient()).json()
      const { verifier, challenge } = pkcePair()

      const callback = await authorizeAndApprove(client_id, challenge)
      const code = callback.searchParams.get('code')!

      const first = await tokenRequest({
        grant_type: 'authorization_code',
        code,
        client_id,
        redirect_uri: REDIRECT,
        code_verifier: verifier,
      })
      expect(first.statusCode).toBe(200)
      const issued = first.json()

      const replay = await tokenRequest({
        grant_type: 'authorization_code',
        code,
        client_id,
        redirect_uri: REDIRECT,
        code_verifier: verifier,
      })
      expect(replay.statusCode).toBe(400)
      expect(replay.json().error).toBe('invalid_grant')

      // OAuth 2.1 §4.1.3: we cannot tell which party is the attacker, so the
      // first redemption's tokens die too.
      expect(await prisma.accessToken.findUnique({ where: { token: issued.access_token } })).toBeNull()
      const refresh = await tokenRequest({ grant_type: 'refresh_token', refresh_token: issued.refresh_token })
      expect(refresh.statusCode).toBe(400)
    })

    test('rejects a mismatched client_id or redirect_uri', async () => {
      const { client_id } = (await registerClient()).json()
      const other = (await registerClient({ client_name: 'Other' })).json()
      const { verifier, challenge } = pkcePair()

      const callback = await authorizeAndApprove(client_id, challenge)
      const code = callback.searchParams.get('code')!

      const wrongClient = await tokenRequest({
        grant_type: 'authorization_code',
        code,
        client_id: other.client_id,
        redirect_uri: REDIRECT,
        code_verifier: verifier,
      })
      expect(wrongClient.json().error).toBe('invalid_grant')

      const wrongRedirect = await tokenRequest({
        grant_type: 'authorization_code',
        code,
        client_id,
        redirect_uri: 'http://localhost:51764/callback',
        code_verifier: verifier,
      })
      expect(wrongRedirect.json().error).toBe('invalid_grant')
    })

    test('rejects an expired code', async () => {
      const { client_id } = (await registerClient()).json()
      const { verifier, challenge } = pkcePair()

      const callback = await authorizeAndApprove(client_id, challenge)
      await prisma.oAuthAuthorizationRequest.updateMany({
        where: { clientId: client_id },
        data: { codeExpiresAt: new Date(Date.now() - 1000) },
      })

      const response = await tokenRequest({
        grant_type: 'authorization_code',
        code: callback.searchParams.get('code')!,
        client_id,
        redirect_uri: REDIRECT,
        code_verifier: verifier,
      })

      expect(response.json().error).toBe('invalid_grant')
    })

    test('an unknown grant_type gets a real OAuth error, not a validation dump', async () => {
      const response = await tokenRequest({ grant_type: 'password' })

      expect(response.statusCode).toBe(400)
      // The MCP SDK parses `error` as a machine code; a Fastify validation body
      // makes it report "invalid OAuth error response" and give up.
      expect(response.json().error).toBe('unsupported_grant_type')
      expect(response.json().zodIssues).toBeUndefined()
    })
  })
})
