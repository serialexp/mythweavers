// Core domain types

import type { Paragraph } from '@mythweavers/shared'
import { ModelPricing } from './llm'

// Branch option for story branching
export interface BranchOption {
  id: string // Unique option ID
  label: string // Display text ("Trust the stranger")
  targetNodeId: string // Which chapter/node this leads to
  targetMessageId: string // Specific message in that node
  description?: string // Optional longer description
}

// Standardized token usage tracking
export interface TokenUsage {
  input_normal: number // Regular input tokens (not cached)
  input_cache_read: number // Tokens read from cache
  input_cache_write: number // Tokens written to cache
  output_normal: number // Output/completion tokens
}

export interface Message {
  id: string
  role: 'assistant'
  content: string
  instruction?: string // For assistant messages, stores the original user instruction
  timestamp: Date
  order: number // Order index for message sorting
  tokensPerSecond?: number
  // Legacy token fields (deprecated - use tokenUsage instead)
  totalTokens?: number
  promptTokens?: number
  cacheCreationTokens?: number
  cacheReadTokens?: number
  // New standardized token usage
  tokenUsage?: TokenUsage
  isQuery?: boolean
  paragraphs?: Paragraph[]
  sentenceSummary?: string
  summary?: string
  paragraphSummary?: string
  isExpanded?: boolean
  isInstructionExpanded?: boolean // Whether instruction is expanded (for truncated instructions)
  isSummarizing?: boolean
  think?: string // AI's thinking/reasoning content
  showThink?: boolean // Whether to display the think content
  sceneAnalysis?: SceneAnalysis // Cached analysis of this story beat
  isAnalyzing?: boolean // Whether scene analysis is in progress
  model?: string // Model used to generate this message
  isCompacted?: boolean // True if this is a compacted summary message
  compactedMessageIds?: string[] // IDs of messages this compaction represents
  script?: string // JavaScript to execute for this turn, modifying the data object
  type?: 'chapter' | 'event' | 'branch' | null // Message type: null for normal, 'chapter' for chapter markers, 'event' for script events, 'branch' for branch points
  options?: BranchOption[] // Branch options - only for branch messages
  sceneId?: string // References the scene this message belongs to
  currentMessageRevisionId?: string | null // ID of the current message revision (needed for paragraph operations)
}

export interface SceneAnalysis {
  locations: string[] // Array of location names present in this scene
  characterRelevance: Record<string, 'high' | 'medium' | 'low'> // character name -> relevance level
  themeRelevance: Record<string, 'high' | 'medium' | 'low'> // theme -> relevance level
  overallImportance: 'high' | 'medium' | 'low'
  explanation: string
}

export interface Model {
  name: string
  size: number
  digest: string
  modified_at: string
  context_length?: number
  pricing?: ModelPricing
}

export interface StorySetting {
  value: string
  label: string
}

export interface Character {
  id: string
  firstName: string
  middleName?: string | null
  lastName?: string | null
  nickname?: string | null
  description?: string | null
  personality?: string | null
  personalityQuirks?: string | null
  background?: string | null
  likes?: string | null
  dislikes?: string | null
  age?: string | null
  gender?: string | null
  sexualOrientation?: string | null
  height?: number | null
  hairColor?: string | null
  eyeColor?: string | null
  distinguishingFeatures?: string | null
  writingStyle?: string | null
  birthdate?: number | null // Birth date in story time (minutes from 0 BBY)
  isMainCharacter: boolean
  pictureFileId?: string | null
  significantActions?: any | null
  laterVersionOfId?: string | null
  // Local-only field for base64 image data (not persisted to backend)
  profileImageData?: string | null
}

export interface ContextItem {
  id: string
  name: string
  description: string
  isGlobal: boolean // Whether this context item is active in all chapters
  type: 'theme' | 'location' | 'plot' // Distinguishes between thematic elements, physical locations, and plot threads
}

// Plot point definitions (stored at story level)
export interface PlotPointDefinition {
  key: string // Variable name (e.g., "ahsokaFeeling")
  type: 'string' | 'number' | 'enum' | 'boolean' // Value type
  default: string | number | boolean // Default value
  options?: string[] // For enum type: list of valid options (e.g., ["happy", "sad", "neutral"])
}

// Plot point state override (stored at message level)
export interface PlotPointState {
  id?: string
  storyId: string
  messageId: string
  key: string
  value: string // Stored as string, parsed based on definition type
}

export type NodeStatus = 'draft' | 'needs_work' | 'review' | 'done'
export type NodeType = 'book' | 'arc' | 'chapter' | 'scene'
export type NodeContentType = 'story' | 'non-story' | 'context' // API classification for content type

export interface Node {
  id: string
  storyId: string
  parentId?: string | null
  type: NodeType
  nodeType?: NodeContentType // API field: indicates if content is story, non-story, or context
  title: string
  summary?: string
  order: number
  expanded?: boolean
  isSummarizing?: boolean

  // Chapter-specific fields (organizational level)
  includeInFull?: number // 0=not included, 1=summary only, 2=full content
  status?: NodeStatus // Track the status of the node

  // Scene-specific fields (POV/context boundary)
  goal?: string // Scene goal: what we're trying to accomplish (used in generation context)
  activeCharacterIds?: string[] // Character IDs active in this scene
  activeContextItemIds?: string[] // Context item IDs active in this scene
  viewpointCharacterId?: string // Character ID for the viewpoint character (POV)
  perspective?: 'FIRST' | 'THIRD' // Narrative perspective for this scene

