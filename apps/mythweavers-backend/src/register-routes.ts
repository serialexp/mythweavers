import type { FastifyInstance } from 'fastify'
import adminLlmRoutes from './routes/admin/llm.js'
import adminUsersRoutes from './routes/admin/users.js'
import authRoutes from './routes/auth/index.js'
import publicAuthorsRoutes from './routes/authors/public.js'
import calendarPresetsRoutes from './routes/calendars/presets.js'
import myAdventuresRoutes from './routes/my/adventures.js'
import myArcsRoutes from './routes/my/arcs.js'
import myBackgroundRoutes from './routes/my/background.js'
import myBalanceRoutes from './routes/my/balance.js'
import myBooksRoutes from './routes/my/books.js'
import myBookshelfRoutes from './routes/my/bookshelf.js'
import myCalendarsRoutes from './routes/my/calendars.js'
import myChaptersRoutes from './routes/my/chapters.js'
import myCharactersRoutes from './routes/my/characters.js'
import myContextItemsRoutes from './routes/my/context-items.js'
import myExportPdfRoutes from './routes/my/export-pdf.js'
import myExportStoryRoutes from './routes/my/export-story.js'
import myFilesRoutes from './routes/my/files.js'
import myImagesRoutes from './routes/my/images.js'
import myInventoryRoutes from './routes/my/inventory.js'
import myLandmarkStatesRoutes from './routes/my/landmark-states.js'
import myLandmarksRoutes from './routes/my/landmarks.js'
import myLanguagesRoutes from './routes/my/languages.js'
import myLlmRoutes from './routes/my/llm.js'
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
import myPreferencesRoutes from './routes/my/preferences.js'
import myPublishingRoutes from './routes/my/publishing.js'
import myReadingStatusRoutes from './routes/my/reading-status.js'
import myRoyalRoadRoutes from './routes/my/royal-road.js'
import myScenesRoutes from './routes/my/scenes.js'
import myStoriesRoutes from './routes/my/stories.js'
import myStoryCalendarRoutes from './routes/my/story-calendar.js'
import myStoryLanguageRoutes from './routes/my/story-language.js'
import myStoryTagsRoutes from './routes/my/story-tags.js'
import myUsageRoutes from './routes/my/usage.js'
import oauthRoutes from './routes/oauth/index.js'
import publicStoriesRoutes from './routes/stories/public.js'
import publicTagRoutes from './routes/tags/public.js'
import stripeWebhookRoutes from './routes/webhooks/stripe.js'
import wsRoutes from './routes/ws.js'

export async function registerApplicationRoutes(server: FastifyInstance): Promise<void> {
  await server.register(authRoutes, { prefix: '/auth' })
  await server.register(oauthRoutes, { prefix: '/oauth' })
  await server.register(myAdventuresRoutes, { prefix: '/my' })
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
  await server.register(myImagesRoutes, { prefix: '/my' })
  await server.register(myInventoryRoutes, { prefix: '/my' })
  await server.register(myStoryTagsRoutes, { prefix: '/my' })
  await server.register(myCalendarsRoutes, { prefix: '/my' })
  await server.register(myStoryCalendarRoutes, { prefix: '/my' })
  await server.register(myLanguagesRoutes, { prefix: '/my' })
  await server.register(myStoryLanguageRoutes, { prefix: '/my' })
  await server.register(myMapsRoutes, { prefix: '/my' })
  await server.register(myLandmarksRoutes, { prefix: '/my' })
  await server.register(myLandmarkStatesRoutes, { prefix: '/my' })
  await server.register(myPawnsRoutes, { prefix: '/my' })
  await server.register(myPathsRoutes, { prefix: '/my' })
  await server.register(myPathSegmentsRoutes, { prefix: '/my' })
  await server.register(myPlotPointStatesRoutes, { prefix: '/my' })
  await server.register(myPublishingRoutes, { prefix: '/my' })
  await server.register(myBackgroundRoutes, { prefix: '/my' })
  await server.register(myRoyalRoadRoutes, { prefix: '/my' })
  await server.register(myExportPdfRoutes, { prefix: '/my' })
  await server.register(myExportStoryRoutes, { prefix: '/my' })
  await server.register(myBalanceRoutes, { prefix: '/my' })
  await server.register(myPreferencesRoutes, { prefix: '/my' })
  await server.register(myUsageRoutes, { prefix: '/my' })
  await server.register(myLlmRoutes, { prefix: '/my' })
  await server.register(myBookshelfRoutes, { prefix: '/my' })
  await server.register(myReadingStatusRoutes, { prefix: '/my' })
  await server.register(stripeWebhookRoutes, { prefix: '/webhooks' })
  await server.register(wsRoutes)
  await server.register(adminLlmRoutes, { prefix: '/admin' })
  await server.register(adminUsersRoutes, { prefix: '/admin' })
  await server.register(publicStoriesRoutes, { prefix: '/stories' })
  await server.register(publicAuthorsRoutes, { prefix: '/authors' })
  await server.register(publicTagRoutes, { prefix: '' })
  await server.register(calendarPresetsRoutes, { prefix: '/calendars' })
}
