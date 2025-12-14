// API-related types

import { Message, Character, ContextItem, Chapter } from './core'
import { CalendarConfig } from '@story/shared'

export interface Calendar {
  id: string
  storyId: string
  config: CalendarConfig
  createdAt: string
  updatedAt: string
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
  chapters?: Chapter[]
  nodes?: any[]  // New hierarchical structure
  calendars?: Calendar[]
  defaultCalendarId?: string | null
  person?: 'first' | 'second' | 'third'
  tense?: 'present' | 'past'
  globalScript?: string
  selectedChapterId?: string | null
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
  chapterCount?: number
  fingerprint?: string // Hash of message content for change detection
}

export interface ApiRefinementStatus {
  storyId: string
  status: 'processing' | 'completed' | 'failed'
  progress?: number
  result?: string
  error?: string
}

export interface ApiError {
  error: string
  message?: string
  statusCode?: number
}

export class VersionConflictError extends Error {
  code: 'VERSION_CONFLICT' = 'VERSION_CONFLICT'
  serverUpdatedAt: string
  clientUpdatedAt: string
  
  constructor(message: string, serverUpdatedAt: string, clientUpdatedAt: string) {
    super(message)
    this.name = 'VersionConflictError'
    this.serverUpdatedAt = serverUpdatedAt
    this.clientUpdatedAt = clientUpdatedAt
  }
}

// Chapter-related API types
export interface CreateChapterRequest {
  storyId: string
  title: string
  afterMessageId?: string // Insert chapter after this message
}

export interface UpdateChapterRequest {
  title?: string
  summary?: string
}

export interface GenerateChapterSummaryRequest {
  chapterId: string
}

export interface GenerateChapterSummaryResponse {
  summary: string
}