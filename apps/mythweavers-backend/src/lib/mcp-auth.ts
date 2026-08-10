/**
 * Authentication for the MCP resource endpoint.
 *
 * This is `requireAuth` with two additions the MCP authorization spec requires
 * of a resource server: a `WWW-Authenticate` challenge pointing at the
 * protected-resource metadata document, and RFC 8707 audience validation.
 *
 * The challenge is the whole reason this file exists, and getting it delivered
 * is fiddlier than it looks. Fastify 5 does *not* short-circuit on a preHandler
 * that sends: `hookIterator` checks `reply.sent` only between hooks, and
 * `preHandlerCallbackInner` calls the route handler unconditionally — which for
 * /mcp means writing to `reply.raw` on an already-sent response. So the header
 * is set on the reply and then a 401 is thrown, the same shape `requireAuth`
 * uses. The global error handler in `src/index.ts` reuses that same reply
 * object, so headers set before the throw survive into the response.
 */

import { checkResourceAllowed } from '@modelcontextprotocol/sdk/shared/auth-utils.js'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { getUserFromSession, requireTrustedCookieOrigin } from './auth.js'
import { mcpResourceUri, prmUrl } from './oauth-urls.js'
import { prisma } from './prisma.js'

/**
 * Build a `WWW-Authenticate: Bearer …` value.
 *
 * `resource_metadata` is always present, including on the no-token case: a bare
 * `Bearer` with no parameters is rejected by the MCP SDK's parser, so omitting
 * it would leave a client with nothing to discover.
 */
function challenge(error?: string, description?: string): string {
  const params: string[] = []
  if (error) {
    params.push(`error="${error}"`)
    if (description) params.push(`error_description="${description}"`)
  }
  params.push(`resource_metadata="${prmUrl()}"`)
  return `Bearer ${params.join(', ')}`
}

/**
 * Attach the challenge and throw a 401.
 *
 * `message` becomes the response body's `error` field via the global error
 * handler, so it is a machine code (`invalid_token`) rather than prose; the
 * human-readable part rides along in the header, which is where a client looks
 * for it anyway.
 */
function unauthorized(reply: FastifyReply, message: string, error?: string, description?: string): never {
  reply.header('WWW-Authenticate', challenge(error, description))
  const err = new Error(message) as Error & { statusCode?: number }
  err.statusCode = 401
  throw err
}

export async function requireMcpAuth(request: FastifyRequest, reply: FastifyReply) {
  requireTrustedCookieOrigin(request)

  const authHeader = request.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const record = token ? await prisma.accessToken.findUnique({ where: { token }, include: { user: true } }) : null

    if (!record || (record.expiresAt && record.expiresAt < new Date())) {
      // Note: unlike getUserFromAccessToken, an expired row is NOT deleted here.
      // With a one-hour TTL that delete would race the refresh flow; the cleanup
      // scheduler sweeps them instead.
      unauthorized(reply, 'invalid_token', 'invalid_token', 'The access token is expired or unknown')
    }

    // A null resource means a device-flow token, a hand-made token, or anything
    // minted before the authorization-code flow existed. Those are audience-less
    // bearer credentials and stay valid everywhere — this null check is the
    // entire backwards-compatibility story.
    if (record.resource && !isResourceAcceptable(record.resource)) {
      // 401 rather than 403 on purpose: `invalid_token` makes an MCP client
      // re-run discovery and recover, where 403 makes it give up.
      unauthorized(reply, 'invalid_token', 'invalid_token', 'Token audience does not cover this resource')
    }

    void prisma.accessToken.update({ where: { id: record.id }, data: { lastUsed: new Date() } }).catch(() => {})
    request.user = record.user
    return
  }

  // Cookie fallback, so an authenticated browser session can drive /mcp too.
  const user = await getUserFromSession(request)
  if (!user) {
    unauthorized(reply, 'Authentication required')
  }
  request.user = user
}

function isResourceAcceptable(resource: string): boolean {
  try {
    return checkResourceAllowed({ requestedResource: mcpResourceUri(), configuredResource: resource })
  } catch {
    return false
  }
}
