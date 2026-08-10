/**
 * OAuth discovery documents.
 *
 * These are what turn "paste an mw_ token into your MCP config" into "the
 * client opens a browser and asks". An MCP client that gets a 401 from /mcp
 * reads the `resource_metadata` URL out of the `WWW-Authenticate` header,
 * fetches the protected-resource document here, follows `authorization_servers`
 * to the authorization-server document, and then knows where to register and
 * where to send the user.
 *
 * Both documents are served unauthenticated and are safe to cache. They are
 * hidden from the OpenAPI spec because they are protocol surface, not app API —
 * the generated frontend SDKs have no business calling them.
 */

import type { FastifyPluginAsync } from 'fastify'
import { SCOPES, apiBase, issuer, mcpResourceUri } from '../lib/oauth-urls.js'

const CACHE_CONTROL = 'public, max-age=3600'

function protectedResourceMetadata() {
  return {
    resource: mcpResourceUri(),
    authorization_servers: [issuer()],
    scopes_supported: [...SCOPES],
    bearer_methods_supported: ['header'],
    resource_name: 'MythWeavers',
    resource_documentation: `${apiBase()}/docs`,
  }
}

function authorizationServerMetadata() {
  const base = apiBase()
  return {
    issuer: issuer(),
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    revocation_endpoint: `${base}/oauth/revoke`,
    device_authorization_endpoint: `${base}/oauth/device`,
    scopes_supported: [...SCOPES],
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token', 'urn:ietf:params:oauth:grant-type:device_code'],
    // Public clients only: no secret is issued, so client_id travels in the
    // token request body and nothing needs to be kept confidential.
    token_endpoint_auth_methods_supported: ['none'],
    revocation_endpoint_auth_methods_supported: ['none'],
    code_challenge_methods_supported: ['S256'],
    service_documentation: `${base}/docs`,
  }
}

const wellKnownRoutes: FastifyPluginAsync = async (fastify) => {
  // RFC 9728 §3.1 inserts the well-known segment *before* the resource path, so
  // a resource at /mcp is described at /.well-known/oauth-protected-resource/mcp.
  // The bare path is the fallback clients retry when that 404s.
  for (const url of ['/.well-known/oauth-protected-resource/mcp', '/.well-known/oauth-protected-resource']) {
    fastify.get(url, { schema: { hide: true } }, async (_request, reply) => {
      return reply.header('cache-control', CACHE_CONTROL).send(protectedResourceMetadata())
    })
  }

  // RFC 8414. The issuer is the bare origin, so no path insertion is needed —
  // but the /mcp alias costs nothing and catches clients that insert anyway.
  for (const url of ['/.well-known/oauth-authorization-server', '/.well-known/oauth-authorization-server/mcp']) {
    fastify.get(url, { schema: { hide: true } }, async (_request, reply) => {
      return reply.header('cache-control', CACHE_CONTROL).send(authorizationServerMetadata())
    })
  }
}

export default wellKnownRoutes
