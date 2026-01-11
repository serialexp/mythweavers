// Store-related types

import { Character, ContextItem, Message, Node } from './core'

export interface CurrentStory {
  id: string
  name: string
  isPlaceholderName: boolean
  lastAutoSaveAt?: Date
  storageMode: 'server' | 'local'
  // Story-specific settings
  person: 'first' | 'second' | 'third'
  tense: 'present' | 'past'
  storySetting: string // genre/setting
  storyFormat: 'narrative' | 'cyoa' // story format
  paragraphsPerTurn: number // Target paragraphs per AI generation turn
  lastKnownUpdatedAt?: string // Track server version for conflict detection
  globalScript?: string // Global script to execute before message scripts
  branchChoices: Record<string, string> // branchMessageId -> selectedOptionId
  // Timeline settings (minutes from 0 BBY)
  timelineStartTime?: number | null
  timelineEndTime?: number | null
  timelineGranularity?: 'hour' | 'day'
  // LLM settings
  provider?: string // 'ollama' | 'openrouter' | 'anthropic' | 'openai'
  model?: string | null // Model name for the selected provider
}

export interface CacheEntry {
  messageId: string
  timestamp: number
  cacheCreationTokens: number
  cacheReadTokens: number
  lastActivity: number
}

export interface PendingEntity {
  id: string
  name: string
  type: 'character' | 'location' | 'theme'
  description: string
  confidence: 'high' | 'medium' | 'low'
  sourceMessageId: string
}

export interface PendingEntityBatch {
  id: string
  timestamp: Date
  entities: PendingEntity[]
  sourceMessageId: string
}

export type GlobalOperationType =
  | 'bulk-summarize'
  | 'migrate-instructions'
  | 'remove-user-messages'
  | 'cleanup-think-tags'
  | null

export interface GlobalOperation {
  type: GlobalOperationType
  isActive: boolean
  isAborting: boolean
  progress: number
  total: number
  error?: string
}

export interface SavedStory {
  id: string
  name: string
  savedAt: Date
  messages: Message[]
  characters: Character[]
  contextItems?: ContextItem[]
  nodes?: Node[] // Hierarchical structure
  input: string
  storySetting: string
  storyFormat?: 'narrative' | 'cyoa' // story format
  paragraphsPerTurn?: number // Target paragraphs per AI generation turn
  person?: 'first' | 'second' | 'third'
  tense?: 'present' | 'past'
  syncedAt?: Date
  storageMode: 'server' | 'local'
  globalScript?: string // Global script to execute before message scripts
  selectedNodeId?: string | null
  branchChoices?: Record<string, string> // branchMessageId -> selectedOptionId
  // Timeline settings (minutes from 0 BBY)
  timelineStartTime?: number | null
  timelineEndTime?: number | null
  timelineGranularity?: 'hour' | 'day'
  // LLM settings
  provider?: string // 'ollama' | 'openrouter' | 'anthropic' | 'openai'
  model?: string | null // Model name for the selected provider
}

export interface StoryMetadata {
  id: string
  name: string
  savedAt: Date
  messageCount: number
  characterCount: number
  storySetting: string
  storageMode: 'server' | 'local'
}
