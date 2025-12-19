export interface Message {
  id: string
  role: 'assistant'
  content: string
  instruction?: string // For assistant messages, stores the original user instruction
  timestamp: Date
  tokensPerSecond?: number
  totalTokens?: number
  promptTokens?: number
  cacheCreationTokens?: number // Tokens written to cache
  cacheReadTokens?: number // Tokens read from cache
  isQuery?: boolean
  paragraphs?: string[]
  sentenceSummary?: string
  summary?: string
  paragraphSummary?: string
  isExpanded?: boolean
  isSummarizing?: boolean
  think?: string // AI's thinking/reasoning content
  showThink?: boolean // Whether to display the think content
  sceneAnalysis?: SceneAnalysis // Cached analysis of this story beat
  isAnalyzing?: boolean // Whether scene analysis is in progress
  model?: string // Model used to generate this message
  isCompacted?: boolean // True if this is a compacted summary message
  compactedMessageIds?: string[] // IDs of messages this compaction represents
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
  pricing?: {
    prompt: string
    completion: string
    request?: string
    image?: string
    input_cache_read?: string
    input_cache_write?: string
  }
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
  birthdate?: number | null
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
  isActive: boolean
  type: 'theme' | 'location' // Distinguishes between thematic elements and physical locations
}
