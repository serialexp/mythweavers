/**
 * Discovery documents and the CORS carve-out that makes them reachable.
 *
 * The load-bearing assertions here parse our own responses through the MCP
 * SDK's schemas — the exact code a real client runs. Hand-written expectations
 * drift; these cannot.
 */

import { beforeEach, describe, expect, test } from 'bun:test'
import { OAuthMetadataSchema, OAuthProtectedResourceMetadataSchema } from '@modelcontextprotocol/sdk/shared/auth.js'
import type { FastifyInstance } from 'fastify'
import { buildApp } from './helpers.js'

// .env.test sets neither API_URL nor EDITOR_URL, so these are the defaults.
const API_BASE = 'http://localhost:3201'

describe('OAuth discovery', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = await buildApp()
  })

  describe('protected resource metadata (RFC 9728)', () => {
    test('is served at the path-insertion URL and validates against the SDK schema', async () => {
      const response = await app.inject({ method: 'GET', url: '/.well-known/oauth-protected-resource/mcp' })

      expect(response.statusCode).toBe(200)
      const parsed = OAuthProtectedResourceMetadataSchema.parse(response.json())
      expect(parsed.resource).toBe(`${API_BASE}/mcp`)
      expect(parsed.authorization_servers).toEqual([API_BASE])
      expect(parsed.scopes_supported).toEqual(['stories:read', 'stories:write'])
    })

    test('the bare fallback path returns the same document', async () => {
      const inserted = await app.inject({ method: 'GET', url: '/.well-known/oauth-protected-resource/mcp' })
      const bare = await app.inject({ method: 'GET', url: '/.well-known/oauth-protected-resource' })

      expect(bare.statusCode).toBe(200)
      expect(bare.json()).toEqual(inserted.json())
    })

    test('is cacheable', async () => {
      const response = await app.inject({ method: 'GET', url: '/.well-known/oauth-protected-resource/mcp' })
      expect(response.headers['cache-control']).toBe('public, max-age=3600')
    })
  })

  describe('authorization server metadata (RFC 8414)', () => {
    test('validates against the SDK schema and advertises what the flow needs', async () => {
      const response = await app.inject({ method: 'GET', url: '/.well-known/oauth-authorization-server' })

      expect(response.statusCode).toBe(200)
      const parsed = OAuthMetadataSchema.parse(response.json())

      expect(parsed.issuer).toBe(API_BASE)
      expect(parsed.authorization_endpoint).toBe(`${API_BASE}/oauth/authorize`)
      expect(parsed.token_endpoint).toBe(`${API_BASE}/oauth/token`)
      expect(parsed.registration_endpoint).toBe(`${API_BASE}/oauth/register`)
      // Required by the SDK's schema — omitting it makes discovery throw.
      expect(parsed.response_types_supported).toEqual(['code'])
      // PKCE is mandatory and 'plain' is not offered.
      expect(parsed.code_challenge_methods_supported).toEqual(['S256'])
      // Public clients: client_id in the body, no secret.
      expect(parsed.token_endpoint_auth_methods_supported).toEqual(['none'])
      expect(parsed.grant_types_supported).toContain('authorization_code')
      expect(parsed.grant_types_supported).toContain('refresh_token')
      expect(parsed.grant_types_supported).toContain('urn:ietf:params:oauth:grant-type:device_code')
    })

    test('the issuer has no path, so clients never path-insert the AS lookup', async () => {
      const response = await app.inject({ method: 'GET', url: '/.well-known/oauth-authorization-server' })
      expect(new URL(response.json().issuer).pathname).toBe('/')
    })

    test('is also served at the /mcp alias', async () => {
      const response = await app.inject({ method: 'GET', url: '/.well-known/oauth-authorization-server/mcp' })
      expect(response.statusCode).toBe(200)
      expect(response.json().issuer).toBe(API_BASE)
    })
  })

  describe('CORS carve-out', () => {
    test('an unknown origin may read discovery, without credentials', async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/.well-known/oauth-protected-resource/mcp',
        headers: {
          origin: 'https://claude.ai',
          'access-control-request-method': 'GET',
          'access-control-request-headers': 'mcp-protocol-version',
        },
      })

      expect(response.headers['access-control-allow-origin']).toBe('*')
      // credentials must NOT be allowed alongside a wildcard origin
      expect(response.headers['access-control-allow-credentials']).toBeUndefined()
      // allowedHeaders is left unset so the plugin reflects the request headers;
      // this is what lets MCP-Protocol-Version through.
      expect(String(response.headers['access-control-allow-headers']).toLowerCase()).toContain('mcp-protocol-version')
    })

    test('an unknown origin may reach /mcp and /oauth/token', async () => {
      for (const url of ['/mcp', '/oauth/token', '/oauth/register']) {
        const response = await app.inject({
          method: 'OPTIONS',
          url,
          headers: { origin: 'https://claude.ai', 'access-control-request-method': 'POST' },
        })
        expect(response.headers['access-control-allow-origin']).toBe('*')
      }
    })

    test('WWW-Authenticate is exposed, or browser clients can never read the challenge', async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/mcp',
        headers: { origin: 'https://claude.ai', 'access-control-request-method': 'POST' },
      })
      expect(String(response.headers['access-control-expose-headers'])).toContain('WWW-Authenticate')
    })

    test('an unknown origin still gets nothing on a cookie-authenticated route', async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/my/stories',
        headers: { origin: 'https://evil.example', 'access-control-request-method': 'GET' },
      })
      expect(response.headers['access-control-allow-origin']).toBeUndefined()
    })

    test('an allowlisted origin keeps the credentialed policy', async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/my/stories',
        headers: { origin: 'http://localhost:3203', 'access-control-request-method': 'GET' },
      })
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3203')
      expect(response.headers['access-control-allow-credentials']).toBe('true')
    })
  })
})
