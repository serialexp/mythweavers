import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import formbody from '@fastify/formbody'
import multipart from '@fastify/multipart'
import swagger from '@fastify/swagger'
import websocket from '@fastify/websocket'
import scalar from '@scalar/fastify-api-reference'
import Fastify from 'fastify'
import {
  fastifyZodOpenApiPlugin,
  fastifyZodOpenApiTransformers,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-zod-openapi'
import { corsDelegator } from '../src/lib/cors.js'
import { prisma } from '../src/lib/prisma.js'
import { registerApplicationRoutes } from '../src/register-routes.js'

let cachedApp: Awaited<ReturnType<typeof buildAppInternal>> | null = null

export async function buildApp() {
  if (cachedApp) return cachedApp
  const app = await buildAppInternal()
  // Wrap close() to be a no-op since we're reusing the app
  const _originalClose = app.close.bind(app)
  app.close = async () => {
    // Don't actually close - we're reusing the app across tests
  }
  cachedApp = app
  return cachedApp
}

async function buildAppInternal() {
  const app = Fastify({
    logger: {
      level: 'error', // Enable error logging in tests
    },
  })

  // Set Zod validator and serializer compilers
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  // Register plugins. Must stay the same CORS configuration as src/index.ts,
  // or the CORS tests pass against a policy production never uses.
  await app.register(cors, { delegator: corsDelegator })

  await app.register(cookie, {
    secret: 'test-secret',
    parseOptions: {},
  })

  await app.register(formbody)

  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  })

  await app.register(websocket)

  // Register fastify-zod-openapi plugin
  await app.register(fastifyZodOpenApiPlugin)

  // Register @fastify/swagger with transformers
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Test API',
        version: '1.0.0',
      },
      openapi: '3.1.0',
    },
    ...fastifyZodOpenApiTransformers,
  })

  await app.register(scalar, {
    routePrefix: '/docs',
  })

  // Custom error handler to format errors consistently
  app.setErrorHandler((error, _request, reply) => {
    const statusCode = error.statusCode || 500

    // Log full error details for debugging
    if (statusCode >= 500) {
      console.log('\n=== TEST ERROR HANDLER ===')
      console.log('Message:', error.message)
      console.log('Code:', error.code)
      console.log('Validation:', error.validation)
      console.log('Full error object:', JSON.stringify(error, null, 2))
      console.log('Stack:', error.stack)
      console.log('========================\n')
    }

    return reply.status(statusCode).send({
      error: error.message || 'Internal Server Error',
    })
  })

  await registerApplicationRoutes(app)

  return app
}

export async function cleanDatabase() {
  // Clean up in reverse order of dependencies, batched in a transaction for speed.
  //
  // OAuthClient and DeviceCode have no FK to User, so nothing cascades them when
  // users are deleted — without explicit deletes they survive every reset and
  // accumulate across the whole suite (suites pass alone, fail in a full run).
  await prisma.$transaction([
    prisma.accessToken.deleteMany(),
    prisma.oAuthRefreshToken.deleteMany(),
    prisma.oAuthAuthorizationRequest.deleteMany(),
    prisma.oAuthClient.deleteMany(),
    prisma.deviceCode.deleteMany(),
    prisma.file.deleteMany(),
    prisma.story.deleteMany(),
    prisma.tag.deleteMany(),
    prisma.session.deleteMany(),
    prisma.user.deleteMany(),
  ])
}
