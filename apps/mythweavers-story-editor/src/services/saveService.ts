import type { Paragraph } from '@mythweavers/shared'
import { generateMessageId } from '../utils/id'
import {
  deleteMyArcsById,
  deleteMyBooksById,
  deleteMyChaptersById,
  deleteMyCharactersById,
  deleteMyContextItemsById,
  deleteMyLandmarksById,
  deleteMyMapsById,
  deleteMyMessagesById,
  deleteMyParagraphsById,
  deleteMyPathsById,
  deleteMyPawnMovementsById,
  deleteMyPawnsById,
  deleteMyScenesById,
  patchMyArcsById,
  patchMyBooksById,
  patchMyChaptersById,
  patchMyCharactersById,
  patchMyContextItemsById,
  patchMyMessagesById,
  patchMyParagraphsById,
  patchMyStoriesById,
  postMyArcsByArcIdChapters,
  postMyBooksByBookIdArcs,
  postMyMapsByMapIdLandmarks,
  postMyMapsByMapIdPaths,
  postMyMapsByMapIdPawns,
  postMyPawnsByPawnIdMovements,
  postMyMessageRevisionsByRevisionIdParagraphsBatch,
  postMyMessagesByIdRegenerate,
  postMyScenesBySceneIdMessages,
  postMyStoriesByStoryIdBooks,
  postMyStoriesByStoryIdCharacters,
  postMyStoriesByStoryIdContextItems,
  postMyStoriesByStoryIdMaps,
  putMyLandmarksById,
  putMyMapsById,
  putMyPathsById,
  putMyPathsByPathIdSegments,
  putMyPawnMovementsById,
  putMyPawnsById,
  postMyStoriesByStoryIdMessagesReorder,
  postMyStoriesByStoryIdNodesBulkUpdate,
  postMyStoriesByStoryIdNodesReorder,
  postMyLandmarksByLandmarkIdStates,
  postMyMessagesByMessageIdPlotPointStates,
  deleteMyMessagesByMessageIdPlotPointStatesByKey,
  patchMyStoriesByStoryIdPublishing,
  postMyStoriesByStoryIdPublishNow,
  postMyStoriesByStoryIdUnpublish,
  patchMyChaptersByChapterIdPublishing,
  postMyChaptersByChapterIdPublishNow,
  postMyChaptersByChapterIdUnpublish,
  patchMyStoriesByStoryIdBackground,
  patchMyBooksByBookIdBackground,
  patchMyArcsByArcIdBackground,
  patchMyChaptersByChapterIdBackground,
  patchMyScenesBySceneIdBackground,
  getApiBaseUrl,
} from '../client/config'
import { hyperlaneSegmentToSegmentBody } from '../types/api'
import {
  Character,
  ContextItem,
  Fleet,
  FleetMovement,
  Hyperlane,
  Landmark,
  Message,
  Node,
  StoryMap,
} from '../types/core'

// Convert base64 data URI to Blob without using fetch (CSP-compliant)
function base64ToBlob(dataUri: string): Blob {
  const mimeType = dataUri.match(/data:([^;]+);/)?.[1] || 'image/jpeg'
  const base64Data = dataUri.split(',')[1] || dataUri
  const binaryString = atob(base64Data)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return new Blob([bytes], { type: mimeType })
}

// Base fields shared by all save operations
interface SaveOperationBase {
  id: string // Unique ID for this operation
  entityId: string // ID of the entity being saved
  storyId: string
  timestamp: number // When this was queued
  retryCount?: number
}

// Message operations
interface MessageInsertOperation extends SaveOperationBase {
  type: 'message-insert'
  entityType: 'message'
  data: Message & { afterMessageId?: string | null }
}

interface MessageUpdateOperation extends SaveOperationBase {
  type: 'message-update'
  entityType: 'message'
  data: Partial<Message>
}

interface MessageDeleteOperation extends SaveOperationBase {
  type: 'message-delete'
  entityType: 'message'
  data?: undefined
}

interface MessageReorderOperation extends SaveOperationBase {
  type: 'message-reorder'
  entityType: 'message'
  data: { items: Array<{ messageId: string; sceneId: string; order: number }> }
}

interface MessageBatchOperation extends SaveOperationBase {
  type: 'message-batch'
  entityType: 'message'
  data: {
    messages: Array<{
      id?: string
      sceneId: string
      sortOrder: number
      instruction?: string | null
      script?: string | null
      type?: 'chapter' | 'event' | 'branch' | 'background' | 'audio' | null
      options?: Array<{
        id: string
        label: string
        targetNodeId: string
        targetMessageId: string
        description?: string
      }>
      backgroundFileId?: string | null
      audioFileId?: string | null
      paragraphs?: Array<{ body: string; sortOrder: number }>
    }>
  }
}

// Character operations
interface CharacterInsertOperation extends SaveOperationBase {
  type: 'character-insert'
  entityType: 'character'
  data: Character
}

interface CharacterUpdateOperation extends SaveOperationBase {
  type: 'character-update'
  entityType: 'character'
  data: Partial<Character>
}

interface CharacterDeleteOperation extends SaveOperationBase {
  type: 'character-delete'
  entityType: 'character'
  data?: undefined
}

// Context operations
interface ContextInsertOperation extends SaveOperationBase {
  type: 'context-insert'
  entityType: 'context'
  data: ContextItem
}

interface ContextUpdateOperation extends SaveOperationBase {
  type: 'context-update'
  entityType: 'context'
  data: Partial<ContextItem>
}

interface ContextDeleteOperation extends SaveOperationBase {
  type: 'context-delete'
  entityType: 'context'
  data?: undefined
}

// Map operations
interface MapInsertOperation extends SaveOperationBase {
  type: 'map-insert'
  entityType: 'map'
  data: StoryMap
}

interface MapUpdateOperation extends SaveOperationBase {
  type: 'map-update'
  entityType: 'map'
  data: Partial<StoryMap>
}

interface MapDeleteOperation extends SaveOperationBase {
  type: 'map-delete'
  entityType: 'map'
  data?: undefined
}

// Landmark operations
interface LandmarkInsertOperation extends SaveOperationBase {
  type: 'landmark-insert'
  entityType: 'landmark'
  data: Landmark & { mapId: string }
}

interface LandmarkUpdateOperation extends SaveOperationBase {
  type: 'landmark-update'
  entityType: 'landmark'
  data: Landmark & { mapId: string }
}

interface LandmarkDeleteOperation extends SaveOperationBase {
  type: 'landmark-delete'
  entityType: 'landmark'
  data: { mapId: string }
}

interface LandmarkStateOperation extends SaveOperationBase {
  type: 'landmark-state'
  entityType: 'landmark-state'
  data: { mapId: string; landmarkId: string; storyTime: number; field: string; value: string | null }
}

// Node operations
interface NodeInsertOperation extends SaveOperationBase {
  type: 'node-insert'
  entityType: 'node'
  data: Node
}

interface NodeUpdateOperation extends SaveOperationBase {
  type: 'node-update'
  entityType: 'node'
  data: Partial<Node>
}

interface NodeDeleteOperation extends SaveOperationBase {
  type: 'node-delete'
  entityType: 'node'
  data: Node & { permanent?: boolean }
}

interface NodeBulkUpdateOperation extends SaveOperationBase {
  type: 'node-bulk-update'
  entityType: 'node'
  data: Node[]
}

interface NodeReorderOperation extends SaveOperationBase {
  type: 'node-reorder'
  entityType: 'node'
  data: {
    items: Array<{
      nodeId: string
      nodeType: 'book' | 'arc' | 'chapter' | 'scene'
      parentId: string | null
      order: number
    }>
  }
}

// Fleet operations
interface FleetInsertOperation extends SaveOperationBase {
  type: 'fleet-insert'
  entityType: 'fleet'
  data: Fleet & { mapId: string }
}

interface FleetUpdateOperation extends SaveOperationBase {
  type: 'fleet-update'
  entityType: 'fleet'
  data: Partial<Fleet> & { mapId: string }
}

interface FleetDeleteOperation extends SaveOperationBase {
  type: 'fleet-delete'
  entityType: 'fleet'
  data: { mapId: string }
}

// Fleet movement operations
interface FleetMovementInsertOperation extends SaveOperationBase {
  type: 'fleet-movement-insert'
  entityType: 'fleet-movement'
  data: FleetMovement & { mapId: string; fleetId: string }
}

interface FleetMovementUpdateOperation extends SaveOperationBase {
  type: 'fleet-movement-update'
  entityType: 'fleet-movement'
  data: FleetMovement & { mapId: string; fleetId: string }
}

interface FleetMovementDeleteOperation extends SaveOperationBase {
  type: 'fleet-movement-delete'
  entityType: 'fleet-movement'
  data: { mapId: string; fleetId: string }
}

// Hyperlane operations
interface HyperlaneInsertOperation extends SaveOperationBase {
  type: 'hyperlane-insert'
  entityType: 'hyperlane'
  data: Hyperlane & { mapId: string }
}

interface HyperlaneUpdateOperation extends SaveOperationBase {
  type: 'hyperlane-update'
  entityType: 'hyperlane'
  data: Partial<Hyperlane> & { mapId: string }
}

interface HyperlaneDeleteOperation extends SaveOperationBase {
  type: 'hyperlane-delete'
  entityType: 'hyperlane'
  data: { mapId: string }
}

// Story operations
interface StorySettingsOperation extends SaveOperationBase {
  type: 'story-settings'
  entityType: 'story-settings'
  data: Partial<{
    name: string
    summary: string | null
    coverArtFileId: string | null
    person: 'first' | 'second' | 'third'
    tense: 'present' | 'past'
    storySetting: string
    format: 'narrative' | 'cyoa'
    paragraphsPerTurn: number
    globalScript: string
    selectedChapterId: string | null
    selectedNodeId: string | null
    branchChoices: Record<string, string>
    timelineStartTime: number
    timelineEndTime: number
    timelineGranularity: 'hour' | 'day'
    provider: string
    model: string | null
    aiOverrides: {
      provider?: string | null
      model?: string | null
      maxTokens?: number | null
      thinkingBudget?: number | null
      contextSize?: number | null
      categoryOverrides?: Record<string, unknown> | null
    } | null
    plotPointDefaults: unknown[]
  }>
}

