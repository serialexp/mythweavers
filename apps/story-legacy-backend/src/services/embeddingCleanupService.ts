// ABOUTME: Listens to story events and cleans up embeddings when messages are updated or deleted
// ABOUTME: Runs asynchronously in the background without blocking message operations

import { type StoryEvent, subscribeToStoryEvents } from '../lib/eventBus'
import { createLogger } from '../lib/logger'
import { deleteParagraphEmbeddings } from './paragraphEmbeddingService'

const log = createLogger('embeddingCleanup')

export function initializeEmbeddingCleanup() {
  subscribeToStoryEvents(async (event: StoryEvent) => {
    // Only handle message update and delete events
    if (event.type !== 'message:updated' && event.type !== 'message:deleted') {
      return
    }

    // Extract messageId from the payload
    const messageId = event.type === 'message:updated' ? (event.payload.message as any)?.id : event.payload.messageId

    if (!messageId || typeof messageId !== 'string') {
      log.warn({ event: event.type, payload: event.payload }, 'Message event missing messageId')
      return
    }

    // Delete embeddings asynchronously without blocking
    try {
      await deleteParagraphEmbeddings({
        storyId: event.storyId,
        messageId,
      })
      log.debug({ storyId: event.storyId, messageId, event: event.type }, 'Cleaned up embeddings for message')
    } catch (error) {
      log.error(
        { err: error, storyId: event.storyId, messageId, event: event.type },
        'Failed to clean up embeddings for message',
      )
    }
  })

  log.info('Embedding cleanup service initialized')
}