  // Story timeline (minutes from 0 BBY - negative = BBY, positive = ABY)
  storyTime?: number // When this node occurs in story time (typically set on scenes)

  // Metadata
  createdAt: Date
  updatedAt: Date

  // UI state
  isOpen?: boolean // Whether the node is expanded in the tree view
  wordCount?: number // Calculated word count for display
  messageWordCounts?: Record<string, number>
}

// Property schema for dynamic landmark properties
export interface PropertyDefinition {
  key: string
  label: string
  type: 'text' | 'number' | 'enum' | 'color' | 'boolean'
  options?: Array<{ value: string; label: string; color?: string }>
  placeholder?: string
  description?: string
}

export interface StateFieldDefinition {
  key: string
  label: string
  options: Array<{ value: string; label: string; color: string }>
}

export interface PropertySchema {
  properties: PropertyDefinition[]
  stateFields: StateFieldDefinition[]
}

export interface StoryMap {
  id: string
  name: string
  imageData: string // Base64 encoded image or blob URL
  borderColor?: string // EJS template for landmark border colors
  propertySchema?: PropertySchema // Schema for landmark properties and state fields
  landmarkCount?: number // Number of landmarks (from list endpoint, before details loaded)
  landmarks: Landmark[]
  fleets: Fleet[]
  hyperlanes: Hyperlane[]
}

export interface Landmark {
  id: string
  mapId: string
  x: number // X coordinate on map (0-1 normalized)
  y: number // Y coordinate on map (0-1 normalized)
  name: string
  description: string
  type?: string // Generic type: "point", "area", "region", etc.
  color?: string // Optional hex color for the pin
  size?: 'small' | 'medium' | 'large' // Size of the landmark pin
  properties: Record<string, unknown> // Dynamic custom properties
}

export interface LandmarkState {
  id?: string
  storyId: string
  mapId: string
  landmarkId: string
  messageId?: string | null // Optional - for backwards compatibility
  storyTime?: number | null // When this state change occurs (minutes from 0 BBY)
  field: string // e.g., 'allegiance', 'control', etc.
  value: string | null // e.g., 'republic', 'separatist', 'contested' or null for deleted
  deleted?: boolean
  createdAt?: string
  updatedAt?: string
}

// Default property schema for backwards compatibility (Star Wars)
export const DEFAULT_PROPERTY_SCHEMA: PropertySchema = {
  properties: [
    { key: 'population', label: 'Population', type: 'text' },
    {
      key: 'industry',
      label: 'Industry',
      type: 'enum',
      options: [
        { value: 'farming', label: 'Agricultural' },
        { value: 'mining', label: 'Mining' },
        { value: 'trade', label: 'Trade Hub' },
        { value: 'political', label: 'Political' },
        { value: 'industry', label: 'Industrial' },
      ],
    },
    { key: 'region', label: 'Region', type: 'text' },
    { key: 'sector', label: 'Sector', type: 'text' },
    { key: 'planetaryBodies', label: 'Planetary Bodies', type: 'text' },
  ],
  stateFields: [
    {
      key: 'allegiance',
      label: 'Allegiance',
      options: [
        { value: 'republic', label: 'Republic', color: '#3498db' },
        { value: 'separatist', label: 'Separatist', color: '#e74c3c' },
        { value: 'contested', label: 'Contested', color: '#f39c12' },
        { value: 'neutral', label: 'Neutral', color: '#95a5a6' },
        { value: 'independent', label: 'Independent', color: '#7f8c8d' },
      ],
    },
  ],
}

export interface Fleet {
  id: string
  mapId: string
  name: string
  description?: string
  designation?: string // Short text to display on the fleet marker (e.g., "1st", "A", "Alpha")
  hyperdriveRating: number // 0.5 = fast (Millennium Falcon), 2.0 = slow (Trade Federation)
  defaultX: number // Default X coordinate (0-1 normalized)
  defaultY: number // Default Y coordinate (0-1 normalized)
  color?: string // Hex color for the fleet marker
  size?: 'small' | 'medium' | 'large' // Size of the fleet marker
  variant?: 'military' | 'transport' | 'scout' // Visual style: military (triangle+star), transport (rectangular), scout (diamond)
  movements: FleetMovement[]
}

export interface FleetMovement {
  id: string
  storyId: string
  mapId: string
  fleetId: string
  startStoryTime: number // When the fleet departs (minutes from 0 BBY)
  endStoryTime: number // When the fleet arrives (minutes from 0 BBY)
  startX: number // Starting X coordinate (0-1 normalized)
  startY: number // Starting Y coordinate (0-1 normalized)
  endX: number // Ending X coordinate (0-1 normalized)
  endY: number // Ending Y coordinate (0-1 normalized)
  createdAt?: string
  updatedAt?: string
}

export interface Hyperlane {
  id: string
  mapId: string
  speedMultiplier: number // How much faster than normal space (10x by default)
  segments: HyperlaneSegment[]
  createdAt?: string
  updatedAt?: string
}

export interface HyperlaneSegment {
  id: string
  hyperlaneId: string
  mapId: string
  order: number // Order within the hyperlane path (0, 1, 2, ...)
  startX: number // Starting X coordinate (0-1 normalized)
  startY: number // Starting Y coordinate (0-1 normalized)
  endX: number // Ending X coordinate (0-1 normalized)
  endY: number // Ending Y coordinate (0-1 normalized)
  startLandmarkId?: string | null // If start point snaps to a landmark/junction
  endLandmarkId?: string | null // If end point snaps to a landmark/junction
  createdAt?: string
  updatedAt?: string
}