// Publishing operations. These wrap the dedicated /my/stories/:id/publishing
// and /my/chapters/:id/publishing endpoints (plus their publish-now /
// unpublish shortcuts). They go through the save queue so any pending
// content writes drain first — you should never publish partial edits.
//
// The `mode` discriminates which underlying endpoint to call; `publishedAt`
// is only meaningful for mode === 'schedule'.
interface StoryPublishingOperation extends SaveOperationBase {
  type: 'story-publishing'
  entityType: 'story-publishing'
  data:
    | { mode: 'publish-now' }
    | { mode: 'unpublish' }
    | { mode: 'schedule'; publishedAt: string }
}

interface ChapterPublishingOperation extends SaveOperationBase {
  type: 'chapter-publishing'
  entityType: 'chapter-publishing'
  data:
    | { mode: 'publish-now' }
    | { mode: 'unpublish' }
    | { mode: 'schedule'; publishedAt: string }
}

// Default-background operations. These wrap the /my/{stories|books|arcs|chapters|scenes}/:id/background
// PATCH endpoints. Each entity level has its own operation kind so the queue
// dedupes per-entity (so a rapid double-click only fires the latest pick).
//
// `backgroundFileId: null` clears the default and means "no fire" at this node.
type BackgroundData = { backgroundFileId: string | null }

interface StoryBackgroundOperation extends SaveOperationBase {
  type: 'story-background'
  entityType: 'story-background'
  data: BackgroundData
}

interface BookBackgroundOperation extends SaveOperationBase {
  type: 'book-background'
  entityType: 'book-background'
  data: BackgroundData
}

interface ArcBackgroundOperation extends SaveOperationBase {
  type: 'arc-background'
  entityType: 'arc-background'
  data: BackgroundData
}

interface ChapterBackgroundOperation extends SaveOperationBase {
  type: 'chapter-background'
  entityType: 'chapter-background'
  data: BackgroundData
}

interface SceneBackgroundOperation extends SaveOperationBase {
  type: 'scene-background'
  entityType: 'scene-background'
  data: BackgroundData
}

// Discriminated union of all save operations
type SaveOperation =
  | MessageInsertOperation
  | MessageUpdateOperation
  | MessageDeleteOperation
  | MessageReorderOperation
  | MessageBatchOperation
  | CharacterInsertOperation
  | CharacterUpdateOperation
  | CharacterDeleteOperation
  | ContextInsertOperation
  | ContextUpdateOperation
  | ContextDeleteOperation
  | MapInsertOperation
  | MapUpdateOperation
  | MapDeleteOperation
  | LandmarkInsertOperation
  | LandmarkUpdateOperation
  | LandmarkDeleteOperation
  | LandmarkStateOperation
  | NodeInsertOperation
  | NodeUpdateOperation
  | NodeDeleteOperation
  | NodeBulkUpdateOperation
  | NodeReorderOperation
  | FleetInsertOperation
  | FleetUpdateOperation
  | FleetDeleteOperation
  | FleetMovementInsertOperation
  | FleetMovementUpdateOperation
  | FleetMovementDeleteOperation
  | HyperlaneInsertOperation
  | HyperlaneUpdateOperation
  | HyperlaneDeleteOperation
  | StorySettingsOperation
  | StoryPublishingOperation
  | ChapterPublishingOperation
  | StoryBackgroundOperation
  | BookBackgroundOperation
  | ArcBackgroundOperation
  | ChapterBackgroundOperation
  | SceneBackgroundOperation

// Helper type to extract operation type string
type SaveOperationType = SaveOperation['type']

interface SaveQueueState {
  queue: SaveOperation[]
  isProcessing: boolean
  currentOperation: SaveOperation | null
  lastKnownUpdatedAt: string | null
  isFullSaveInProgress: boolean
}

export class SaveService {
  private state: SaveQueueState = {
    queue: [],
    isProcessing: false,
    currentOperation: null,
    lastKnownUpdatedAt: null,
    isFullSaveInProgress: false,
  }

  private processingPromise: Promise<void> | null = null
  private onSaveStatusChange?: (isSaving: boolean) => void
  private onConflict?: (serverUpdatedAt: string, clientUpdatedAt: string) => void
  private onError?: (error: Error) => void
  private onOperationFailed?: (operation: SaveOperation, error: Error) => void
  private onMessageCreated?: (messageId: string, data: { currentMessageRevisionId: string }) => void
  private onLastKnownUpdatedAtChange?: (timestamp: string) => void
  private onStoryPublishingChanged?: (storyId: string, publishedAt: string | null) => void
  private onChapterPublishingChanged?: (
    chapterId: string,
    storyId: string,
    publishedAt: string | null,
    releaseDates: {
      firstChapterReleasedAt: string | null
      lastChapterReleasedAt: string | null
    },
  ) => void
  private onBackgroundChanged?: (
    entityType: 'story' | 'book' | 'arc' | 'chapter' | 'scene',
    entityId: string,
    storyId: string,
    backgroundFileId: string | null,
    backgroundUrl: string | null,
  ) => void
  private getStorageMode?: () => 'local' | 'server' | null

  // Set callbacks for UI updates
  setCallbacks(callbacks: {
    onSaveStatusChange?: (isSaving: boolean) => void
    onQueueLengthChange?: (length: number) => void
    onConflict?: (serverUpdatedAt: string, clientUpdatedAt: string) => void
    onError?: (error: Error) => void
    onOperationFailed?: (operation: SaveOperation, error: Error) => void
    onMessageCreated?: (messageId: string, data: { currentMessageRevisionId: string }) => void
    onLastKnownUpdatedAtChange?: (timestamp: string) => void
    onStoryPublishingChanged?: (storyId: string, publishedAt: string | null) => void
    onChapterPublishingChanged?: (
      chapterId: string,
      storyId: string,
      publishedAt: string | null,
      releaseDates: {
        firstChapterReleasedAt: string | null
        lastChapterReleasedAt: string | null
      },
    ) => void
    onBackgroundChanged?: (
      entityType: 'story' | 'book' | 'arc' | 'chapter' | 'scene',
      entityId: string,
      storyId: string,
      backgroundFileId: string | null,
      backgroundUrl: string | null,
    ) => void
    getStorageMode?: () => 'local' | 'server' | null
  }) {
    this.onSaveStatusChange = callbacks.onSaveStatusChange
    this.onQueueLengthChange = callbacks.onQueueLengthChange
    this.onConflict = callbacks.onConflict
    this.onError = callbacks.onError
    this.onOperationFailed = callbacks.onOperationFailed
    this.onMessageCreated = callbacks.onMessageCreated
    this.onLastKnownUpdatedAtChange = callbacks.onLastKnownUpdatedAtChange
    this.onStoryPublishingChanged = callbacks.onStoryPublishingChanged
    this.onChapterPublishingChanged = callbacks.onChapterPublishingChanged
    this.onBackgroundChanged = callbacks.onBackgroundChanged
    this.getStorageMode = callbacks.getStorageMode
  }

  private onQueueLengthChange?: (length: number) => void

  // Update last known timestamp (internal use only)
  private updateLastKnownTimestamp(timestamp: string) {
    this.state.lastKnownUpdatedAt = timestamp
    // Notify via callback so currentStoryStore can update
    this.onLastKnownUpdatedAtChange?.(timestamp)
  }

  // Trigger full save function (to be set by messagesStore)
  private triggerFullSave: () => Promise<void> = async () => {}

  setTriggerFullSave(fn: () => Promise<void>) {
    this.triggerFullSave = fn
  }

  // Queue a save operation
  async queueSave(operation: Omit<SaveOperation, 'id' | 'timestamp'>): Promise<void> {
    // Check if this is a local story - if so, trigger a full save instead
    if (this.getStorageMode?.() === 'local') {
      // For local stories, any save triggers a full save
      // Local story detected, triggering full save
      return this.triggerFullSave()
    }

    // Don't queue anything during a full save
    if (this.state.isFullSaveInProgress) {
      // Skip save during full story save
      return
    }

    const op = {
      ...operation,
      id: `${operation.entityType}-${operation.entityId}-${Date.now()}`,
      timestamp: Date.now(),
    } as SaveOperation

    const existingIndex = this.state.queue.findIndex(
      (existing) => existing.entityType === op.entityType && existing.entityId === op.entityId,
    )

    console.log('[saveService.queueSave] Operation:', op.type, op.entityId, 'existingIndex:', existingIndex, 'queueLength:', this.state.queue.length)

    let shouldQueueOperation = true

    if (existingIndex !== -1) {
      const existing = this.state.queue[existingIndex]
      const sameEntityType = existing.entityType === op.entityType

      const existingInsert = this.isOperation(existing, 'insert')
      const existingUpdate = this.isOperation(existing, 'update')
      const existingDelete = this.isOperation(existing, 'delete')
      const newUpdate = this.isOperation(op, 'update')
      const newDelete = this.isOperation(op, 'delete')

      if (sameEntityType) {
        if (existingInsert && newUpdate) {
          // For messages, don't merge updates into inserts.
          // Message inserts only send metadata (instruction, script, sortOrder).
          // Content is saved separately via saveParagraphs after generation.
          // For other entity types, merge updates into pending inserts.
          if (op.entityType === 'message') {
            // Let both operations run separately - insert first, then update
            // The update will be processed after the insert completes
          } else {
            // Apply update fields to the pending insert so the initial create carries latest data
            this.mergeOperationData(existing, op)
            existing.timestamp = op.timestamp
            shouldQueueOperation = false
          }
        } else if (existingInsert && newDelete) {
          // Created then deleted before sync; drop both
          this.state.queue.splice(existingIndex, 1)
          this.onQueueLengthChange?.(this.state.queue.length)
          shouldQueueOperation = false
        } else if (existingUpdate && newUpdate) {
          // Collapse multiple updates into one payload
          this.mergeOperationData(existing, op)
          existing.timestamp = op.timestamp
          shouldQueueOperation = false
        } else if (existingDelete) {
          // Delete already queued; ignore subsequent ops until delete executes
          shouldQueueOperation = false
        } else {
          // Replace the existing operation with the new one (e.g., update -> delete)
          this.state.queue.splice(existingIndex, 1)
          this.onQueueLengthChange?.(this.state.queue.length)
        }
      } else {
        // Different entity type but same ID - extremely unlikely, but replace existing to be safe
        this.state.queue.splice(existingIndex, 1)
        this.onQueueLengthChange?.(this.state.queue.length)
      }
    }

    if (shouldQueueOperation) {
      // Add to queue
      this.state.queue.push(op)
      // Queued operation

      // Notify about queue length change
      this.onQueueLengthChange?.(this.state.queue.length)
    }

    // Start processing if not already running
    if (!this.state.isProcessing) {
      this.processingPromise = this.processQueue()
    }

    // Wait for this operation to complete
    return this.processingPromise || Promise.resolve()
  }

