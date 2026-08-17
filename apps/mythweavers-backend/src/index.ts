import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import formbody from '@fastify/formbody'
import multipart from '@fastify/multipart'
import swagger from '@fastify/swagger'
import websocket from '@fastify/websocket'
import scalar from '@scalar/fastify-api-reference'
import Fastify, { type FastifyError } from 'fastify'
import {
  fastifyZodOpenApiPlugin,
  fastifyZodOpenApiTransformers,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-zod-openapi'
import { z } from 'zod'

// Get version from package.json
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packageJson = JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf-8'))
const VERSION = packageJson.version
import { corsDelegator } from './lib/cors.js'
import { startCostSyncScheduler, stopCostSyncScheduler } from './lib/cost-sync-scheduler.js'
import { startOAuthCleanupScheduler, stopOAuthCleanupScheduler } from './lib/oauth-cleanup-scheduler.js'
import { assertOAuthUrlsSane } from './lib/oauth-urls.js'
import { prisma } from './lib/prisma.js'
import { registerApplicationRoutes } from './register-routes.js'
import { startWorker as startRoyalRoadWorker, stopWorker as stopRoyalRoadWorker } from './workers/royal-road.js'

const PORT = process.env.PORT ? Number.parseInt(process.env.PORT) : 3201
const HOST = process.env.HOST || '0.0.0.0'
const LOG_LEVEL = process.env.LOG_LEVEL || 'info'

const server = Fastify({
  bodyLimit: 20 * 1024 * 1024, // 20MB
  logger: {
    level: LOG_LEVEL,
    serializers: {
      req(req) {
        return {
          method: req.method,
          url: req.url,
          headers: sanitizeHeaders(req.headers),
        }
      },
    },
  },
})

// Every URL an OAuth client is told to use derives from API_URL. A trailing
// slash or a stray path makes the resource identifier mismatch what clients
// compute, and they fail discovery before a request ever reaches us — so fail
// loudly at boot instead.
assertOAuthUrlsSane()

// Set Zod validator and serializer compilers
server.setValidatorCompiler(validatorCompiler)
server.setSerializerCompiler(serializerCompiler)

// Sanitize sensitive headers from logs
function sanitizeHeaders(headers: Record<string, unknown>) {
  const sanitized = { ...headers }
  if (sanitized.authorization) sanitized.authorization = '[REDACTED]'
  if (sanitized.cookie) sanitized.cookie = '[REDACTED]'
  return sanitized
}

// Credentialed CORS uses an explicit allowlist; requests without an Origin
// header (CLI/server-to-server) remain valid. The OAuth discovery surface and
// /mcp are additionally reachable from any origin, without credentials — see
// corsDelegator.
await server.register(cors, { delegator: corsDelegator })

// Cookie support (required for session management)
await server.register(cookie, {
  secret: process.env.COOKIE_SECRET || 'changeme-in-production',
  parseOptions: {},
})

// Form body support
await server.register(formbody)

// Multipart support (for file uploads)
await server.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
})

// WebSocket support (for real-time sync)
await server.register(websocket)

// Register fastify-zod-openapi plugin
await server.register(fastifyZodOpenApiPlugin)

// Register @fastify/swagger with transformers for OpenAPI generation
await server.register(swagger, {
  openapi: {
    info: {
      title: 'Writer Unified API',
      description: 'Unified backend API for Writer2 and Story projects',
      version: VERSION,
    },
    openapi: '3.1.0',
    servers: [
      {
        url: process.env.API_URL || `http://localhost:${PORT}`,
        description: 'API Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        sessionAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'sessionToken',
        },
      },
    },
  },
  ...fastifyZodOpenApiTransformers,
})

// Scalar API Reference (better than Swagger UI)
await server.register(scalar, {
  routePrefix: '/docs',
  configuration: {
    theme: 'purple',
    layout: 'modern',
    defaultHttpClient: {
      targetKey: 'javascript',
      clientKey: 'fetch',
    },
  },
})

