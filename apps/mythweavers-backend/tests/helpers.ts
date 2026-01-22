import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import swagger from '@fastify/swagger'
import scalar from '@scalar/fastify-api-reference'
import Fastify from 'fastify'
import {
  fastifyZodOpenApiPlugin,
  fastifyZodOpenApiTransformers,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-zod-openapi'
import { prisma } from '../src/lib/prisma.js'
import authRoutes from '../src/routes/auth/index.js'
import calendarPresetsRoutes from '../src/routes/calendars/presets.js'
import myArcsRoutes from '../src/routes/my/arcs.js'
import myBooksRoutes from '../src/routes/my/books.js'
import myCalendarsRoutes from '../src/routes/my/calendars.js'
import myChaptersRoutes from '../src/routes/my/chapters.js'
import myCharactersRoutes from '../src/routes/my/characters.js'
import myContextItemsRoutes from '../src/routes/my/context-items.js'
import myFilesRoutes from '../src/routes/my/files.js'
import myInventoryRoutes from '../src/routes/my/inventory.js'
import myLandmarkStatesRoutes from '../src/routes/my/landmark-states.js'
import myLandmarksRoutes from '../src/routes/my/landmarks.js'
import myMapsRoutes from '../src/routes/my/maps.js'
import myMessageRevisionsRoutes from '../src/routes/my/message-revisions.js'
import myMessagesBatchRoutes from '../src/routes/my/messages-batch.js'
import myMessagesRoutes from '../src/routes/my/messages.js'
import myParagraphRevisionsRoutes from '../src/routes/my/paragraph-revisions.js'
import myParagraphsRoutes from '../src/routes/my/paragraphs.js'
import myPathSegmentsRoutes from '../src/routes/my/path-segments.js'
import myPathsRoutes from '../src/routes/my/paths.js'
import myPawnsRoutes from '../src/routes/my/pawns.js'
import myPlotPointStatesRoutes from '../src/routes/my/plot-point-states.js'
import myScenesRoutes from '../src/routes/my/scenes.js'
import myStoriesRoutes from '../src/routes/my/stories.js'
import myStoryCalendarRoutes from '../src/routes/my/story-calendar.js'
import myStoryTagsRoutes from '../src/routes/my/story-tags.js'
import myExportStoryRoutes from '../src/routes/my/export-story.js'
import publicStoriesRoutes from '../src/routes/stories/public.js'
import publicTagRoutes from '../src/routes/tags/public.js'

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

  // Register plugins
  await app.register(cors, {
    origin: '*',
    credentials: true,
  })

  await app.register(cookie, {
    secret: 'test-secret',
    parseOptions: {},
  })

  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  })

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

  // Register routes
  await app.register(authRoutes, { prefix: '/auth' })
  await app.register(myStoriesRoutes, { prefix: '/my/stories' })
  await app.register(myBooksRoutes, { prefix: '/my' })
  await app.register(myArcsRoutes, { prefix: '/my' })
  await app.register(myChaptersRoutes, { prefix: '/my' })
  await app.register(myScenesRoutes, { prefix: '/my' })
  await app.register(myCharactersRoutes, { prefix: '/my' })
  await app.register(myContextItemsRoutes, { prefix: '/my' })
  await app.register(myMessagesRoutes, { prefix: '/my' })
  await app.register(myMessagesBatchRoutes, { prefix: '/my' })
  await app.register(myMessageRevisionsRoutes, { prefix: '/my' })
  await app.register(myParagraphsRoutes, { prefix: '/my' })
  await app.register(myParagraphRevisionsRoutes, { prefix: '/my' })
  await app.register(myFilesRoutes, { prefix: '/my' })
  await app.register(myInventoryRoutes, { prefix: '/my' })
  await app.register(myStoryTagsRoutes, { prefix: '/my' })
  await app.register(myCalendarsRoutes, { prefix: '/my' })
  await app.register(myStoryCalendarRoutes, { prefix: '/my' })
  await app.register(myMapsRoutes, { prefix: '/my' })
  await app.register(myLandmarksRoutes, { prefix: '/my' })
  await app.register(myLandmarkStatesRoutes, { prefix: '/my' })
  await app.register(myPawnsRoutes, { prefix: '/my' })
  await app.register(myPathsRoutes, { prefix: '/my' })
  await app.register(myPathSegmentsRoutes, { prefix: '/my' })
  await app.register(myPlotPointStatesRoutes, { prefix: '/my' })
  await app.register(myExportStoryRoutes, { prefix: '/my' })
  await app.register(publicStoriesRoutes, { prefix: '/stories' })
  await app.register(publicTagRoutes, { prefix: '' })
  await app.register(calendarPresetsRoutes, { prefix: '/calendars' })

  return app
}

export async function cleanDatabase() {
  // Clean up in reverse order of dependencies, batched in a transaction for speed
  await prisma.$transaction([
    prisma.file.deleteMany(),
    prisma.story.deleteMany(),
    prisma.tag.deleteMany(),
    prisma.session.deleteMany(),
    prisma.user.deleteMany(),
  ])
}
