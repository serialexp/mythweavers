import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import type { RawData } from 'ws'

/**
 * WebSocket endpoint for real-time story sync.
 *
 * Currently a no-op — accepts connections and keeps them alive.
 * Story events (message:created, node:updated, etc.) will be broadcast
 * here once the MCP integration needs real-time push.
 */
const wsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get('/ws', { websocket: true }, (socket, _req) => {
    socket.on('message', (raw: RawData) => {
      try {
        const msg = JSON.parse(raw.toString())

        // Handle join-story / leave-story if needed in the future
        if (msg.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong' }))
        }
      } catch {
        // Ignore malformed messages
      }
    })
  })
}

export default wsRoutes
