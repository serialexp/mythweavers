import type { Paragraph } from '@mythweavers/shared'
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
  putMyPawnsById,
  postMyStoriesByStoryIdMessagesReorder,
  postMyStoriesByStoryIdNodesReorder,
  postMyLandmarksByLandmarkIdStates,
  postMyMessagesByMessageIdPlotPointStates,
  deleteMyMessagesByMessageIdPlotPointStatesByKey,
  getApiBaseUrl,
} from '../client/config'
import { currentStoryStore } from '../stores/currentStoryStore'
import { VersionConflictError } from '../types/api'
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
import { apiClient } from '../utils/apiClient'

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
      type?: 'chapter' | 'event' | 'branch' | null
      options?: Array<{
        id: string
        label: string
        targetNodeId: string
        targetMessageId: string
        description?: string
      }>
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

interface ContextStatesOperation extends SaveOperationBase {
  type: 'context-states'
  entityType: 'context-states'
  data: {
    characterStates: Array<{ characterId: string; messageId: string; isActive: boolean }>
    contextItemStates: Array<{ contextItemId: string; messageId: string; isActive: boolean }>
  }
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
    plotPointDefaults: unknown[]
  }>
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
  | ContextStatesOperation
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

  // Set callbacks for UI updates
  setCallbacks(callbacks: {
    onSaveStatusChange?: (isSaving: boolean) => void
    onQueueLengthChange?: (length: number) => void
    onConflict?: (serverUpdatedAt: string, clientUpdatedAt: string) => void
    onError?: (error: Error) => void
    onOperationFailed?: (operation: SaveOperation, error: Error) => void
    onMessageCreated?: (messageId: string, data: { currentMessageRevisionId: string }) => void
  }) {
    this.onSaveStatusChange = callbacks.onSaveStatusChange
    this.onQueueLengthChange = callbacks.onQueueLengthChange
    this.onConflict = callbacks.onConflict
    this.onError = callbacks.onError
    this.onOperationFailed = callbacks.onOperationFailed
    this.onMessageCreated = callbacks.onMessageCreated
  }

  private onQueueLengthChange?: (length: number) => void

  // Update last known timestamp (internal use only)
  private updateLastKnownTimestamp(timestamp: string) {
    this.state.lastKnownUpdatedAt = timestamp
    // Update in currentStoryStore directly
    currentStoryStore.setLastKnownUpdatedAt(timestamp)
  }

  // Trigger full save function (to be set by messagesStore)
  private triggerFullSave: () => void = () => {}

  setTriggerFullSave(fn: () => void) {
    this.triggerFullSave = fn
  }

  // Queue a save operation
  async queueSave(operation: Omit<SaveOperation, 'id' | 'timestamp'>): Promise<void> {
    // Check if this is a local story - if so, trigger a full save instead
    if (currentStoryStore.storageMode === 'local') {
      // For local stories, any save triggers a full save
      // Local story detected, triggering full save
      this.triggerFullSave()
      return
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

        // Notify about the failed operation
        this.onOperationFailed?.(operation, error as Error)

        // Check for authentication errors
        const errorMessage = error instanceof Error ? error.message : String(error)
        if (
          errorMessage.includes('401') ||
          errorMessage.includes('authentication') ||
          errorMessage.includes('Unauthorized') ||
          errorMessage.includes('Invalid session token')
        ) {
          console.error('[SaveService] Authentication error detected - user may need to log in again')
          this.onError?.(new Error('Authentication failed. Please log in again to save your work.'))
          // Clear the queue to prevent further failures
          this.state.queue = []
          this.onQueueLengthChange?.(0)
          break
        }

        // Handle version conflicts
        if (
          error instanceof VersionConflictError ||
          (error instanceof Error && (error as any).code === 'VERSION_CONFLICT')
        ) {
          const conflictError = error as VersionConflictError
          this.onConflict?.(
            conflictError.serverUpdatedAt || (error as any).serverUpdatedAt,
            conflictError.clientUpdatedAt || (error as any).clientUpdatedAt,
          )
          // Clear the queue on conflict
          this.state.queue = []
          this.onQueueLengthChange?.(0)
          break
        }

        // Check HTTP status code - don't retry client errors (4xx)
        // Try multiple ways to get the status code since different clients format errors differently
        let statusCode = (error as any)?.response?.status || (error as any)?.status

        // If status not found on error object, try parsing from error message
        // Old apiClient format: "POST /path failed with status 404"
        if (!statusCode && errorMessage) {
          const match = errorMessage.match(/status (\d{3})/)
          if (match) {
            statusCode = Number.parseInt(match[1], 10)
          }
        }

        const isClientError = statusCode >= 400 && statusCode < 500

        if (isClientError) {
          console.warn(`[SaveService] Client error (${statusCode}) detected, not retrying`)
          // Don't retry client errors - they won't succeed on retry
          // Just log and continue to next operation
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
          } as { instruction?: string; script?: string; sortOrder?: number; id?: string; isQuery?: boolean },
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
          body: {
            instruction: operation.data.instruction,
            script: operation.data.script,
            sortOrder: operation.data.order,
            nodeId: operation.data.sceneId, // sceneId on frontend = nodeId on backend
            isQuery: operation.data.isQuery,
            type: operation.data.type,
            options: operation.data.options,
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

        await postMyStoriesByStoryIdCharacters({
          path: { storyId },
          body: {
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
        console.log('[saveService] patchMyCharactersById completed for:', entityId, 'success:', result.data?.success)
        break
      }

      case 'character-delete':
        await deleteMyCharactersById({ path: { id: entityId } })
        break

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
          // Convert base64 to blob
          const base64Data = operation.data.imageData.split(',')[1] || operation.data.imageData
          const mimeType = operation.data.imageData.match(/data:([^;]+);/)?.[1] || 'image/png'
          const blob = await fetch(`data:${mimeType};base64,${base64Data}`).then((r) => r.blob())

          // Upload file using multipart/form-data
          const formData = new FormData()
          formData.append('file', blob, `${operation.data.name || 'map'}.png`)
          if (storyId) {
            formData.append('storyId', storyId)
          }

          const response = await fetch('http://localhost:3201/my/files', {
            method: 'POST',
            credentials: 'include',
            body: formData,
          })

          if (response.ok) {
            const result = await response.json()
            fileId = result.file?.id
          } else {
            console.error('Failed to upload map image:', await response.text())
          }
        }

        // Create map with fileId
        // Note: id is passed for client-side ID generation
        await postMyStoriesByStoryIdMaps({
          path: { storyId },
          body: {
            id: operation.data.id,
            name: operation.data.name,
            borderColor: operation.data.borderColor,
            fileId,
          } as { name: string; id?: string; fileId?: string; borderColor?: string },
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
              summary: operation.data.summary || undefined,
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
              summary: operation.data.summary,
              sortOrder: operation.data.order,
            },
          })
        } else if (operation.data.type === 'arc') {
          await patchMyArcsById({
            path: { id: entityId },
            body: {
              name: operation.data.title,
              summary: operation.data.summary,
              sortOrder: operation.data.order,
            },
          })
        } else if (operation.data.type === 'chapter') {
          await patchMyChaptersById({
            path: { id: entityId },
            body: {
              name: operation.data.title,
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
              summary: operation.data.summary,
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
        // Bulk update needs to be split into individual updates
        for (const node of operation.data) {
          if (node.type === 'book') {
            await patchMyBooksById({
              path: { id: node.id },
              body: {
                name: node.title,
                summary: node.summary,
                sortOrder: node.order,
              },
            })
          } else if (node.type === 'arc') {
            await patchMyArcsById({
              path: { id: node.id },
              body: {
                name: node.title,
                summary: node.summary,
                sortOrder: node.order,
              },
            })
          } else if (node.type === 'chapter') {
            await patchMyChaptersById({
              path: { id: node.id },
              body: {
                name: node.title,
                summary: node.summary,
                sortOrder: node.order,
                nodeType: node.nodeType,
                status: node.status,
              },
            })
          } else if (node.type === 'scene') {
            const { patchMyScenesById } = await import('../client/config')
            await patchMyScenesById({
              path: { id: node.id },
              body: {
                name: node.title,
                summary: node.summary,
                sortOrder: node.order,
                includeInFull: node.includeInFull,
                // Scene-specific fields for context/characters
                activeCharacterIds: node.activeCharacterIds,
                activeContextItemIds: node.activeContextItemIds,
                viewpointCharacterId: node.viewpointCharacterId,
                goal: node.goal,
                storyTime: node.storyTime,
              },
            })
          }
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

      case 'context-states': {
        const contextStatesResponse = await apiClient
          .fetch('/context-states/batch-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              storyId,
              ...operation.data,
            }),
          })
          .then((res) => res.json())
        this.updateLastKnownTimestamp(contextStatesResponse.updatedAt)
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

      case 'fleet-movement-insert': {
        const movementCreateResponse = await apiClient.createFleetMovement(
          storyId,
          operation.data.mapId,
          operation.data.fleetId,
          operation.data,
        )
        this.updateLastKnownTimestamp(movementCreateResponse.updatedAt)
        break
      }

      case 'fleet-movement-update': {
        const movementUpdateResponse = await apiClient.updateFleetMovement(
          storyId,
          operation.data.mapId,
          operation.data.fleetId,
          entityId,
          operation.data,
        )
        this.updateLastKnownTimestamp(movementUpdateResponse.updatedAt)
        break
      }

      case 'fleet-movement-delete': {
        const movementDeleteResponse = await apiClient.deleteFleetMovement(
          storyId,
          operation.data.mapId,
          operation.data.fleetId,
          entityId,
        )
        this.updateLastKnownTimestamp(movementDeleteResponse.updatedAt)
        break
      }

      case 'hyperlane-insert': {
        // Hyperlane → Path migration
        await postMyMapsByMapIdPaths({
          path: { mapId: operation.data.mapId },
          body: {
            speedMultiplier: operation.data.speedMultiplier,
          },
        })
        // TODO: PathSegments need to be created separately - segments not yet migrated
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

      default: {
        // Exhaustive check - this should never be reached
        const _exhaustive: never = operation
        console.warn('Unknown operation type:', _exhaustive)
      }
    }
  }

  // Save individual entities with debouncing
  private debouncedSaves = new Map<string, NodeJS.Timeout>()

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
      clearTimeout(existing)
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      this.debouncedSaves.delete(key)
      this.queueSave(operation)
    }, delay)

    this.debouncedSaves.set(key, timeout)
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

  // Save context states (character and context item states)
  saveContextStates(
    storyId: string,
    characterStates: Array<{ characterId: string; messageId: string; isActive: boolean }>,
    contextItemStates: Array<{ contextItemId: string; messageId: string; isActive: boolean }>,
  ) {
    this.queueSave({
      type: 'context-states',
      entityType: 'context-states',
      entityId: `context-states-${Date.now()}`,
      storyId,
      data: { characterStates, contextItemStates },
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

  // Manual full story save
  async saveFullStory(storyId: string, storyData: any): Promise<void> {
    // Cancel all pending operations
    this.cancelAllPendingSaves()

    // Set flag to prevent new saves during full save
    this.state.isFullSaveInProgress = true
    this.onSaveStatusChange?.(true)

    try {
      const response = await apiClient.updateStory(storyId, {
        ...storyData,
        lastKnownUpdatedAt: this.state.lastKnownUpdatedAt,
      })
      this.updateLastKnownTimestamp(response.updatedAt)
      // Full story save completed
    } catch (error) {
      // Handle version conflicts
      if (
        error instanceof VersionConflictError ||
        (error instanceof Error && (error as any).code === 'VERSION_CONFLICT')
      ) {
        const conflictError = error as VersionConflictError
        this.onConflict?.(
          conflictError.serverUpdatedAt || (error as any).serverUpdatedAt,
          conflictError.clientUpdatedAt || (error as any).clientUpdatedAt,
        )
      } else {
        this.onError?.(error as Error)
      }
      throw error
    } finally {
      this.state.isFullSaveInProgress = false
      this.onSaveStatusChange?.(false)
    }
  }

  // Cancel all pending saves
  cancelAllPendingSaves() {
    // Clear debounced saves
    for (const timeout of this.debouncedSaves.values()) {
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

    // Updates and deletes still run in parallel (they are individual operations)
    const updatePromises = toUpdate.map((para) =>
      patchMyParagraphsById({
        path: { id: para.id },
        body: {
          body: para.body,
          contentSchema: para.contentSchema,
          state: toApiState(para.state),
          sortOrder: newParagraphs.findIndex((p) => p.id === para.id),
        },
      })
        .then(() => ({ success: true, id: para.id }))
        .catch((error) => {
          console.error(`[SaveService.saveParagraphs] Failed to update paragraph ${para.id}:`, error)
          return { success: false, id: para.id, error }
        })
    )

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
  ): Promise<{ revisionId: string }> {
    // Create new revision via regenerate endpoint
    const { data, error } = await postMyMessagesByIdRegenerate({
      path: { id: messageId },
      body: metadata || {},
    })

    if (error || !data) {
      throw new Error(`Failed to create message revision: ${error}`)
    }

    const revisionId = data.revision.id

    // Split content and create paragraphs on the new revision using bulk endpoint
    const paragraphTexts = newContent
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)

    if (paragraphTexts.length > 0) {
      try {
        await postMyMessageRevisionsByRevisionIdParagraphsBatch({
          path: { revisionId },
          body: {
            paragraphs: paragraphTexts.map((text, index) => ({
              body: text,
              sortOrder: index,
            })),
          },
        })
      } catch (err) {
        console.error('[SaveService.createMessageRevision] Failed to create paragraphs:', err)
      }
    }

    return { revisionId }
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
      type?: 'chapter' | 'event' | 'branch' | null
      options?: Array<{
        id: string
        label: string
        targetNodeId: string
        targetMessageId: string
        description?: string
      }>
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
