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
  postMyMessageRevisionsByRevisionIdParagraphs,
  postMyScenesBySceneIdMessages,
  postMyStoriesByStoryIdBooks,
  postMyStoriesByStoryIdCharacters,
  postMyStoriesByStoryIdContextItems,
  postMyStoriesByStoryIdMaps,
  putMyLandmarksById,
  putMyMapsById,
  putMyPathsById,
  putMyPawnsById,
} from '../client/config'
import { currentStoryStore } from '../stores/currentStoryStore'
import { VersionConflictError } from '../types/api'
import {
  Chapter,
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

type SaveOperationType =
  | 'message-insert'
  | 'message-update'
  | 'message-delete'
  | 'message-reorder'
  | 'paragraph-insert'
  | 'paragraph-update'
  | 'paragraph-delete'
  | 'chapter-update'
  | 'chapter-delete'
  | 'character-insert'
  | 'character-update'
  | 'character-delete'
  | 'context-insert'
  | 'context-update'
  | 'context-delete'
  | 'context-states'
  | 'map-insert'
  | 'map-update'
  | 'map-delete'
  | 'landmark-insert'
  | 'landmark-update'
  | 'landmark-delete'
  | 'landmark-state'
  | 'node-insert'
  | 'node-update'
  | 'node-delete'
  | 'node-bulk-update'
  | 'fleet-insert'
  | 'fleet-update'
  | 'fleet-delete'
  | 'fleet-movement-insert'
  | 'fleet-movement-update'
  | 'fleet-movement-delete'
  | 'hyperlane-insert'
  | 'hyperlane-update'
  | 'hyperlane-delete'
  | 'story-settings'
  | 'full-story'

interface SaveOperation {
  id: string // Unique ID for this operation
  type: SaveOperationType
  entityType:
    | 'message'
    | 'paragraph'
    | 'chapter'
    | 'character'
    | 'context'
    | 'context-states'
    | 'map'
    | 'landmark'
    | 'landmark-state'
    | 'node'
    | 'fleet'
    | 'fleet-movement'
    | 'hyperlane'
    | 'story-settings'
    | 'story'
  entityId: string // ID of the entity being saved
  storyId: string
  data?: any // The actual data to save
  timestamp: number // When this was queued
  retryCount?: number
}

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

  // Set callbacks for UI updates
  setCallbacks(callbacks: {
    onSaveStatusChange?: (isSaving: boolean) => void
    onQueueLengthChange?: (length: number) => void
    onConflict?: (serverUpdatedAt: string, clientUpdatedAt: string) => void
    onError?: (error: Error) => void
    onOperationFailed?: (operation: SaveOperation, error: Error) => void
  }) {
    this.onSaveStatusChange = callbacks.onSaveStatusChange
    this.onQueueLengthChange = callbacks.onQueueLengthChange
    this.onConflict = callbacks.onConflict
    this.onError = callbacks.onError
    this.onOperationFailed = callbacks.onOperationFailed
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

    const op: SaveOperation = {
      ...operation,
      id: `${operation.entityType}-${operation.entityId}-${Date.now()}`,
      timestamp: Date.now(),
    }

    const existingIndex = this.state.queue.findIndex(
      (existing) => existing.entityType === op.entityType && existing.entityId === op.entityId,
    )

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
          // Apply update fields to the pending insert so the initial create carries latest data
          this.mergeOperationData(existing, op)
          existing.timestamp = op.timestamp
          shouldQueueOperation = false
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

    while (this.state.queue.length > 0 && !this.state.isFullSaveInProgress) {
      const operation = this.state.queue.shift()!
      this.state.currentOperation = operation

      // Notify about queue length change after removing item
      this.onQueueLengthChange?.(this.state.queue.length)

      try {
        await this.executeSaveOperation(operation)
        // Operation completed
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

    this.state.currentOperation = null
    this.state.isProcessing = false
    this.onSaveStatusChange?.(false)
    this.processingPromise = null
  }

  // Execute a single save operation
  private async executeSaveOperation(operation: SaveOperation): Promise<void> {
    const { storyId, entityId, data, type } = operation

    // Execute save operation

    switch (type) {
      case 'message-insert': {
        // For inserts, we need to know where to insert the message
        // The data should contain the afterMessageId and sceneId
        const insertData = data as Message & { afterMessageId?: string | null }
        const sceneId = insertData.sceneId
        if (!sceneId) {
          throw new Error('sceneId is required to insert a message')
        }
        // Insert message using new endpoint
        // Note: id is passed for client-side ID generation (offline-first support)
        const insertResponse = await postMyScenesBySceneIdMessages({
          path: { sceneId },
          body: {
            id: insertData.id,
            instruction: insertData.instruction,
            script: insertData.script,
            sortOrder: insertData.order,
          } as { instruction?: string; script?: string; sortOrder?: number; id?: string },
        })
        // Message inserted
        if (insertResponse.data?.message) {
          this.updateLastKnownTimestamp(insertResponse.data.message.updatedAt)
        }
        break
      }

      case 'message-update': {
        // Update message metadata using new endpoint
        // Note: content/paragraphs are saved separately via saveParagraphs()
        const updateData = data as Partial<Message>
        const updateResponse = await patchMyMessagesById({
          path: { id: entityId },
          body: {
            instruction: updateData.instruction,
            script: updateData.script,
            sortOrder: updateData.order,
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
        const reorderResponse = await apiClient.reorderMessages(storyId, data)
        this.updateLastKnownTimestamp(reorderResponse.updatedAt)
        break
      }

      case 'chapter-update': {
        const chapterData = data as Partial<Chapter>
        await patchMyChaptersById({
          path: { id: entityId },
          body: {
            name: chapterData.title,
            summary: chapterData.summary,
            sortOrder: chapterData.order,
            nodeType: chapterData.nodeType,
          },
        })
        break
      }

      case 'chapter-delete':
        await deleteMyChaptersById({ path: { id: entityId } })
        break

      case 'character-insert': {
        const characterData = data as Character
        await postMyStoriesByStoryIdCharacters({
          path: { storyId },
          body: {
            firstName: characterData.firstName,
            lastName: characterData.lastName || undefined,
            middleName: characterData.middleName || undefined,
            nickname: characterData.nickname || undefined,
            description: characterData.description || undefined,
            birthdate: characterData.birthdate ?? undefined,
            isMainCharacter: characterData.isMainCharacter,
            pictureFileId: characterData.pictureFileId || undefined,
          },
        })
        break
      }

      case 'character-update': {
        const characterData = data as Partial<Character>
        await patchMyCharactersById({
          path: { id: entityId },
          body: {
            firstName: characterData.firstName,
            lastName: characterData.lastName,
            middleName: characterData.middleName,
            nickname: characterData.nickname,
            description: characterData.description,
            birthdate: characterData.birthdate ?? undefined,
            isMainCharacter: characterData.isMainCharacter,
            pictureFileId: characterData.pictureFileId,
          },
        })
        break
      }

      case 'character-delete':
        await deleteMyCharactersById({ path: { id: entityId } })
        break

      case 'context-insert': {
        const contextData = data as ContextItem
        await postMyStoriesByStoryIdContextItems({
          path: { storyId },
          body: {
            type: contextData.type,
            name: contextData.name,
            description: contextData.description,
            isGlobal: contextData.isGlobal,
          },
        })
        break
      }

      case 'context-update': {
        const contextData = data as Partial<ContextItem>
        await patchMyContextItemsById({
          path: { id: entityId },
          body: {
            type: contextData.type,
            name: contextData.name,
            description: contextData.description,
            isGlobal: contextData.isGlobal,
          },
        })
        break
      }

      case 'context-delete':
        await deleteMyContextItemsById({ path: { id: entityId } })
        break

      case 'map-insert': {
        const mapData = data as StoryMap
        let fileId: string | undefined

        // If map has imageData, upload it first
        if (mapData.imageData) {
          // Convert base64 to blob
          const base64Data = mapData.imageData.split(',')[1] || mapData.imageData
          const mimeType = mapData.imageData.match(/data:([^;]+);/)?.[1] || 'image/png'
          const blob = await fetch(`data:${mimeType};base64,${base64Data}`).then((r) => r.blob())

          // Upload file using multipart/form-data
          const formData = new FormData()
          formData.append('file', blob, `${mapData.name || 'map'}.png`)
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
            id: mapData.id,
            name: mapData.name,
            borderColor: mapData.borderColor,
            fileId,
          } as { name: string; id?: string; fileId?: string; borderColor?: string },
        })
        break
      }

      case 'map-update': {
        const mapData = data as Partial<StoryMap>
        await putMyMapsById({
          path: { id: entityId },
          body: {
            name: mapData.name,
            borderColor: mapData.borderColor,
          },
        })
        break
      }

      case 'map-delete':
        await deleteMyMapsById({ path: { id: entityId } })
        break

      case 'landmark-insert': {
        const landmarkData = data as Landmark
        await postMyMapsByMapIdLandmarks({
          path: { mapId: landmarkData.mapId },
          body: {
            x: landmarkData.x,
            y: landmarkData.y,
            name: landmarkData.name,
            description: landmarkData.description,
            type: landmarkData.type,
            population: landmarkData.population,
            industry: landmarkData.industry,
            color: landmarkData.color,
            size: landmarkData.size,
            region: landmarkData.region,
            sector: landmarkData.sector,
            planetaryBodies: landmarkData.planetaryBodies,
          },
        })
        break
      }

      case 'landmark-update': {
        const landmarkData = data as Landmark
        await putMyLandmarksById({
          path: { id: entityId },
          body: {
            x: landmarkData.x,
            y: landmarkData.y,
            name: landmarkData.name,
            description: landmarkData.description,
            type: landmarkData.type,
            population: landmarkData.population,
            industry: landmarkData.industry,
            color: landmarkData.color,
            size: landmarkData.size,
            region: landmarkData.region,
            sector: landmarkData.sector,
            planetaryBodies: landmarkData.planetaryBodies,
          },
        })
        break
      }

      case 'landmark-delete':
        await deleteMyLandmarksById({ path: { id: entityId } })
        break

      case 'node-insert': {
        const nodeData = data as Node
        if (nodeData.type === 'book') {
          await postMyStoriesByStoryIdBooks({
            path: { storyId },
            body: {
              id: nodeData.id, // Pass client-generated ID
              name: nodeData.title,
              summary: nodeData.summary || undefined,
              sortOrder: nodeData.sortOrder || nodeData.order || 0,
            },
          })
        } else if (nodeData.type === 'arc') {
          await postMyBooksByBookIdArcs({
            path: { bookId: nodeData.parentId! },
            body: {
              id: nodeData.id, // Pass client-generated ID
              name: nodeData.title,
              summary: nodeData.summary || undefined,
              sortOrder: nodeData.sortOrder || nodeData.order || 0,
            },
          })
        } else if (nodeData.type === 'chapter') {
          await postMyArcsByArcIdChapters({
            path: { arcId: nodeData.parentId! },
            body: {
              id: nodeData.id, // Pass client-generated ID
              name: nodeData.title,
              summary: nodeData.summary || undefined,
              sortOrder: nodeData.sortOrder || nodeData.order || 0,
              nodeType: nodeData.nodeType || 'story',
            },
          })
        } else if (nodeData.type === 'scene') {
          const { postMyChaptersByChapterIdScenes } = await import('../client/config')
          // Note: id is passed for client-side ID generation
          await postMyChaptersByChapterIdScenes({
            path: { chapterId: nodeData.parentId! },
            body: {
              id: nodeData.id,
              name: nodeData.title,
              summary: nodeData.summary || undefined,
              sortOrder: nodeData.sortOrder || nodeData.order || 0,
            } as any,
          })
        }
        break
      }

      case 'node-update': {
        const nodeData = data as Partial<Node>
        if (nodeData.type === 'book') {
          await patchMyBooksById({
            path: { id: entityId },
            body: {
              name: nodeData.title,
              summary: nodeData.summary,
              sortOrder: nodeData.sortOrder ?? nodeData.order,
            },
          })
        } else if (nodeData.type === 'arc') {
          await patchMyArcsById({
            path: { id: entityId },
            body: {
              name: nodeData.title,
              summary: nodeData.summary,
              sortOrder: nodeData.sortOrder ?? nodeData.order,
            },
          })
        } else if (nodeData.type === 'chapter') {
          await patchMyChaptersById({
            path: { id: entityId },
            body: {
              name: nodeData.title,
              summary: nodeData.summary,
              sortOrder: nodeData.sortOrder ?? nodeData.order,
              nodeType: nodeData.nodeType,
            },
          })
        } else if (nodeData.type === 'scene') {
          const { patchMyScenesById } = await import('../client/config')
          await patchMyScenesById({
            path: { id: entityId },
            body: {
              name: nodeData.title,
              summary: nodeData.summary,
              sortOrder: nodeData.sortOrder ?? nodeData.order,
            },
          })
        }
        break
      }

      case 'node-delete': {
        const nodeData = data as Node
        if (nodeData.type === 'book') {
          await deleteMyBooksById({ path: { id: entityId } })
        } else if (nodeData.type === 'arc') {
          await deleteMyArcsById({ path: { id: entityId } })
        } else if (nodeData.type === 'chapter') {
          await deleteMyChaptersById({ path: { id: entityId } })
        } else if (nodeData.type === 'scene') {
          const { deleteMyScenesById } = await import('../client/config')
          await deleteMyScenesById({ path: { id: entityId } })
        }
        break
      }

      case 'node-bulk-update': {
        // Bulk update needs to be split into individual updates
        const nodes = data as Node[]
        for (const node of nodes) {
          if (node.type === 'book') {
            await patchMyBooksById({
              path: { id: node.id },
              body: {
                name: node.title,
                summary: node.summary,
                sortOrder: node.sortOrder ?? node.order,
              },
            })
          } else if (node.type === 'arc') {
            await patchMyArcsById({
              path: { id: node.id },
              body: {
                name: node.title,
                summary: node.summary,
                sortOrder: node.sortOrder ?? node.order,
              },
            })
          } else if (node.type === 'chapter') {
            await patchMyChaptersById({
              path: { id: node.id },
              body: {
                name: node.title,
                summary: node.summary,
                sortOrder: node.sortOrder ?? node.order,
                nodeType: node.nodeType,
              },
            })
          } else if (node.type === 'scene') {
            const { patchMyScenesById } = await import('../client/config')
            await patchMyScenesById({
              path: { id: node.id },
              body: {
                name: node.title,
                summary: node.summary,
                sortOrder: node.sortOrder ?? node.order,
              },
            })
          }
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
              ...data,
            }),
          })
          .then((res) => res.json())
        this.updateLastKnownTimestamp(contextStatesResponse.updatedAt)
        break
      }

      case 'landmark-state': {
        const stateResponse = await apiClient.setLandmarkState(storyId, data)
        this.updateLastKnownTimestamp(stateResponse.updatedAt)
        break
      }

      case 'fleet-insert': {
        const fleetData = data as Fleet
        // Fleet → Pawn migration: hyperdriveRating → speed
        await postMyMapsByMapIdPawns({
          path: { mapId: fleetData.mapId },
          body: {
            name: fleetData.name,
            description: fleetData.description,
            designation: fleetData.designation,
            speed: fleetData.hyperdriveRating, // Map hyperdriveRating to speed
            defaultX: fleetData.defaultX,
            defaultY: fleetData.defaultY,
            color: fleetData.color,
            size: fleetData.size,
          },
        })
        break
      }

      case 'fleet-update': {
        const fleetData = data as Partial<Fleet>
        // Fleet → Pawn migration: hyperdriveRating → speed
        await putMyPawnsById({
          path: { id: entityId },
          body: {
            name: fleetData.name,
            description: fleetData.description,
            designation: fleetData.designation,
            speed: fleetData.hyperdriveRating, // Map hyperdriveRating to speed
            defaultX: fleetData.defaultX,
            defaultY: fleetData.defaultY,
            color: fleetData.color,
            size: fleetData.size,
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
          data.mapId,
          data.fleetId,
          data as FleetMovement,
        )
        this.updateLastKnownTimestamp(movementCreateResponse.updatedAt)
        break
      }

      case 'fleet-movement-update': {
        const movementUpdateResponse = await apiClient.updateFleetMovement(
          storyId,
          data.mapId,
          data.fleetId,
          entityId,
          data as FleetMovement,
        )
        this.updateLastKnownTimestamp(movementUpdateResponse.updatedAt)
        break
      }

      case 'fleet-movement-delete': {
        const movementDeleteResponse = await apiClient.deleteFleetMovement(storyId, data.mapId, data.fleetId, entityId)
        this.updateLastKnownTimestamp(movementDeleteResponse.updatedAt)
        break
      }

      case 'hyperlane-insert': {
        const hyperlaneData = data as Hyperlane
        // Hyperlane → Path migration
        await postMyMapsByMapIdPaths({
          path: { mapId: hyperlaneData.mapId },
          body: {
            speedMultiplier: hyperlaneData.speedMultiplier,
          },
        })
        // TODO: PathSegments need to be created separately - segments not yet migrated
        break
      }

      case 'hyperlane-update': {
        const hyperlaneData = data as Partial<Hyperlane>
        // Hyperlane → Path migration
        await putMyPathsById({
          path: { id: entityId },
          body: {
            speedMultiplier: hyperlaneData.speedMultiplier,
          },
        })
        break
      }

      case 'hyperlane-delete':
        await deleteMyPathsById({ path: { id: entityId } })
        break

      case 'story-settings': {
        console.log('[SaveService] Saving story settings:', data)
        const settingsResponse = await patchMyStoriesById({
          path: { id: storyId },
          body: {
            name: data.name,
            summary: data.storySetting,
            // Note: other fields like person, tense, globalScript, etc.
            // will need to be added to unified backend schema
          },
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

      default:
        console.warn('Unknown operation type:', type)
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

  saveChapter(storyId: string, chapterId: string, updates: Partial<Chapter>, debounce = false) {
    const saveOp = {
      type: 'chapter-update' as SaveOperationType,
      entityType: 'chapter' as const,
      entityId: chapterId,
      storyId,
      data: updates,
    }

    if (debounce) {
      this.debouncedQueueSave(saveOp, 500)
    } else {
      this.queueSave(saveOp)
    }
  }

  deleteChapter(storyId: string, chapterId: string) {
    this.queueSave({
      type: 'chapter-delete',
      entityType: 'chapter',
      entityId: chapterId,
      storyId,
    })
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
    messageId: string,
    field: string,
    value: string | null,
  ) {
    this.queueSave({
      type: 'landmark-state',
      entityType: 'landmark-state',
      entityId: `${mapId}-${landmarkId}-${field}`,
      storyId,
      data: { mapId, landmarkId, messageId, field, value },
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
  reorderMessages(storyId: string, items: Array<{ messageId: string; nodeId: string; order: number }>) {
    this.queueSave({
      type: 'message-reorder',
      entityType: 'message',
      entityId: 'reorder-batch', // Special ID for reorder operations
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

    // Execute all operations
    const errors: Error[] = []

    // Create new paragraphs
    for (let i = 0; i < toCreate.length; i++) {
      const para = toCreate[i]
      try {
        // Note: id and contentSchema passed for client-side ID generation and rich text
        await postMyMessageRevisionsByRevisionIdParagraphs({
          path: { revisionId: messageRevisionId },
          body: {
            id: para.id,
            body: para.body,
            contentSchema: para.contentSchema,
            state: para.state?.toUpperCase() as any,
            sortOrder: newParagraphs.findIndex((p) => p.id === para.id),
          } as any,
        })
        console.log(`[SaveService.saveParagraphs] Created paragraph ${para.id}`)
      } catch (error) {
        console.error(`[SaveService.saveParagraphs] Failed to create paragraph ${para.id}:`, error)
        errors.push(error as Error)
      }
    }

    // Update changed paragraphs
    for (const para of toUpdate) {
      try {
        // Note: contentSchema passed for rich text editing
        await patchMyParagraphsById({
          path: { id: para.id },
          body: {
            body: para.body,
            contentSchema: para.contentSchema,
            state: para.state?.toUpperCase() as any,
            sortOrder: newParagraphs.findIndex((p) => p.id === para.id),
          } as any,
        })
        console.log(`[SaveService.saveParagraphs] Updated paragraph ${para.id}`)
      } catch (error) {
        console.error(`[SaveService.saveParagraphs] Failed to update paragraph ${para.id}:`, error)
        errors.push(error as Error)
      }
    }

    // Delete removed paragraphs
    for (const id of toDelete) {
      try {
        await deleteMyParagraphsById({
          path: { id },
        })
        console.log(`[SaveService.saveParagraphs] Deleted paragraph ${id}`)
      } catch (error) {
        console.error(`[SaveService.saveParagraphs] Failed to delete paragraph ${id}:`, error)
        errors.push(error as Error)
      }
    }

    if (errors.length > 0) {
      console.error(`[SaveService.saveParagraphs] ${errors.length} errors occurred during save`)
    }

    return {
      created: toCreate.length - errors.filter((_, i) => i < toCreate.length).length,
      updated: toUpdate.length,
      deleted: toDelete.length,
    }
  }

  // Get current save status
  getStatus() {
    return {
      isSaving: this.state.isProcessing || this.state.isFullSaveInProgress,
      queueLength: this.state.queue.length,
      currentOperation: this.state.currentOperation,
      isFullSaveInProgress: this.state.isFullSaveInProgress,
    }
  }
}

// Create singleton instance
export const saveService = new SaveService()
