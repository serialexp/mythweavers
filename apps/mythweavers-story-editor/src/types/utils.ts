// Utility types used across the application

import { Character, ContextItem, Message } from './core'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  cache_control?: {
    type: 'ephemeral'
    ttl?: '5m' | '1h'
  }
}

export interface StoryMessageOptions {
  inputText: string
  messages: Message[]
  storySetting: string
  characterContext: string
  person: string
  tense: string
  paragraphsPerTurn: string
  protagonistName?: string
}

export interface SmartStoryMessageOptions extends StoryMessageOptions {
  useSmartContext: boolean
  characters: Character[]
  contextItems: ContextItem[]
  model: string
  provider: 'ollama' | 'openrouter' | 'anthropic' | 'openai'
}

export interface InputAnalysis {
  hasCharacterMention: boolean
  hasLocationMention: boolean
  hasThemeMention: boolean
  relevantCharacters: string[]
  relevantLocations: string[]
  relevantThemes: string[]
}

export interface StoryBeatContext {
  recentCharacters: Set<string>
  recentLocations: Set<string>
  recentThemes: Set<string>
  currentLocation?: string
  activeCharacters: string[]
}

export interface KnownEntities {
  knownCharacters: string[]
  knownLocations: string[]
  knownThemes: string[]
}

export interface EntityDetectionResult {
  characters: string[]
  locations: string[]
  themes: string[]
}

export interface EntityDescriptions {
  characters: Map<string, string>
  locations: Map<string, string>
  themes: Map<string, string>
}
