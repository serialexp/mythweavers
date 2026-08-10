/**
 * The 401 that starts the whole browser flow.
 *
 * If `WWW-Authenticate` is missing or malformed, an MCP client sees an opaque
 * 401 and gives up — which is indistinguishable from "this server doesn't do
 * OAuth". These tests pin the header's shape and the audience rule that keeps
 * pre-OAuth tokens working.
 */

import { beforeEach, describe, expect, test } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../src/lib/prisma.js'
import { buildApp, cleanDatabase } from './helpers.js'

const PRM_URL = 'http://localhost:3201/.well-known/oauth-protected-resource/mcp'

describe('MCP 401 challenge', () => {
  let app: FastifyInstance
  let userId: number

  const post = (bearer?: string) =>
    app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
      },
      payload: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    })

  async function mintToken(overrides: { expiresAt?: Date | null; resource?: string | null } = {}) {
    const token = `mw_${Math.random().toString(16).slice(2).padEnd(64, '0').slice(0, 64)}`
    await prisma.accessToken.create({
      data: {
        userId,
        token,
        name: 'test',
        expiresAt: overrides.expiresAt === undefined ? new Date(Date.now() + 3600_000) : overrides.expiresAt,
        resource: overrides.resource ?? null,
      },
    })
    return token
  }

  beforeEach(async () => {
    app = await buildApp()
    await cleanDatabase()

    const register = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'mcpauth@example.com', username: 'mcpauth', password: 'password123' },
    })
    userId = register.json().user.id
  })

  test('no token: 401 carrying resource_metadata', async () => {
    const response = await post()

    expect(response.statusCode).toBe(401)
    const header = response.headers['www-authenticate']
    expect(header).toBeDefined()
    // A bare "Bearer" with no parameters is rejected by the SDK's parser, so
    // resource_metadata must be present even when there is no token to fault.
    expect(String(header)).toBe(`Bearer resource_metadata="${PRM_URL}"`)
  })

  test('unknown token: 401 with invalid_token and the metadata URL', async () => {
    const response = await post(`mw_${'b'.repeat(64)}`)

    expect(response.statusCode).toBe(401)
    const header = String(response.headers['www-authenticate'])
    expect(header).toStartWith('Bearer ')
    expect(header).toContain('error="invalid_token"')
    expect(header).toContain(`resource_metadata="${PRM_URL}"`)
    expect(response.json().error).toBe('invalid_token')
  })

  test('expired token: 401, and the row is left for the sweeper', async () => {
    const token = await mintToken({ expiresAt: new Date(Date.now() - 1000) })

    const response = await post(token)

    expect(response.statusCode).toBe(401)
    expect(String(response.headers['www-authenticate'])).toContain('error="invalid_token"')
    // Deliberately not deleted here: with a one-hour TTL that delete would race
    // the refresh flow.
    expect(await prisma.accessToken.findUnique({ where: { token } })).not.toBeNull()
  })

  test('token bound to another resource: 401 invalid_token, not 403', async () => {
    const token = await mintToken({ resource: 'https://other.example/mcp' })

    const response = await post(token)

    // 401 rather than 403 on purpose: it makes a client re-run discovery and
    // recover, where 403 makes it give up.
    expect(response.statusCode).toBe(401)
    expect(String(response.headers['www-authenticate'])).toContain('error="invalid_token"')
  })

  test('token bound to this resource is accepted', async () => {
    const token = await mintToken({ resource: 'http://localhost:3201/mcp' })

    const response = await post(token)

    expect(response.statusCode).toBe(200)
  })

  test('audience-less token is accepted — the device flow keeps working', async () => {
    // This is the entire backwards-compatibility story: a null resource means a
    // device-flow token, a hand-made token, or anything minted before OAuth.
    const token = await mintToken({ resource: null })

    const response = await post(token)

    expect(response.statusCode).toBe(200)
  })

  test('a never-expiring token still works', async () => {
    const token = await mintToken({ expiresAt: null })

    const response = await post(token)

    expect(response.statusCode).toBe(200)
  })
})