  // Process the queue
  private async processQueue(): Promise<void> {
    if (this.state.isProcessing || this.state.queue.length === 0) {
      return
    }

    this.state.isProcessing = true
    this.onSaveStatusChange?.(true)

    console.log('[saveService.processQueue] Starting processing, queue length:', this.state.queue.length)
    while (this.state.queue.length > 0 && !this.state.isFullSaveInProgress) {
      const operation = this.state.queue.shift()!
      this.state.currentOperation = operation

      console.log('[saveService.processQueue] Processing operation:', operation.type, operation.entityId, 'remaining:', this.state.queue.length)

      // Notify about queue length change after removing item
      this.onQueueLengthChange?.(this.state.queue.length)

      try {
        await this.executeSaveOperation(operation)
        console.log('[saveService.processQueue] Completed operation:', operation.type, operation.entityId)
      } catch (error) {
        console.error(`Failed ${operation.type} for ${operation.entityType} ${operation.entityId}:`, error)

        // Check for authentication errors
        const errorMessage = error instanceof Error ? error.message : String(error)
        if (
          errorMessage.includes('401') ||
          errorMessage.includes('authentication') ||
          errorMessage.includes('Unauthorized') ||
          errorMessage.includes('Invalid session token')
        ) {
          console.error('[SaveService] Authentication error detected - user may need to log in again')
          this.onOperationFailed?.(operation, error as Error)
          this.onError?.(new Error('Authentication failed. Please log in again to save your work.'))
          // Clear the queue to prevent further failures
          this.state.queue = []
          this.onQueueLengthChange?.(0)
          break
        }

        // Check HTTP status code - don't retry client errors (4xx)
        // Try multiple ways to get the status code since different clients format errors differently
        let statusCode = (error as any)?.response?.status || (error as any)?.status

        // If status is not present on the error object, try its message.
        if (!statusCode && errorMessage) {
          const match = errorMessage.match(/status (\d{3})/)
          if (match) {
            statusCode = Number.parseInt(match[1], 10)
          }
        }

        const isClientError = statusCode >= 400 && statusCode < 500

        if (statusCode === 409) {
          this.onOperationFailed?.(operation, error as Error)
          const details = (error as any)?.details ?? error
          if (details?.serverUpdatedAt && details?.clientUpdatedAt) {
            this.onConflict?.(details.serverUpdatedAt, details.clientUpdatedAt)
          } else {
            this.onError?.(error instanceof Error ? error : new Error(errorMessage))
          }
          this.state.queue = []
          this.onQueueLengthChange?.(0)
          break
        }

        if (isClientError) {
          console.warn(`[SaveService] Client error (${statusCode}) detected, not retrying`)
          // Don't retry client errors - they won't succeed on retry
          this.onOperationFailed?.(operation, error as Error)
          this.onError?.(error instanceof Error ? error : new Error(errorMessage))
        } else {
          // Retry logic for server errors (5xx) and network errors
          if (operation.retryCount === undefined) {
            operation.retryCount = 0
          }

          if (operation.retryCount < 3) {
            operation.retryCount++
            console.log(
              `[SaveService] Retrying operation (attempt ${operation.retryCount}/3), status: ${statusCode || 'unknown'}`,
            )
            this.state.queue.unshift(operation) // Put it back at the front
          } else {
            console.error(`[SaveService] Failed after 3 retries (status: ${statusCode || 'unknown'}), notifying user`)
            this.onOperationFailed?.(operation, error as Error)
            this.onError?.(error as Error)
          }
        }
      }
    }

    console.log('[saveService.processQueue] Finished processing queue')
    this.state.currentOperation = null
    this.state.isProcessing = false
    this.onSaveStatusChange?.(false)
    this.processingPromise = null
  }

