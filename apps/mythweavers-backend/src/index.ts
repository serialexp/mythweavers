import path from 'node:path'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import swagger from '@fastify/swagger'
import scalar from '@scalar/fastify-api-reference'
import Fastify, { type FastifyError } from 'fastify'
import {
  fastifyZodOpenApiPlugin,
  fastifyZodOpenApiTransformers,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-zod-openapi'
import { z } from 'zod'
import authRoutes from './routes/auth/index.js'
import calendarPresetsRoutes from './routes/calendars/presets.js'
import myArcsRoutes from './routes/my/arcs.js'
import myBooksRoutes from './routes/my/books.js'
import myCalendarsRoutes from './routes/my/calendars.js'
import myChaptersRoutes from './routes/my/chapters.js'
import myCharactersRoutes from './routes/my/characters.js'
import myContextItemsRoutes from './routes/my/context-items.js'
import myFilesRoutes from './routes/my/files.js'
import myInventoryRoutes from './routes/my/inventory.js'
import myLandmarkStatesRoutes from './routes/my/landmark-states.js'
import myLandmarksRoutes from './routes/my/landmarks.js'
import myMapsRoutes from './routes/my/maps.js'
import myMessageRevisionsRoutes from './routes/my/message-revisions.js'
import myMessagesBatchRoutes from './routes/my/messages-batch.js'
import myMessagesRoutes from './routes/my/messages.js'
import myParagraphRevisionsRoutes from './routes/my/paragraph-revisions.js'
import myParagraphsRoutes from './routes/my/paragraphs.js'
import myPathSegmentsRoutes from './routes/my/path-segments.js'
import myPathsRoutes from './routes/my/paths.js'
import myPawnsRoutes from './routes/my/pawns.js'
import myPlotPointStatesRoutes from './routes/my/plot-point-states.js'
import myScenesRoutes from './routes/my/scenes.js'
import myStoriesRoutes from './routes/my/stories.js'
import myStoryCalendarRoutes from './routes/my/story-calendar.js'
import myStoryTagsRoutes from './routes/my/story-tags.js'
import publicStoriesRoutes from './routes/stories/public.js'
import publicTagRoutes from './routes/tags/public.js'

const PORT = process.env.PORT ? Number.parseInt(process.env.PORT) : 3201
const HOST = process.env.HOST || '0.0.0.0'
const LOG_LEVEL = process.env.LOG_LEVEL || 'info'

const server = Fastify({
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

// CORS setup - allow all localhost ports for development
// Note: Can't use '*' with credentials, so we use a function that accepts all origins
await server.register(cors, {
  origin: (_origin, cb) => {
    // Allow all origins in development (for different localhost ports)
    cb(null, true)
  },
  credentials: true,
})

// Cookie support (required for session management)
await server.register(cookie, {
  secret: process.env.COOKIE_SECRET || 'changeme-in-production',
  parseOptions: {},
})

// Multipart support (for file uploads)
await server.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
})

// Static file serving for uploaded files
// TODO: In production, use Cloudflare R2 or S3-compatible storage instead
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')
await server.register(fastifyStatic, {
  root: UPLOAD_DIR,
  prefix: '/files/',
  decorateReply: false, // Don't add sendFile method to avoid conflicts
})

// Register fastify-zod-openapi plugin
await server.register(fastifyZodOpenApiPlugin)

// Register @fastify/swagger with transformers for OpenAPI generation
await server.register(swagger, {
  openapi: {
    info: {
      title: 'Writer Unified API',
      description: 'Unified backend API for Writer2 and Story projects',
      version: '1.0.0',
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
      timestamp: new Date().toISOString(),
    }
  },
)

// Register routes
await server.register(authRoutes, { prefix: '/auth' })
await server.register(myStoriesRoutes, { prefix: '/my/stories' })
await server.register(myBooksRoutes, { prefix: '/my' })
await server.register(myArcsRoutes, { prefix: '/my' })
await server.register(myChaptersRoutes, { prefix: '/my' })
await server.register(myScenesRoutes, { prefix: '/my' })
await server.register(myCharactersRoutes, { prefix: '/my' })
await server.register(myContextItemsRoutes, { prefix: '/my' })
await server.register(myMessagesRoutes, { prefix: '/my' })
await server.register(myMessagesBatchRoutes, { prefix: '/my' })
await server.register(myMessageRevisionsRoutes, { prefix: '/my' })
await server.register(myParagraphsRoutes, { prefix: '/my' })
await server.register(myParagraphRevisionsRoutes, { prefix: '/my' })
await server.register(myFilesRoutes, { prefix: '/my' })
await server.register(myInventoryRoutes, { prefix: '/my' })
await server.register(myStoryTagsRoutes, { prefix: '/my' })
await server.register(myCalendarsRoutes, { prefix: '/my' })
await server.register(myStoryCalendarRoutes, { prefix: '/my' })
await server.register(myMapsRoutes, { prefix: '/my' })
await server.register(myLandmarksRoutes, { prefix: '/my' })
await server.register(myLandmarkStatesRoutes, { prefix: '/my' })
await server.register(myPawnsRoutes, { prefix: '/my' })
await server.register(myPathsRoutes, { prefix: '/my' })
await server.register(myPathSegmentsRoutes, { prefix: '/my' })
await server.register(myPlotPointStatesRoutes, { prefix: '/my' })
await server.register(publicStoriesRoutes, { prefix: '/stories' })
await server.register(publicTagRoutes, { prefix: '' })
await server.register(calendarPresetsRoutes, { prefix: '/calendars' })

// Start server
try {
  await server.listen({ port: PORT, host: HOST })
  server.log.info(`Server listening on http://${HOST}:${PORT}`)
  server.log.info(`OpenAPI docs available at http://${HOST}:${PORT}/docs`)
} catch (err) {
  server.log.error(err)
  process.exit(1)
}

// Graceful shutdown
const signals = ['SIGINT', 'SIGTERM']
signals.forEach((signal) => {
  process.on(signal, async () => {
    server.log.info(`Received ${signal}, closing server...`)
    await server.close()
    process.exit(0)
  })
})

// Type augmentation for custom request properties
declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number
  }
}