// Custom error handler to format errors consistently
server.setErrorHandler((error: FastifyError, request, reply) => {
  const statusCode = error.statusCode || 500

  // Log error details with extra info for validation errors
  if (statusCode >= 500) {
    // Log the entire error object to see its structure
    server.log.error(
      {
        error: error.message,
        stack: error.stack,
        validation: error.validation, // Fastify validation errors
        code: error.code,
        url: request.url,
        method: request.method,
        // Include the entire error object to see all properties
        fullError: JSON.parse(JSON.stringify(error, Object.getOwnPropertyNames(error))),
      },
      'Server error',
    )
  }

  // Build error response with validation details
  const errorResponse: Record<string, unknown> = {
    error: error.message || 'Internal Server Error',
  }

  // Include validation details if present (Fastify validation)
  if (error.validation) {
    errorResponse.validation = error.validation
  }

  // Include Zod validation issues if present
  if ('issues' in error) {
    errorResponse.zodIssues = error.issues
  }

  // In development, include full error details
  if (process.env.NODE_ENV !== 'production' && statusCode >= 500) {
    errorResponse.stack = error.stack
    // Include all error properties for debugging
    errorResponse.debug = JSON.parse(JSON.stringify(error, Object.getOwnPropertyNames(error)))
  }

  // Send formatted error response
  return reply.status(statusCode).send(errorResponse)
})

// Request lifecycle hooks
server.addHook('onRequest', async (request, _reply) => {
  request.startTime = Date.now()
})

server.addHook('onResponse', async (request, reply) => {
  const duration = Date.now() - (request.startTime || Date.now())
  const level = reply.statusCode >= 500 ? 'error' : reply.statusCode >= 400 ? 'warn' : 'info'

  server.log[level]({
    method: request.method,
    url: request.url,
    statusCode: reply.statusCode,
    duration,
  })
})

// Health check
const healthResponseSchema = z.strictObject({
  status: z.string().meta({ example: 'ok' }),
  version: z.string().meta({ example: '1.0.0' }),
  timestamp: z.string().meta({ example: '2025-12-05T12:00:00.000Z' }),
})

server.get(
  '/health',
  {
    schema: {
      description: 'Health check endpoint',
      tags: ['system'],
      response: {
        200: healthResponseSchema,
      },
    },
  },
  async (_request, _reply) => {
    return {
      status: 'ok',
      version: VERSION,
      timestamp: new Date().toISOString(),
    }
  },
)

await registerApplicationRoutes(server)

// Bootstrap admin accounts from env var (comma-separated emails)
const adminEmails = process.env.ADMIN_EMAILS?.split(',')
  .map((e) => e.trim())
  .filter(Boolean)
if (adminEmails?.length) {
  const result = await prisma.user.updateMany({
    where: { email: { in: adminEmails }, role: { not: 'admin' } },
    data: { role: 'admin' },
  })
  if (result.count > 0) {
    server.log.info(`Promoted ${result.count} user(s) to admin via ADMIN_EMAILS`)
  }
}

// Start server
try {
  await server.listen({ port: PORT, host: HOST })
  server.log.info(`Server listening on http://${HOST}:${PORT}`)
  server.log.info(`OpenAPI docs available at http://${HOST}:${PORT}/docs`)

  // Start background cost sync scheduler
  startCostSyncScheduler(server.log)
  startOAuthCleanupScheduler(server.log)

  // Start Royal Road publishing worker (no-op unless ROYAL_ROAD_WORKER_ENABLED=true)
  startRoyalRoadWorker(server.log)
} catch (err) {
  server.log.error(err)
  process.exit(1)
}

// Development restarts must release the listener immediately. `server.close()`
// waits for every HTTP/WebSocket peer and can leave the watcher racing an old
// process that still owns port 3201. In production we retain the bounded,
// graceful drain below.
const signals = ['SIGINT', 'SIGTERM'] as const

if (process.env.NODE_ENV === 'development') {
  for (const signal of signals) {
    process.once(signal, () => {
      process.exit(0)
    })
  }
} else {
  const SHUTDOWN_TIMEOUT_MS = 5000
  let shuttingDown = false

  for (const signal of signals) {
    process.on(signal, async () => {
      if (shuttingDown) return
      shuttingDown = true
      server.log.info(`Received ${signal}, closing server...`)
      stopCostSyncScheduler()
      stopOAuthCleanupScheduler()
      stopRoyalRoadWorker()

      // Backstop: server.close() can stall indefinitely on connections whose
      // peer never finishes closing (suspended laptop, killed browser), so
      // force-exit if graceful shutdown doesn't complete in time.
      const forceExitTimer = setTimeout(() => {
        server.log.warn('Graceful shutdown timed out, forcing exit')
        process.exit(0)
      }, SHUTDOWN_TIMEOUT_MS)
      forceExitTimer.unref()

      // Close WebSocket connections up front: their close handshake depends on
      // the peer responding, which can keep server.close() pending forever.
      // terminate() destroys the underlying socket immediately.
      for (const client of server.websocketServer.clients) {
        client.terminate()
      }

      await server.close()
      clearTimeout(forceExitTimer)
      process.exit(0)
    })
  }
}

// Type augmentation for custom request properties
declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number
  }
}