  // Execute a single save operation
  private async executeSaveOperation(operation: SaveOperation): Promise<void> {
    const { storyId, entityId } = operation

    // Execute save operation - use operation.data directly for type narrowing

    switch (operation.type) {
      case 'message-insert': {
        // For inserts, we need to know where to insert the message
        const sceneId = operation.data.sceneId
        if (!sceneId) {
          throw new Error('sceneId is required to insert a message')
        }
        // Insert message using new endpoint
        // Note: id is passed for client-side ID generation (offline-first support)
        // Content/paragraphs are NOT sent here - they are saved separately via saveParagraphs()
        const insertResponse = await postMyScenesBySceneIdMessages({
          path: { sceneId },
          body: {
            id: operation.data.id,
            instruction: operation.data.instruction,
            script: operation.data.script,
            sortOrder: operation.data.order,
            isQuery: operation.data.isQuery,
            // Forward type + type-specific payload so non-paragraph messages
            // (event / branch / background) land with their discriminator
            // set on first insert rather than relying on a follow-up update.
            type: operation.data.type ?? undefined,
            options: operation.data.options,
            backgroundFileId: operation.data.backgroundFileId ?? undefined,
            audioFileId: operation.data.audioFileId ?? undefined,
          } as {
            instruction?: string
            script?: string
            sortOrder?: number
            id?: string
            isQuery?: boolean
            type?: string
            options?: Array<{ id: string; label: string; targetNodeId: string; targetMessageId: string; description?: string }>
            backgroundFileId?: string
            audioFileId?: string
          },
        })
        if (insertResponse.data?.message) {
          this.updateLastKnownTimestamp(insertResponse.data.message.updatedAt)

          // Update the frontend message with the currentMessageRevisionId from backend
          const revisionId = insertResponse.data.message.currentMessageRevisionId
          if (revisionId) {
            this.onMessageCreated?.(operation.data.id, { currentMessageRevisionId: revisionId })
          }
        }
        break
      }

      case 'message-update': {
        // Update message metadata using new endpoint
        // Note: content/paragraphs are saved separately via saveParagraphs()
        // Map sceneId to nodeId for the backend API
        const updateResponse = await patchMyMessagesById({
          path: { id: entityId },
          // Cast: `backgroundFileId` is part of the backend API but the
          // generated SDK hasn't been regenerated yet (regen happens after
          // Bart runs the pending Prisma migration — see CURRENT_TASK.md).
          // Once regenerated, this cast can be removed.
          body: {
            instruction: operation.data.instruction,
            script: operation.data.script,
            sortOrder: operation.data.order,
            nodeId: operation.data.sceneId, // sceneId on frontend = nodeId on backend
            isQuery: operation.data.isQuery,
            type: operation.data.type,
            options: operation.data.options,
            backgroundFileId: operation.data.backgroundFileId,
            audioFileId: operation.data.audioFileId,
          } as Parameters<typeof patchMyMessagesById>[0]['body'] & {
            backgroundFileId?: string | null
            audioFileId?: string | null
          },
        })
        // Message updated
        if (updateResponse.data?.message) {
          this.updateLastKnownTimestamp(updateResponse.data.message.updatedAt)
        }
        break
      }

      case 'message-delete': {
        const deleteResponse = await deleteMyMessagesById({ path: { id: entityId } })
        if (deleteResponse.data) {
          this.updateLastKnownTimestamp(new Date().toISOString())
        }
        break
      }

      case 'message-reorder': {
        // Map sceneId to nodeId for the API
        const items = operation.data.items.map((item) => ({
          messageId: item.messageId,
          nodeId: item.sceneId,
          order: item.order,
        }))
        const { data: reorderResponse } = await postMyStoriesByStoryIdMessagesReorder({
          path: { storyId },
          body: { items },
        })
        if (reorderResponse?.updatedAt) {
          this.updateLastKnownTimestamp(reorderResponse.updatedAt)
        }
        break
      }

      case 'message-batch': {
        const { postMyStoriesByStoryIdMessagesBatch } = await import('../client/config')
        const batchResult = await postMyStoriesByStoryIdMessagesBatch({
          path: { storyId },
          body: { messages: operation.data.messages },
        })
        if (batchResult.error) {
          throw new Error(batchResult.error.error || 'Batch save failed')
        }
        break
      }

      case 'character-insert': {
        let pictureFileId = operation.data.pictureFileId

        // Upload profile image if present as base64 data URI
        const imageData = operation.data.profileImageData
        if (imageData && imageData.startsWith('data:')) {
          const blob = base64ToBlob(imageData)

          const formData = new FormData()
          formData.append('file', blob, 'character-avatar.jpg')
          if (storyId) {
            formData.append('storyId', storyId)
          }

          const response = await fetch(`${getApiBaseUrl()}/my/files`, {
            method: 'POST',
            credentials: 'include',
            body: formData,
          })

          if (response.ok) {
            const result = await response.json()
            pictureFileId = result.file?.id
          } else {
            console.error('Failed to upload character image:', await response.text())
          }
        }

        const insertResult = await postMyStoriesByStoryIdCharacters({
          path: { storyId },
          body: {
            id: operation.data.id,
            firstName: operation.data.firstName,
            lastName: operation.data.lastName || undefined,
            middleName: operation.data.middleName || undefined,
            nickname: operation.data.nickname || undefined,
            description: operation.data.description || undefined,
            birthdate: operation.data.birthdate ?? undefined,
            isMainCharacter: operation.data.isMainCharacter,
            pictureFileId: pictureFileId || undefined,
          },
        })
        if (insertResult.error) {
          console.error('[saveService] postMyStoriesByStoryIdCharacters failed:', insertResult.error)
          throw new Error((insertResult.error as any)?.error || 'Character create failed')
        }
        break
      }

      case 'character-update': {
        console.log('[saveService] Processing character-update for:', entityId, 'description length:', operation.data.description?.length)
        let pictureFileId = operation.data.pictureFileId

        // Upload profile image if present as base64 data URI
        // profileImageData being a base64 data URI indicates a new image was selected
        // (null means clear the image, undefined means no change)
        // Note: profileImageData might be a URL when loaded from server - only process if it's base64
        const imageData = operation.data.profileImageData
        if (imageData && imageData.startsWith('data:')) {
          const blob = base64ToBlob(imageData)

          const formData = new FormData()
          formData.append('file', blob, 'character-avatar.jpg')
          if (storyId) {
            formData.append('storyId', storyId)
          }

          const response = await fetch(`${getApiBaseUrl()}/my/files`, {
            method: 'POST',
            credentials: 'include',
            body: formData,
          })

          if (response.ok) {
            const result = await response.json()
            pictureFileId = result.file?.id
          } else {
            console.error('Failed to upload character image:', await response.text())
          }
        }

        console.log('[saveService] Calling patchMyCharactersById for:', entityId)
        const result = await patchMyCharactersById({
          path: { id: entityId },
          body: {
            firstName: operation.data.firstName,
            lastName: operation.data.lastName,
            middleName: operation.data.middleName,
            nickname: operation.data.nickname,
            description: operation.data.description,
            birthdate: operation.data.birthdate ?? undefined,
            isMainCharacter: operation.data.isMainCharacter,
            pictureFileId: pictureFileId,
          },
        })
        if (result.error) {
          console.error('[saveService] patchMyCharactersById failed for:', entityId, result.error)
          throw new Error((result.error as any)?.error || 'Character update failed')
        }
        console.log('[saveService] patchMyCharactersById completed for:', entityId, 'success:', result.data?.success)
        break
      }

      case 'character-delete': {
        const deleteResult = await deleteMyCharactersById({ path: { id: entityId } })
        if (deleteResult.error) {
          console.error('[saveService] deleteMyCharactersById failed:', deleteResult.error)
          throw new Error((deleteResult.error as any)?.error || 'Character delete failed')
        }
        break
      }

      case 'context-insert': {
        await postMyStoriesByStoryIdContextItems({
          path: { storyId },
          body: {
            type: operation.data.type,
            name: operation.data.name,
            description: operation.data.description,
            isGlobal: operation.data.isGlobal,
          },
        })
        break
      }

      case 'context-update': {
        await patchMyContextItemsById({
          path: { id: entityId },
          body: {
            type: operation.data.type,
            name: operation.data.name,
            description: operation.data.description,
            isGlobal: operation.data.isGlobal,
          },
        })
        break
      }

      case 'context-delete':
        await deleteMyContextItemsById({ path: { id: entityId } })
        break

      case 'map-insert': {
        let fileId: string | undefined

        // If map has imageData, upload it first
        if (operation.data.imageData) {
          const blob = base64ToBlob(operation.data.imageData)

          // Upload file using multipart/form-data
          const formData = new FormData()
          formData.append('file', blob, `${operation.data.name || 'map'}.png`)
          if (storyId) {
            formData.append('storyId', storyId)
          }

          const response = await fetch(`${getApiBaseUrl()}/my/files`, {
            method: 'POST',
            credentials: 'include',
            body: formData,
          })

          if (!response.ok) {
            const message = await response.text()
            throw new Error(message || `Map image upload failed with status ${response.status}`)
          }

          const result = await response.json()
          fileId = result.file?.id
          if (!fileId) throw new Error('Map image upload did not return a file ID')
        }

        // Create map with fileId. The ID is the one the store already put in its
        // state, so edits made before the next reload address the same row.
        await postMyStoriesByStoryIdMaps({
          path: { storyId },
          body: {
            id: operation.data.id,
            name: operation.data.name,
            borderColor: operation.data.borderColor,
            fileId,
          },
        })
        break
      }

      case 'map-update': {
        await putMyMapsById({
          path: { id: entityId },
          body: {
            name: operation.data.name,
            borderColor: operation.data.borderColor,
            propertySchema: operation.data.propertySchema,
          },
        })
        break
      }

      case 'map-delete':
        await deleteMyMapsById({ path: { id: entityId } })
        break

      case 'landmark-insert': {
        await postMyMapsByMapIdLandmarks({
          path: { mapId: operation.data.mapId },
          body: {
            id: operation.data.id,
            x: operation.data.x,
            y: operation.data.y,
            name: operation.data.name,
            description: operation.data.description,
            type: operation.data.type,
            color: operation.data.color,
            size: operation.data.size,
            properties: operation.data.properties,
          },
        })
        break
      }

      case 'landmark-update': {
        await putMyLandmarksById({
          path: { id: entityId },
          body: {
            x: operation.data.x,
            y: operation.data.y,
            name: operation.data.name,
            description: operation.data.description,
            type: operation.data.type,
            color: operation.data.color,
            size: operation.data.size,
            properties: operation.data.properties,
          },
        })
        break
      }

      case 'landmark-delete':
        await deleteMyLandmarksById({ path: { id: entityId } })
        break

      case 'node-insert': {
        if (operation.data.type === 'book') {
          await postMyStoriesByStoryIdBooks({
            path: { storyId },
            body: {
              id: operation.data.id, // Pass client-generated ID
              name: operation.data.title,
              sentenceSummary: operation.data.sentenceSummary || undefined,
              paragraphSummary: operation.data.paragraphSummary || undefined,
              summary: operation.data.summary || undefined,
              sortOrder: operation.data.order ?? 0,
            },
          })
        } else if (operation.data.type === 'arc') {
          await postMyBooksByBookIdArcs({
            path: { bookId: operation.data.parentId! },
            body: {
              id: operation.data.id, // Pass client-generated ID
              name: operation.data.title,
              sentenceSummary: operation.data.sentenceSummary || undefined,
              paragraphSummary: operation.data.paragraphSummary || undefined,
              summary: operation.data.summary || undefined,
              sortOrder: operation.data.order ?? 0,
            },
          })
        } else if (operation.data.type === 'chapter') {
          await postMyArcsByArcIdChapters({
            path: { arcId: operation.data.parentId! },
            body: {
              id: operation.data.id, // Pass client-generated ID
              name: operation.data.title,
              sentenceSummary: operation.data.sentenceSummary || undefined,
              paragraphSummary: operation.data.paragraphSummary || undefined,
              summary: operation.data.summary || undefined,
              sortOrder: operation.data.order ?? 0,
              nodeType: operation.data.nodeType || 'story',
            },
          })
        } else if (operation.data.type === 'scene') {
          const { postMyChaptersByChapterIdScenes } = await import('../client/config')
          // Note: id is passed for client-side ID generation
          await postMyChaptersByChapterIdScenes({
            path: { chapterId: operation.data.parentId! },
            body: {
              id: operation.data.id,
              name: operation.data.title,
              sentenceSummary: operation.data.sentenceSummary || undefined,
              paragraphSummary: operation.data.paragraphSummary || undefined,
              summary: operation.data.summary || undefined,
              summarySegments: operation.data.summarySegments || undefined,
              sortOrder: operation.data.order ?? 0,
            } as any,
          })
        }
        break
      }

      case 'node-update': {
        if (operation.data.type === 'book') {
          await patchMyBooksById({
            path: { id: entityId },
            body: {
              name: operation.data.title,
              sentenceSummary: operation.data.sentenceSummary,
              paragraphSummary: operation.data.paragraphSummary,
              summary: operation.data.summary,
              sortOrder: operation.data.order,
              coverArtFileId: operation.data.coverArtFileId,
            } as any,
          })
        } else if (operation.data.type === 'arc') {
          await patchMyArcsById({
            path: { id: entityId },
            body: {
              name: operation.data.title,
              sentenceSummary: operation.data.sentenceSummary,
              paragraphSummary: operation.data.paragraphSummary,
              summary: operation.data.summary,
              sortOrder: operation.data.order,
            },
          })
        } else if (operation.data.type === 'chapter') {
          await patchMyChaptersById({
            path: { id: entityId },
            body: {
              name: operation.data.title,
              sentenceSummary: operation.data.sentenceSummary,
              paragraphSummary: operation.data.paragraphSummary,
              summary: operation.data.summary,
              sortOrder: operation.data.order,
              nodeType: operation.data.nodeType,
              status: operation.data.status,
            },
          })
        } else if (operation.data.type === 'scene') {
          const { patchMyScenesById } = await import('../client/config')
          await patchMyScenesById({
            path: { id: entityId },
            body: {
              name: operation.data.title,
              sentenceSummary: operation.data.sentenceSummary,
              paragraphSummary: operation.data.paragraphSummary,
              summary: operation.data.summary,
              summarySegments: operation.data.summarySegments,
              sortOrder: operation.data.order,
              includeInFull: operation.data.includeInFull,
              // Scene-specific fields for context/characters
              activeCharacterIds: operation.data.activeCharacterIds,
              activeContextItemIds: operation.data.activeContextItemIds,
              viewpointCharacterId: operation.data.viewpointCharacterId,
              goal: operation.data.goal,
              storyTime: operation.data.storyTime,
            },
          })
        }
        break
      }

      case 'node-delete': {
        const query = operation.data.permanent ? { permanent: 'true' as const } : undefined
        if (operation.data.type === 'book') {
          await deleteMyBooksById({ path: { id: entityId }, query })
        } else if (operation.data.type === 'arc') {
          await deleteMyArcsById({ path: { id: entityId }, query })
        } else if (operation.data.type === 'chapter') {
          await deleteMyChaptersById({ path: { id: entityId }, query })
        } else if (operation.data.type === 'scene') {
          await deleteMyScenesById({ path: { id: entityId }, query })
        }
        break
      }

      case 'node-bulk-update': {
        const items = operation.data.map((node: Node) => {
          const base = {
            nodeId: node.id,
            nodeType: node.type as 'book' | 'arc' | 'chapter' | 'scene',
            name: node.title,
            sentenceSummary: node.sentenceSummary,
            paragraphSummary: node.paragraphSummary,
            summary: node.summary,
            sortOrder: node.order,
            nodeType_: node.nodeType,
          }
          if (node.type === 'scene') {
            return {
              ...base,
              includeInFull: node.includeInFull,
              activeCharacterIds: node.activeCharacterIds,
              activeContextItemIds: node.activeContextItemIds,
              viewpointCharacterId: node.viewpointCharacterId,
              goal: node.goal,
              storyTime: node.storyTime,
            }
          }
          if (node.type === 'chapter') {
            return { ...base, status: node.status }
          }
          return base
        })
        const { data: bulkResponse } = await postMyStoriesByStoryIdNodesBulkUpdate({
          path: { storyId },
          body: { items },
        })
        if (bulkResponse?.updatedAt) {
          this.updateLastKnownTimestamp(bulkResponse.updatedAt)
        }
        break
      }

      case 'node-reorder': {
        const { data: reorderResponse } = await postMyStoriesByStoryIdNodesReorder({
          path: { storyId },
          body: { items: operation.data.items },
        })
        if (reorderResponse?.updatedAt) {
          this.updateLastKnownTimestamp(reorderResponse.updatedAt)
        }
        break
      }

      case 'landmark-state': {
        const { landmarkId, storyTime, field, value } = operation.data
        await postMyLandmarksByLandmarkIdStates({
          path: { landmarkId },
          body: { storyTime, field, value },
        })
        // Note: New API doesn't return updatedAt, but that's OK as this is now storyTime-based
        break
      }

      case 'fleet-insert': {
        // Fleet → Pawn migration: hyperdriveRating → speed
        await postMyMapsByMapIdPawns({
          path: { mapId: operation.data.mapId },
          body: {
            id: operation.data.id,
            name: operation.data.name,
            description: operation.data.description,
            designation: operation.data.designation,
            speed: operation.data.hyperdriveRating, // Map hyperdriveRating to speed
            defaultX: operation.data.defaultX,
            defaultY: operation.data.defaultY,
            color: operation.data.color,
            size: operation.data.size,
          },
        })
        break
      }

      case 'fleet-update': {
        // Fleet → Pawn migration: hyperdriveRating → speed
        await putMyPawnsById({
          path: { id: entityId },
          body: {
            name: operation.data.name,
            description: operation.data.description,
            designation: operation.data.designation,
            speed: operation.data.hyperdriveRating, // Map hyperdriveRating to speed
            defaultX: operation.data.defaultX,
            defaultY: operation.data.defaultY,
            color: operation.data.color,
            size: operation.data.size,
          },
        })
        break
      }

      case 'fleet-delete':
        await deleteMyPawnsById({ path: { id: entityId } })
        break

      // The movement's story and map are derived from the pawn server-side, so only
      // the timing and the coordinates travel in the body.
      case 'fleet-movement-insert': {
        await postMyPawnsByPawnIdMovements({
          path: { pawnId: operation.data.fleetId },
          body: {
            id: operation.data.id,
            startStoryTime: operation.data.startStoryTime,
            endStoryTime: operation.data.endStoryTime,
            startX: operation.data.startX,
            startY: operation.data.startY,
            endX: operation.data.endX,
            endY: operation.data.endY,
          },
        })
        break
      }

      case 'fleet-movement-update': {
        await putMyPawnMovementsById({
          path: { id: entityId },
          body: {
            startStoryTime: operation.data.startStoryTime,
            endStoryTime: operation.data.endStoryTime,
            startX: operation.data.startX,
            startY: operation.data.startY,
            endX: operation.data.endX,
            endY: operation.data.endY,
          },
        })
        break
      }

      case 'fleet-movement-delete': {
        await deleteMyPawnMovementsById({ path: { id: entityId } })
        break
      }

      case 'hyperlane-insert': {
        // Hyperlane → Path migration. The geometry lives in the segments, so a path
        // written without them is an empty lane -- both calls are the one save.
        await postMyMapsByMapIdPaths({
          path: { mapId: operation.data.mapId },
          body: {
            id: operation.data.id,
            speedMultiplier: operation.data.speedMultiplier,
          },
        })
        await putMyPathsByPathIdSegments({
          path: { pathId: operation.data.id },
          body: { segments: (operation.data.segments ?? []).map(hyperlaneSegmentToSegmentBody) },
        })
        break
      }

      case 'hyperlane-update': {
        // Hyperlane → Path migration
        await putMyPathsById({
          path: { id: entityId },
          body: {
            speedMultiplier: operation.data.speedMultiplier,
          },
        })
        // The store spreads the whole hyperlane into every update, so the segments
        // ride along even when only the speed changed. The endpoint reconciles by
        // ID, so re-sending an unchanged list is a no-op rather than ID churn.
        //
        // An empty array is sent through deliberately -- that is a lane whose
        // segments were all removed. Only an absent list is skipped, since that is
        // an update that says nothing about the geometry.
        if (operation.data.segments) {
          await putMyPathsByPathIdSegments({
            path: { pathId: entityId },
            body: { segments: operation.data.segments.map(hyperlaneSegmentToSegmentBody) },
          })
        }
        break
      }

      case 'hyperlane-delete':
        await deleteMyPathsById({ path: { id: entityId } })
        break

      case 'story-settings': {
        console.log('[SaveService] Saving story settings:', operation.data)
        // Map frontend values to backend enum values
        const perspectiveMap: Record<string, 'FIRST' | 'SECOND' | 'THIRD'> = {
          first: 'FIRST',
          second: 'SECOND',
          third: 'THIRD',
        }
        const tenseMap: Record<string, 'PAST' | 'PRESENT'> = {
          past: 'PAST',
          present: 'PRESENT',
        }
        // Build the body, including plotPointDefaults which may not be in generated types yet
        const updateBody: Record<string, unknown> = {
          name: operation.data.name,
          summary: operation.data.summary,
          coverArtFileId: operation.data.coverArtFileId,
          genre: operation.data.storySetting, // storySetting is the genre (fantasy, sci-fi, etc.)
          defaultPerspective: operation.data.person ? perspectiveMap[operation.data.person] : undefined,
          defaultTense: operation.data.tense ? tenseMap[operation.data.tense] : undefined,
          format: operation.data.format, // format is stored as-is (narrative or cyoa)
          paragraphsPerTurn: operation.data.paragraphsPerTurn,
          timelineStartTime: operation.data.timelineStartTime,
          timelineEndTime: operation.data.timelineEndTime,
          timelineGranularity: operation.data.timelineGranularity,
          provider: operation.data.provider,
          model: operation.data.model,
          aiOverrides: operation.data.aiOverrides,
          globalScript: operation.data.globalScript,
          selectedNodeId: operation.data.selectedNodeId,
          branchChoices: operation.data.branchChoices,
        }
        // Add plotPointDefaults if present (type will be updated when API client is regenerated)
        if (operation.data.plotPointDefaults !== undefined) {
          updateBody.plotPointDefaults = operation.data.plotPointDefaults
        }
        const settingsResponse = await patchMyStoriesById({
          path: { id: storyId },
          body: updateBody as any,
        })
        console.log('[SaveService] Settings response:', settingsResponse)
        if (settingsResponse.data?.story.updatedAt) {
          this.updateLastKnownTimestamp(settingsResponse.data.story.updatedAt)
        } else if (settingsResponse.error) {
          console.error('[SaveService] Failed to save settings:', settingsResponse.error)
          throw new Error(settingsResponse.error.error || 'Failed to save settings')
        }
        break
      }

      case 'story-publishing': {
        let publishedAt: string | null = null
        if (operation.data.mode === 'publish-now') {
          const res = await postMyStoriesByStoryIdPublishNow({
            path: { storyId },
          })
          if (res.error) throw new Error((res.error as any).error || 'Failed to publish story')
          publishedAt = res.data?.publishedAt ?? null
        } else if (operation.data.mode === 'unpublish') {
          const res = await postMyStoriesByStoryIdUnpublish({
            path: { storyId },
          })
          if (res.error) throw new Error((res.error as any).error || 'Failed to unpublish story')
          publishedAt = res.data?.publishedAt ?? null
        } else {
          // schedule
          const res = await patchMyStoriesByStoryIdPublishing({
            path: { storyId },
            body: { publishedAt: operation.data.publishedAt },
          })
          if (res.error) throw new Error((res.error as any).error || 'Failed to schedule story')
          publishedAt = res.data?.publishedAt ?? null
        }
        this.onStoryPublishingChanged?.(storyId, publishedAt)
        break
      }

      case 'chapter-publishing': {
        const chapterId = entityId
        let response: {
          publishedAt?: string | null
          firstChapterReleasedAt?: string | null
          lastChapterReleasedAt?: string | null
        } = {}
        if (operation.data.mode === 'publish-now') {
          const res = await postMyChaptersByChapterIdPublishNow({
            path: { chapterId },
          })
          if (res.error) throw new Error((res.error as any).error || 'Failed to publish chapter')
          response = res.data ?? {}
        } else if (operation.data.mode === 'unpublish') {
          const res = await postMyChaptersByChapterIdUnpublish({
            path: { chapterId },
          })
          if (res.error) throw new Error((res.error as any).error || 'Failed to unpublish chapter')
          response = res.data ?? {}
        } else {
          const res = await patchMyChaptersByChapterIdPublishing({
            path: { chapterId },
            body: { publishedAt: operation.data.publishedAt },
          })
          if (res.error) throw new Error((res.error as any).error || 'Failed to schedule chapter')
          response = res.data ?? {}
        }
        this.onChapterPublishingChanged?.(
          chapterId,
          storyId,
          response.publishedAt ?? null,
          {
            firstChapterReleasedAt: response.firstChapterReleasedAt ?? null,
            lastChapterReleasedAt: response.lastChapterReleasedAt ?? null,
          },
        )
        break
      }

      case 'story-background': {
        const res = await patchMyStoriesByStoryIdBackground({
          path: { storyId },
          body: { backgroundFileId: operation.data.backgroundFileId },
        })
        if (res.error) throw new Error((res.error as any).error || 'Failed to update story background')
        this.onBackgroundChanged?.(
          'story',
          storyId,
          storyId,
          res.data?.defaultBackgroundFileId ?? null,
          res.data?.defaultBackgroundFile?.path ?? null,
        )
        break
      }

      case 'book-background': {
        const bookId = entityId
        const res = await patchMyBooksByBookIdBackground({
          path: { bookId },
          body: { backgroundFileId: operation.data.backgroundFileId },
        })
        if (res.error) throw new Error((res.error as any).error || 'Failed to update book background')
        this.onBackgroundChanged?.(
          'book',
          bookId,
          storyId,
          res.data?.defaultBackgroundFileId ?? null,
          res.data?.defaultBackgroundFile?.path ?? null,
        )
        break
      }

      case 'arc-background': {
        const arcId = entityId
        const res = await patchMyArcsByArcIdBackground({
          path: { arcId },
          body: { backgroundFileId: operation.data.backgroundFileId },
        })
        if (res.error) throw new Error((res.error as any).error || 'Failed to update arc background')
        this.onBackgroundChanged?.(
          'arc',
          arcId,
          storyId,
          res.data?.defaultBackgroundFileId ?? null,
          res.data?.defaultBackgroundFile?.path ?? null,
        )
        break
      }

      case 'chapter-background': {
        const chapterId = entityId
        const res = await patchMyChaptersByChapterIdBackground({
          path: { chapterId },
          body: { backgroundFileId: operation.data.backgroundFileId },
        })
        if (res.error) throw new Error((res.error as any).error || 'Failed to update chapter background')
        this.onBackgroundChanged?.(
          'chapter',
          chapterId,
          storyId,
          res.data?.defaultBackgroundFileId ?? null,
          res.data?.defaultBackgroundFile?.path ?? null,
        )
        break
      }

      case 'scene-background': {
        const sceneId = entityId
        const res = await patchMyScenesBySceneIdBackground({
          path: { sceneId },
          body: { backgroundFileId: operation.data.backgroundFileId },
        })
        if (res.error) throw new Error((res.error as any).error || 'Failed to update scene background')
        this.onBackgroundChanged?.(
          'scene',
          sceneId,
          storyId,
          res.data?.defaultBackgroundFileId ?? null,
          res.data?.defaultBackgroundFile?.path ?? null,
        )
        break
      }

      default: {
        // Exhaustive check - this should never be reached
        const _exhaustive: never = operation
        console.warn('Unknown operation type:', _exhaustive)
      }
    }
  }

