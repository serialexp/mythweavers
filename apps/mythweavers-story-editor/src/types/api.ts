// API-related types

import { CalendarConfig } from '@mythweavers/shared'
import { Character, ContextItem, Fleet, Hyperlane, HyperlaneSegment, Landmark, Message } from './core'

// ============================================================================
// API to Local Type Mappers
// ============================================================================
// These functions convert API response types to local domain types

/**
 * API Pawn type (from unified backend)
 */
export interface ApiPawn {
  id: string
  mapId: string
  name: string
  description: string | null
  designation: string | null
  speed: number
  defaultX: number
  defaultY: number
  color: string | null
  size: string | null
  variant?: string | null // Optional - not always returned by API
}

/**
 * API Path type (from unified backend)
 */
export interface ApiPath {
  id: string
  mapId: string
  speedMultiplier: number
  segments?: ApiPathSegment[] // Optional - only included when includeSegments=true
}

/**
 * API PathSegment type (from unified backend)
 */
export interface ApiPathSegment {
  id: string
  pathId: string
  mapId: string
  order: number
  startX: number
  startY: number
  endX: number
  endY: number
  startLandmarkId: string | null
  endLandmarkId: string | null
}

/**
 * API Landmark type (from unified backend)
 * Note: description and properties are optional because the list endpoint
 * returns minimal data without these fields for performance.
 */
export interface ApiLandmark {
  id: string
  mapId: string
  x: number
  y: number
  name: string
  description?: string // Optional in list response
  type: string
  color: string | null
  size: string | null
  properties?: Record<string, unknown> // Optional in list response
}

/**
 * Convert API Pawn to local Fleet type
 */
export function pawnToFleet(pawn: ApiPawn): Fleet {
  return {
    id: pawn.id,
    mapId: pawn.mapId,
    name: pawn.name,
    description: pawn.description ?? undefined,
    designation: pawn.designation ?? undefined,
    hyperdriveRating: pawn.speed, // API 'speed' maps to local 'hyperdriveRating'
    defaultX: pawn.defaultX,
    defaultY: pawn.defaultY,
    color: pawn.color ?? undefined,
    size: (pawn.size as Fleet['size']) ?? undefined,
    variant: (pawn.variant as Fleet['variant']) ?? undefined,
    movements: [], // Movements are loaded separately if needed
  }
}

/**
 * Convert API Path + segments to local Hyperlane type
 */
export function pathToHyperlane(path: ApiPath, segments?: ApiPathSegment[]): Hyperlane {
  // Use inline segments if available (from includeSegments=true), otherwise use provided segments
  const pathSegments = path.segments || segments || []

  return {
    id: path.id,
    mapId: path.mapId,
    speedMultiplier: path.speedMultiplier,
    segments: pathSegments
      .filter((s) => s.pathId === path.id)
      .sort((a, b) => a.order - b.order)
      .map((s) => ({
        id: s.id,
        hyperlaneId: path.id, // Map pathId to hyperlaneId
        mapId: s.mapId,
        order: s.order,
        startX: s.startX,
        startY: s.startY,
        endX: s.endX,
        endY: s.endY,
        startLandmarkId: s.startLandmarkId,
        endLandmarkId: s.endLandmarkId,
      })),
  }
}

/**
 * Convert API Landmark to local Landmark type
 */
export function apiLandmarkToLandmark(landmark: ApiLandmark): Landmark {
  return {
    id: landmark.id,
    mapId: landmark.mapId,
    x: landmark.x,
    y: landmark.y,
    name: landmark.name,
    description: landmark.description ?? '', // Default to empty string if not provided
    type: landmark.type ?? undefined,
    color: landmark.color ?? undefined,
    size: (landmark.size as Landmark['size']) ?? undefined,
    properties: landmark.properties ?? {}, // Default to empty object if not provided
  }
}

/**
 * Convert local Fleet to API Pawn format (for saving)
 */
export function fleetToPawn(fleet: Fleet): Omit<ApiPawn, 'id' | 'mapId'> {
  return {
    name: fleet.name,
    description: fleet.description ?? null,
    designation: fleet.designation ?? null,
    speed: fleet.hyperdriveRating, // Local 'hyperdriveRating' maps to API 'speed'
    defaultX: fleet.defaultX,
    defaultY: fleet.defaultY,
    color: fleet.color ?? null,
    size: fleet.size ?? null,
    variant: fleet.variant ?? null,
  }
}

/**
 * Convert local Hyperlane to API Path format (for saving)
 */
export function hyperlaneToPath(hyperlane: Hyperlane): Omit<ApiPath, 'id' | 'mapId'> {
  return {
    speedMultiplier: hyperlane.speedMultiplier,
  }
}

/**
 * Convert local HyperlaneSegment to API PathSegment format (for saving)
 */
export function hyperlaneSegmentToPathSegment(segment: HyperlaneSegment): Omit<ApiPathSegment, 'id' | 'mapId'> {
  return {
    pathId: segment.hyperlaneId, // Local 'hyperlaneId' maps to API 'pathId'
    order: segment.order,
    startX: segment.startX,
    startY: segment.startY,
    endX: segment.endX,
    endY: segment.endY,
    startLandmarkId: segment.startLandmarkId ?? null,
    endLandmarkId: segment.endLandmarkId ?? null,
  }
}

export interface Calendar {
  id: string
  storyId: string
  config: CalendarConfig
  createdAt: string
  updatedAt: string
}

/**
 * API Calendar response type (config is unknown from API, needs casting)
 */
export interface ApiCalendar {
  id: string
  storyId?: string
  name?: string
  config: unknown // API returns unknown, must be validated/cast
  isDefault: boolean
  createdAt: string
}

export interface ApiStory {
  id: string
  name: string
  savedAt: string
  updatedAt: string
  input: string
  storySetting: string
  messages: Message[]
  characters: Character[]
  contextItems: ContextItem[]
  nodes?: any[] // Hierarchical structure
  calendars?: Calendar[]
  defaultCalendarId?: string | null
  person?: 'first' | 'second' | 'third'
  tense?: 'present' | 'past'
  globalScript?: string
  selectedNodeId?: string | null
  branchChoices?: Record<string, string> // branchMessageId -> selectedOptionId
  timelineStartTime?: number | null
  timelineEndTime?: number | null
  timelineGranularity?: 'hour' | 'day'
  provider?: string // LLM provider: 'ollama' | 'openrouter' | 'anthropic' | 'openai'
  model?: string | null // Model name for the selected provider
}

export interface ApiStoryMetadata {
  id: string
  name: string
  savedAt: string
  updatedAt: string
  storySetting: string
  messageCount: number
  characterCount: number
  fingerprint?: string // Hash of message content for change detection
}

export interface ApiError {
  error: string
  message?: string
  statusCode?: number
}

export class VersionConflictError extends Error {
  code = 'VERSION_CONFLICT' as const
  serverUpdatedAt: string
  clientUpdatedAt: string

  constructor(message: string, serverUpdatedAt: string, clientUpdatedAt: string) {
    super(message)
    this.name = 'VersionConflictError'
    this.serverUpdatedAt = serverUpdatedAt
    this.clientUpdatedAt = clientUpdatedAt
  }
}

