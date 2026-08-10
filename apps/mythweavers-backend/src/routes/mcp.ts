/**
 * MCP endpoint.
 *
 * Exposes the story tools over Streamable HTTP so any MCP client — Claude
 * Code, Claude Desktop, an agent harness — can drive story editing with the
 * same `mw_` bearer tokens the OAuth device flow already mints. The tools
 * themselves call services/story, the same code path as the REST routes.
 */

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { requireMcpAuth } from '../lib/mcp-auth.js'
import { createStoryMcpServer } from '../mcp/server.js'

/**
 * Optional pin: when set, tools may omit storyId and will act on this story.
 * Useful for a single-story deployment or a per-user default; unset by
 * default, in which case callers pass storyId explicitly.
 */
const DEFAULT_STORY_ID = process.env.MYTHWEAVERS_DEFAULT_STORY_ID || undefined

const mcpRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/mcp',
    {
      // Not plain requireAuth: this endpoint is an OAuth 2.1 resource server and
      // must answer a missing or bad token with a WWW-Authenticate challenge
      // naming its metadata document. That header is what makes a client open a
      // browser instead of failing.
      preHandler: requireMcpAuth,
      // The MCP protocol defines its own JSON-RPC envelope and error codes, so
      // this route is deliberately outside the Zod/OpenAPI surface the /my
      // routes use. Hiding it keeps the generated client and docs clean.
      schema: { hide: true },
    },
    // Params are annotated explicitly because @fastify/websocket augments the
    // route overloads, and without them TypeScript resolves this to the
    // WebSocket handler signature.
    async (request: FastifyRequest, reply: FastifyReply) => {
      const server = createStoryMcpServer({
        userId: request.user!.id,
        defaultStoryId: DEFAULT_STORY_ID,
      })

      const transport = new StreamableHTTPServerTransport({
        // Stateless: no session id, a fresh server per request. See mcp/server.ts.
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      })

      // Fastify owns the socket, so hand it back explicitly and make sure both
      // the server and transport are torn down whichever way the request ends.
      reply.raw.on('close', () => {
        void transport.close()
        void server.close()
      })

      try {
        await server.connect(transport)
        // Fastify has already parsed the body; passing it avoids the transport
        // trying to read an exhausted stream.
        await transport.handleRequest(request.raw, reply.raw, request.body)
      } catch (error) {
        fastify.log.error({ err: error }, 'MCP request failed')
        if (!reply.raw.headersSent) {
          reply.raw.writeHead(500, { 'Content-Type': 'application/json' })
          reply.raw.end(
            JSON.stringify({
              jsonrpc: '2.0',
              error: { code: -32603, message: 'Internal server error' },
              id: null,
            }),
          )
        }
      }

      // handleRequest writes to the raw socket directly; tell Fastify not to
      // try to send its own reply on top.
      return reply
    },
  )

  // Streamable HTTP clients probe GET (server-initiated SSE) and DELETE
  // (session teardown). Stateless mode supports neither, and the spec wants an
  // explicit refusal rather than a 404.
  for (const method of ['GET', 'DELETE'] as const) {
    fastify.route({
      method,
      url: '/mcp',
      schema: { hide: true },
      handler: async (_request, reply) => {
        return reply.code(405).send({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Method not allowed: this MCP endpoint is stateless (POST only).' },
          id: null,
        })
      },
    })
  }
}

export default mcpRoutes