  // Save individual entities with debouncing
  private debouncedSaves = new Map<
    string,
    { timeout: ReturnType<typeof setTimeout>; operation: Omit<SaveOperation, 'id' | 'timestamp'> }
  >()

  private isOperation(operation: SaveOperation, action: 'insert' | 'update' | 'delete'): boolean {
    const expectedType = `${operation.entityType}-${action}` as SaveOperationType
    return operation.type === expectedType
  }

  private mergeOperationData(target: SaveOperation, source: SaveOperation) {
    if (
      target.data &&
      source.data &&
      typeof target.data === 'object' &&
      typeof source.data === 'object' &&
      !Array.isArray(target.data) &&
      !Array.isArray(source.data)
    ) {
      target.data = { ...target.data, ...source.data }
    } else if (source.data !== undefined) {
      target.data = source.data
    }
  }

  private debouncedQueueSave(
    operation: Omit<SaveOperation, 'id' | 'timestamp'>,
    delay = 2000, // Increased from 500ms to 2000ms to reduce saves during streaming
  ) {
    const key = `${operation.entityType}-${operation.entityId}`

    // Clear existing timeout
    const existing = this.debouncedSaves.get(key)
    if (existing) {
      clearTimeout(existing.timeout)
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      this.debouncedSaves.delete(key)
      this.queueSave(operation)
    }, delay)

    this.debouncedSaves.set(key, { timeout, operation })
  }

  /** Immediately enqueue every debounced write and wait for the queue to drain. */
  async flushPendingSaves(): Promise<void> {
    const pending = [...this.debouncedSaves.values()]
    this.debouncedSaves.clear()
    const queuedSaves: Promise<void>[] = []
    for (const { timeout, operation } of pending) {
      clearTimeout(timeout)
      queuedSaves.push(this.queueSave(operation))
    }
    await Promise.all(queuedSaves)
    await this.processingPromise
  }

  // Public save methods
  saveMessage(
    storyId: string,
    messageId: string,
    message: Message,
    operation: 'insert' | 'update' | 'delete',
    debounce = true,
    afterMessageId?: string | null,
  ) {
    // Save message

    const messageData =
      operation === 'insert' && afterMessageId !== undefined ? { ...message, afterMessageId } : message

    const saveOp = {
      type: `message-${operation}` as SaveOperationType,
      entityType: 'message' as const,
      entityId: messageId,
      storyId,
      data: operation !== 'delete' ? messageData : undefined,
    }

    if (debounce && operation === 'update') {
      // Using debounced save with longer delay for streaming updates
      this.debouncedQueueSave(saveOp, 2000)
    } else {
      // Using immediate save
      this.queueSave(saveOp)
    }
  }

  createCharacter(storyId: string, character: Character) {
    this.queueSave({
      type: 'character-insert',
      entityType: 'character',
      entityId: character.id,
      storyId,
      data: character,
    })
  }

  updateCharacter(storyId: string, characterId: string, character: Character) {
    console.log('[saveService.updateCharacter] Queueing character update:', characterId, 'description length:', character.description?.length)
    this.queueSave({
      type: 'character-update',
      entityType: 'character',
      entityId: characterId,
      storyId,
      data: character,
    })
  }

  deleteCharacter(storyId: string, characterId: string) {
    this.queueSave({
      type: 'character-delete',
      entityType: 'character',
      entityId: characterId,
      storyId,
    })
  }

  createContextItem(storyId: string, item: ContextItem) {
    this.queueSave({
      type: 'context-insert',
      entityType: 'context',
      entityId: item.id,
      storyId,
      data: item,
    })
  }

  updateContextItem(storyId: string, itemId: string, item: ContextItem) {
    this.queueSave({
      type: 'context-update',
      entityType: 'context',
      entityId: itemId,
      storyId,
      data: item,
    })
  }

  deleteContextItem(storyId: string, itemId: string) {
    this.queueSave({
      type: 'context-delete',
      entityType: 'context',
      entityId: itemId,
      storyId,
    })
  }

  createMap(storyId: string, map: StoryMap) {
    this.queueSave({
      type: 'map-insert',
      entityType: 'map',
      entityId: map.id,
      storyId,
      data: map,
    })
  }

  updateMap(storyId: string, mapId: string, map: StoryMap, debounce = false) {
    const saveOp = {
      type: 'map-update' as SaveOperationType,
      entityType: 'map' as const,
      entityId: mapId,
      storyId,
      data: map,
    }

    if (debounce) {
      this.debouncedQueueSave(saveOp, 500)
    } else {
      this.queueSave(saveOp)
    }
  }

  deleteMap(storyId: string, mapId: string) {
    this.queueSave({
      type: 'map-delete',
      entityType: 'map',
      entityId: mapId,
      storyId,
    })
  }

  // Landmark operations
  createLandmark(storyId: string, mapId: string, landmark: any) {
    this.queueSave({
      type: 'landmark-insert',
      entityType: 'landmark',
      entityId: landmark.id,
      storyId,
      data: { ...landmark, mapId },
    })
  }

  updateLandmark(storyId: string, mapId: string, landmarkId: string, landmark: any, debounce = false) {
    const saveOp = {
      type: 'landmark-update' as SaveOperationType,
      entityType: 'landmark' as const,
      entityId: landmarkId,
      storyId,
      data: { ...landmark, mapId },
    }

    if (debounce) {
      this.debouncedQueueSave(saveOp, 500)
    } else {
      this.queueSave(saveOp)
    }
  }

  deleteLandmark(storyId: string, mapId: string, landmarkId: string) {
    this.queueSave({
      type: 'landmark-delete',
      entityType: 'landmark',
      entityId: landmarkId,
      storyId,
      data: { mapId },
    })
  }

  saveLandmarkState(
    storyId: string,
    mapId: string,
    landmarkId: string,
    storyTime: number,
    field: string,
    value: string | null,
  ) {
    this.queueSave({
      type: 'landmark-state',
      entityType: 'landmark-state',
      entityId: `${mapId}-${landmarkId}-${storyTime}-${field}`,
      storyId,
      data: { mapId, landmarkId, storyTime, field, value },
    })
  }

  // Node operations
  saveNode(
    storyId: string,
    nodeId: string,
    node: Node | Partial<Node>,
    operation: 'insert' | 'update' | 'delete',
    debounce = false,
  ) {
    if (operation === 'delete') {
      // Deletes should not be debounced
      this.queueSave({
        type: 'node-delete',
        entityType: 'node',
        entityId: nodeId,
        storyId,
        data: node,
      })
    } else {
      // Filter out UI-only and computed fields before saving
      const { isSummarizing, wordCount, messageWordCounts, children, createdAt, updatedAt, isOpen, ...nodeData } =
        node as any

      const saveOp = {
        type: operation === 'insert' ? ('node-insert' as const) : ('node-update' as const),
        entityType: 'node' as const,
        entityId: nodeId,
        storyId,
        data: nodeData,
      }

      if (debounce) {
        this.debouncedQueueSave(saveOp, 1000)
      } else {
        this.queueSave(saveOp)
      }
    }
  }

  // Bulk update nodes (for structure changes like reordering)
  saveNodesBulk(storyId: string, nodes: Node[]) {
    const sanitizedNodes = nodes.map((node) => {
      const { isSummarizing, wordCount, messageWordCounts, children, createdAt, updatedAt, isOpen, ...nodeData } =
        node as any
      return nodeData
    })

    this.queueSave({
      type: 'node-bulk-update',
      entityType: 'node',
      entityId: `bulk-${Date.now()}`,
      storyId,
      data: sanitizedNodes,
    })
  }

  // Reorder messages
  reorderMessages(storyId: string, items: Array<{ messageId: string; sceneId: string; order: number }>) {
    this.queueSave({
      type: 'message-reorder',
      entityType: 'message',
      entityId: 'reorder-batch', // Special ID for reorder operations
      storyId,
      data: { items },
    })
  }

  // Reorder nodes (books, arcs, chapters, scenes)
  reorderNodes(
    storyId: string,
    items: Array<{ nodeId: string; nodeType: 'book' | 'arc' | 'chapter' | 'scene'; parentId: string | null; order: number }>,
  ) {
    this.queueSave({
      type: 'node-reorder',
      entityType: 'node',
      entityId: 'node-reorder-batch',
      storyId,
      data: { items },
    })
  }

  // Save story settings (person, tense, etc.)
  saveStorySettings(
    storyId: string,
    settings: Partial<{
      name: string
      summary: string | null
      coverArtFileId: string | null
      person: 'first' | 'second' | 'third'
      tense: 'present' | 'past'
      storySetting: string
      format: 'narrative' | 'cyoa'
      paragraphsPerTurn: number
      globalScript: string
      selectedChapterId: string | null
      selectedNodeId: string | null
      branchChoices: Record<string, string>
      timelineStartTime: number | undefined
      timelineEndTime: number | undefined
      timelineGranularity: 'hour' | 'day'
      provider: string
      model: string | null
      aiOverrides: {
        provider?: string | null
        model?: string | null
        maxTokens?: number | null
        thinkingBudget?: number | null
        contextSize?: number | null
        categoryOverrides?: Record<string, unknown> | null
      } | null
    }>,
  ) {
    // Generate a unique ID for this settings update
    const settingsId = `settings-${Date.now()}`

    this.queueSave({
      type: 'story-settings',
      entityType: 'story-settings',
      entityId: settingsId,
      storyId,
      data: settings,
    })
  }

  // Publishing operations — all return the queue-drain promise so callers
  // (modals) can await completion and close / show a spinner. The queue
  // deduplicates by (entityType, entityId), so using a fixed entityId per
  // story/chapter means rapid repeat clicks collapse to the latest intent.

  saveStoryPublishing(
    storyId: string,
    data:
      | { mode: 'publish-now' }
      | { mode: 'unpublish' }
      | { mode: 'schedule'; publishedAt: string },
  ): Promise<void> {
    return this.queueSave({
      type: 'story-publishing',
      entityType: 'story-publishing',
      entityId: storyId,
      storyId,
      data,
    })
  }

  saveChapterPublishing(
    storyId: string,
    chapterId: string,
    data:
      | { mode: 'publish-now' }
      | { mode: 'unpublish' }
      | { mode: 'schedule'; publishedAt: string },
  ): Promise<void> {
    return this.queueSave({
      type: 'chapter-publishing',
      entityType: 'chapter-publishing',
      entityId: chapterId,
      storyId,
      data,
    })
  }

  // Default-background operations. Same dedupe pattern as publishing — the
  // queue collapses repeat picks per (entityType, entityId), so a rapid
  // sequence of clicks resolves to the latest selection.
  saveStoryBackground(storyId: string, backgroundFileId: string | null): Promise<void> {
    return this.queueSave({
      type: 'story-background',
      entityType: 'story-background',
      entityId: storyId,
      storyId,
      data: { backgroundFileId },
    })
  }

  saveBookBackground(storyId: string, bookId: string, backgroundFileId: string | null): Promise<void> {
    return this.queueSave({
      type: 'book-background',
      entityType: 'book-background',
      entityId: bookId,
      storyId,
      data: { backgroundFileId },
    })
  }

  saveArcBackground(storyId: string, arcId: string, backgroundFileId: string | null): Promise<void> {
    return this.queueSave({
      type: 'arc-background',
      entityType: 'arc-background',
      entityId: arcId,
      storyId,
      data: { backgroundFileId },
    })
  }

  saveChapterBackground(storyId: string, chapterId: string, backgroundFileId: string | null): Promise<void> {
    return this.queueSave({
      type: 'chapter-background',
      entityType: 'chapter-background',
      entityId: chapterId,
      storyId,
      data: { backgroundFileId },
    })
  }

  saveSceneBackground(storyId: string, sceneId: string, backgroundFileId: string | null): Promise<void> {
    return this.queueSave({
      type: 'scene-background',
      entityType: 'scene-background',
      entityId: sceneId,
      storyId,
      data: { backgroundFileId },
    })
  }

  // Fleet operations
  createFleet(storyId: string, mapId: string, fleet: Fleet) {
    this.queueSave({
      type: 'fleet-insert',
      entityType: 'fleet',
      entityId: fleet.id,
      storyId,
      data: { ...fleet, mapId },
    })
  }

  updateFleet(storyId: string, mapId: string, fleetId: string, fleet: Fleet, debounce = false) {
    const saveOp = {
      type: 'fleet-update' as SaveOperationType,
      entityType: 'fleet' as const,
      entityId: fleetId,
      storyId,
      data: { ...fleet, mapId },
    }

    if (debounce) {
      this.debouncedQueueSave(saveOp, 500)
    } else {
      this.queueSave(saveOp)
    }
  }

  deleteFleet(storyId: string, mapId: string, fleetId: string) {
    this.queueSave({
      type: 'fleet-delete',
      entityType: 'fleet',
      entityId: fleetId,
      storyId,
      data: { mapId },
    })
  }

  createFleetMovement(storyId: string, mapId: string, fleetId: string, movement: FleetMovement) {
    this.queueSave({
      type: 'fleet-movement-insert',
      entityType: 'fleet-movement',
      entityId: movement.id,
      storyId,
      data: { ...movement, mapId, fleetId },
    })
  }

  updateFleetMovement(
    storyId: string,
    mapId: string,
    fleetId: string,
    movementId: string,
    movement: FleetMovement,
    debounce = false,
  ) {
    const saveOp = {
      type: 'fleet-movement-update' as SaveOperationType,
      entityType: 'fleet-movement' as const,
      entityId: movementId,
      storyId,
      data: { ...movement, mapId, fleetId },
    }

    if (debounce) {
      this.debouncedQueueSave(saveOp, 500)
    } else {
      this.queueSave(saveOp)
    }
  }

  deleteFleetMovement(storyId: string, mapId: string, fleetId: string, movementId: string) {
    this.queueSave({
      type: 'fleet-movement-delete',
      entityType: 'fleet-movement',
      entityId: movementId,
      storyId,
      data: { mapId, fleetId },
    })
  }

  // Hyperlane operations
  createHyperlane(storyId: string, mapId: string, hyperlane: Hyperlane) {
    this.queueSave({
      type: 'hyperlane-insert',
      entityType: 'hyperlane',
      entityId: hyperlane.id,
      storyId,
      data: { ...hyperlane, mapId },
    })
  }

  updateHyperlane(storyId: string, mapId: string, hyperlaneId: string, hyperlane: Hyperlane, debounce = false) {
    const saveOp = {
      type: 'hyperlane-update' as SaveOperationType,
      entityType: 'hyperlane' as const,
      entityId: hyperlaneId,
      storyId,
      data: { ...hyperlane, mapId },
    }

    if (debounce) {
      this.debouncedQueueSave(saveOp, 500)
    } else {
      this.queueSave(saveOp)
    }
  }

  deleteHyperlane(storyId: string, mapId: string, hyperlaneId: string) {
    this.queueSave({
      type: 'hyperlane-delete',
      entityType: 'hyperlane',
      entityId: hyperlaneId,
      storyId,
      data: { mapId },
    })
  }

  // Cancel all pending saves
  cancelAllPendingSaves() {
    // Clear debounced saves
    for (const { timeout } of this.debouncedSaves.values()) {
      clearTimeout(timeout)
    }
    this.debouncedSaves.clear()

    // Clear queue
    this.state.queue = []
    this.onQueueLengthChange?.(0)
    // Cancelled pending saves
  }

  /**
   * Save paragraphs by diffing original and new paragraphs.
   * Creates, updates, or deletes paragraphs as needed.
   *
   * Paragraphs now have body and contentSchema fields that match the backend format directly.
   *
   * @param messageRevisionId - The ID of the message revision that owns these paragraphs
   * @param originalParagraphs - The original paragraphs before editing
   * @param newParagraphs - The new paragraphs after editing
   * @returns Promise that resolves when all save operations complete
   */
  async saveParagraphs(
    messageRevisionId: string,
    originalParagraphs: Paragraph[],
    newParagraphs: Paragraph[],
  ): Promise<{ created: number; updated: number; deleted: number }> {
    // Convert frontend state to API state format
    const toApiState = (
      state: Paragraph['state'] | undefined,
    ): 'AI' | 'DRAFT' | 'REVISE' | 'FINAL' | 'SDT' | undefined => {
      if (!state) return undefined
      return state.toUpperCase() as 'AI' | 'DRAFT' | 'REVISE' | 'FINAL' | 'SDT'
    }

    const originalMap = new Map(originalParagraphs.map((p) => [p.id, p]))
    const newMap = new Map(newParagraphs.map((p) => [p.id, p]))

    const toCreate: Paragraph[] = []
    const toUpdate: Paragraph[] = []
    const toDelete: string[] = []

    // Find new and updated paragraphs
    for (const [id, newPara] of newMap) {
      const original = originalMap.get(id)
      if (!original) {
        // New paragraph
        toCreate.push(newPara)
      } else {
        // Check if changed (compare body and contentSchema)
        if (
          original.body !== newPara.body ||
          original.contentSchema !== newPara.contentSchema ||
          original.state !== newPara.state
        ) {
          toUpdate.push(newPara)
        }
      }
    }

    // Find deleted paragraphs
    for (const [id] of originalMap) {
      if (!newMap.has(id)) {
        toDelete.push(id)
      }
    }

    console.log(
      `[SaveService.saveParagraphs] Changes: ${toCreate.length} create, ${toUpdate.length} update, ${toDelete.length} delete`,
    )

    // Use bulk endpoint for creates (single API call instead of N calls)
    let createdCount = 0
    let createError: Error | null = null
    if (toCreate.length > 0) {
      try {
        const bulkCreateResult = await postMyMessageRevisionsByRevisionIdParagraphsBatch({
          path: { revisionId: messageRevisionId },
          body: {
            paragraphs: toCreate.map((para) => ({
              id: para.id,
              body: para.body,
              contentSchema: para.contentSchema ?? undefined,
              state: toApiState(para.state),
              sortOrder: newParagraphs.findIndex((p) => p.id === para.id),
            })),
          },
        })
        if (bulkCreateResult.data) {
          createdCount = bulkCreateResult.data.created
        } else if (bulkCreateResult.error) {
          console.error('[SaveService.saveParagraphs] Bulk create failed:', bulkCreateResult.error)
          createError = new Error(bulkCreateResult.error.error || 'Bulk create failed')
        }
      } catch (error) {
        console.error('[SaveService.saveParagraphs] Bulk create error:', error)
        createError = error as Error
      }
    }

    // Updates and deletes still run in parallel (they are individual operations).
    // Build a minimal PATCH body per paragraph — only send fields that actually
    // changed (state flips shouldn't re-send the entire paragraph body).
    const updatePromises = toUpdate.map((para) => {
      const original = originalMap.get(para.id)!
      const body: {
        body?: string
        contentSchema?: string | null
        state?: 'AI' | 'DRAFT' | 'REVISE' | 'FINAL' | 'SDT'
        sortOrder?: number
      } = {}
      if (original.body !== para.body) body.body = para.body
      if (original.contentSchema !== para.contentSchema) body.contentSchema = para.contentSchema
      if (original.state !== para.state) body.state = toApiState(para.state)
      const newIdx = newParagraphs.findIndex((p) => p.id === para.id)
      const origIdx = originalParagraphs.findIndex((p) => p.id === para.id)
      if (newIdx !== origIdx) body.sortOrder = newIdx

      return patchMyParagraphsById({
        path: { id: para.id },
        body,
      })
        .then(() => ({ success: true, id: para.id }))
        .catch((error) => {
          console.error(`[SaveService.saveParagraphs] Failed to update paragraph ${para.id}:`, error)
          return { success: false, id: para.id, error }
        })
    })

    const deletePromises = toDelete.map((id) =>
      deleteMyParagraphsById({
        path: { id },
      })
        .then(() => ({ success: true, id }))
        .catch((error) => {
          console.error(`[SaveService.saveParagraphs] Failed to delete paragraph ${id}:`, error)
          return { success: false, id, error }
        })
    )

    // Run update and delete operations in parallel
    const [updateResults, deleteResults] = await Promise.all([
      Promise.all(updatePromises),
      Promise.all(deletePromises),
    ])

    const updatedCount = updateResults.filter((r) => r.success).length
    const deletedCount = deleteResults.filter((r) => r.success).length
    const errorCount =
      (createError ? toCreate.length : 0) +
      updateResults.filter((r) => !r.success).length +
      deleteResults.filter((r) => !r.success).length

    if (errorCount > 0) {
      console.error(`[SaveService.saveParagraphs] ${errorCount} errors occurred during save`)
    }

    console.log(
      `[SaveService.saveParagraphs] Completed: ${createdCount} created, ${updatedCount} updated, ${deletedCount} deleted`,
    )

    return {
      created: createdCount,
      updated: updatedCount,
      deleted: deletedCount,
    }
  }

  /**
   * Update the body of specific paragraphs (for find/replace operations).
   * This preserves paragraph structure and only updates the text content.
   *
   * @param paragraphs - Paragraphs with updated body text
   */
  async updateParagraphBodies(paragraphs: Array<{ id: string; body: string }>): Promise<void> {
    const updatePromises = paragraphs.map((p) =>
      patchMyParagraphsById({
        path: { id: p.id },
        body: { body: p.body },
      }).catch((err) => {
        console.error(`[SaveService.updateParagraphBodies] Failed to update paragraph ${p.id}:`, err)
      }),
    )
    await Promise.all(updatePromises)
  }

  /**
   * Create a new message revision with new content.
   * This is the proper way to replace content (regeneration, AI rewrite, etc.)
   * - it creates a new revision rather than mutating the existing one.
   *
   * @param messageId - The message ID
   * @param newContent - New content string (will be split on double newlines)
   * @param metadata - Optional metadata for the revision (model, tokens, etc.)
   * @returns The new revision ID and updates to apply to local message state
   */
  async createMessageRevision(
    messageId: string,
    newContent: string,
    metadata?: {
      model?: string
      tokensPerSecond?: number
      totalTokens?: number
      promptTokens?: number
      cacheCreationTokens?: number
      cacheReadTokens?: number
      think?: string
      showThink?: boolean
    },
  ): Promise<{ revisionId: string; paragraphs: Paragraph[] }> {
    // Create new revision via regenerate endpoint
    const { data, error } = await postMyMessagesByIdRegenerate({
      path: { id: messageId },
      body: metadata || {},
    })

    if (error || !data) {
      throw new Error(`Failed to create message revision: ${error}`)
    }

    const revisionId = data.revision.id

    // Split content and create paragraphs with client-generated IDs
    const paragraphTexts = newContent
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)

    // Create paragraph objects with client-generated IDs (local state is authoritative)
    const paragraphs: Paragraph[] = paragraphTexts.map((text) => ({
      id: generateMessageId(),
      body: text,
      state: 'ai' as const,
      comments: [],
    }))

    if (paragraphs.length > 0) {
      try {
        await postMyMessageRevisionsByRevisionIdParagraphsBatch({
          path: { revisionId },
          body: {
            paragraphs: paragraphs.map((p, index) => ({
              id: p.id,
              body: p.body,
              state: 'AI' as const,
              sortOrder: index,
            })),
          },
        })
      } catch (err) {
        console.error('[SaveService.createMessageRevision] Failed to create paragraphs:', err)
      }
    }

    return { revisionId, paragraphs }
  }

  // ============================================================================
  // PLOT POINT OPERATIONS
  // ============================================================================

  /**
   * Save plot point defaults (definitions) to the story
   * This updates the story's plotPointDefaults field
   */
  savePlotPointDefaults(storyId: string, definitions: any[]) {
    this.queueSave({
      type: 'story-settings',
      entityType: 'story-settings',
      entityId: `plot-point-defaults-${Date.now()}`,
      storyId,
      data: { plotPointDefaults: definitions },
    })
  }

  /**
   * Save a plot point state at a specific message
   * This calls the API directly (not queued) for immediate feedback
   */
  async savePlotPointState(_storyId: string, messageId: string, key: string, value: string) {
    try {
      await postMyMessagesByMessageIdPlotPointStates({
        path: { messageId },
        body: { key, value },
      })
    } catch (error) {
      console.error('[SaveService] Failed to save plot point state:', error)
      throw error
    }
  }

  /**
   * Delete a plot point state at a specific message
   */
  async deletePlotPointState(messageId: string, key: string) {
    try {
      await deleteMyMessagesByMessageIdPlotPointStatesByKey({
        path: { messageId, key },
      })
    } catch (error) {
      console.error('[SaveService] Failed to delete plot point state:', error)
      throw error
    }
  }

  /**
   * Save a paragraph script
   * This calls the API directly (not queued) for immediate feedback
   */
  async saveParagraphScript(_storyId: string, paragraphId: string, script: string | null) {
    try {
      await patchMyParagraphsById({
        path: { id: paragraphId },
        body: { script: script ?? undefined },
      })
      console.log('[SaveService] Saved paragraph script:', paragraphId)
    } catch (error) {
      console.error('[SaveService] Failed to save paragraph script:', error)
      throw error
    }
  }

  /**
   * Save paragraph script and inventory actions together
   * This calls the API directly (not queued) for immediate feedback
   */
  async saveParagraphScriptAndInventory(
    _storyId: string,
    paragraphId: string,
    script: string | null,
    inventoryActions: any[] | null,
  ) {
    try {
      await patchMyParagraphsById({
        path: { id: paragraphId },
        body: {
          script: script ?? undefined,
          inventoryActions: inventoryActions ?? undefined,
        },
      })
      console.log('[SaveService] Saved paragraph script and inventory:', paragraphId)
    } catch (error) {
      console.error('[SaveService] Failed to save paragraph script/inventory:', error)
      throw error
    }
  }

  // ============================================================================
  // BATCH MESSAGE OPERATIONS
  // ============================================================================

  /**
   * Batch create messages with their paragraphs in a single API call.
   * This is much more efficient than creating messages one by one.
   * Uses the save queue to ensure proper ordering with other operations.
   *
   * @param storyId - The story ID
   * @param messages - Array of messages to create with their content
   */
  async saveMessagesBatch(
    storyId: string,
    messages: Array<{
      id?: string
      sceneId: string
      sortOrder: number
      instruction?: string
      script?: string
      content?: string // Will be split into paragraphs
      type?: 'chapter' | 'event' | 'branch' | 'background' | 'audio' | null
      options?: Array<{
        id: string
        label: string
        targetNodeId: string
        targetMessageId: string
        description?: string
      }>
      backgroundFileId?: string | null
      audioFileId?: string | null
    }>,
  ): Promise<void> {
    // Transform messages to API format, splitting content into paragraphs
    const batchMessages = messages.map((msg) => {
      // Split content into paragraphs (double newline separation)
      const paragraphs = msg.content
        ? msg.content
            .split(/\n\n+/)
            .map((p) => p.trim())
            .filter((p) => p.length > 0)
            .map((body, index) => ({
              body,
              sortOrder: index,
            }))
        : undefined

      return {
        id: msg.id,
        sceneId: msg.sceneId,
        sortOrder: msg.sortOrder,
        instruction: msg.instruction ?? null,
        script: msg.script ?? null,
        type: msg.type ?? null,
        options: msg.options,
        backgroundFileId: msg.backgroundFileId ?? null,
        audioFileId: msg.audioFileId ?? null,
        paragraphs,
      }
    })

    console.log('[saveService.saveMessagesBatch] Queuing batch save:', {
      messageCount: batchMessages.length,
      messagesWithInstructions: batchMessages.filter(m => m.instruction).length,
      sampleMessage: batchMessages[0] ? {
        hasInstruction: !!batchMessages[0].instruction,
        instruction: batchMessages[0].instruction,
      } : null,
    })

    // Queue the batch operation - it will be processed in order after any pending operations
    await this.queueSave({
      type: 'message-batch',
      entityType: 'message',
      entityId: `batch-${Date.now()}`,
      storyId,
      data: { messages: batchMessages },
    })
  }

  // Get current save status
  getStatus() {
    return {
      isSaving: this.state.isProcessing || this.state.isFullSaveInProgress,
      queueLength: this.state.queue.length,
      currentOperation: this.state.currentOperation,
      isFullSaveInProgress: this.state.isFullSaveInProgress,
      queue: this.state.queue,
    }
  }

}

// Create singleton instance
export const saveService = new SaveService()
