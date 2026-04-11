/**
 * Effective Settings Store — computes the active AI settings by merging
 * global user preferences with story-level overrides.
 *
 * All AI consumers (resolveModel, generation hooks, UI displays) should
 * read from this store instead of settingsStore directly.
 *
 * Resolution: story override ?? global default
 */

import { settingsStore } from './settingsStore'
import { currentStoryStore } from './currentStoryStore'
import type { CategoryOverrides } from '../utils/llm/resolveModel'

/**
 * Shape of per-story AI overrides stored in Story.aiOverrides JSON column.
 * Every field is nullable — null/undefined means "inherit from global".
 */
export interface StoryAIOverrides {
  provider?: string | null
  model?: string | null
  maxTokens?: number | null
  thinkingBudget?: number | null
  contextSize?: number | null
  categoryOverrides?: CategoryOverrides | null
}

/**
 * Read-only reactive getters that return the effective value for each setting.
 * SolidJS reactivity works because these getters read from reactive stores.
 */
export const effectiveSettings = {
  get provider(): string {
    const overrides = currentStoryStore.aiOverrides
    return overrides?.provider ?? settingsStore.provider
  },

  get model(): string {
    const overrides = currentStoryStore.aiOverrides
    return overrides?.model ?? settingsStore.model
  },

  get maxTokens(): number {
    const overrides = currentStoryStore.aiOverrides
    return overrides?.maxTokens ?? settingsStore.maxTokens
  },

  get thinkingBudget(): number {
    const overrides = currentStoryStore.aiOverrides
    return overrides?.thinkingBudget ?? settingsStore.thinkingBudget
  },

  get contextSize(): number {
    const overrides = currentStoryStore.aiOverrides
    return overrides?.contextSize ?? settingsStore.contextSize
  },

  get categoryOverrides(): CategoryOverrides {
    const overrides = currentStoryStore.aiOverrides
    return overrides?.categoryOverrides ?? settingsStore.categoryOverrides
  },

  /** Check whether a specific setting has a story-level override. */
  hasOverride(key: keyof StoryAIOverrides): boolean {
    if (!currentStoryStore.isInitialized) return false
    const overrides = currentStoryStore.aiOverrides
    if (!overrides) return false
    const val = overrides[key]
    return val !== null && val !== undefined
  },

  /** Whether any story is loaded (determines if story overrides are possible). */
  get hasStoryLoaded(): boolean {
    return currentStoryStore.isInitialized
  },

  // --- Inline setters ---
  // When a story is loaded, these set the story override.
  // When no story is loaded, they set the global default.

  // --- Inline setters ---
  // When a story is loaded, these set the story override.
  // When no story is loaded, they set the global default.

  setProvider(provider: string) {
    if (currentStoryStore.isInitialized) {
      currentStoryStore.setAIOverride('provider', provider)
      currentStoryStore.setAIOverride('model', null) // Clear model on provider change
    } else {
      settingsStore.setProvider(provider)
    }
  },

  setModel(model: string) {
    if (currentStoryStore.isInitialized) {
      currentStoryStore.setAIOverride('model', model)
    } else {
      settingsStore.setModel(model)
    }
  },

  setMaxTokens(tokens: number) {
    if (currentStoryStore.isInitialized) {
      currentStoryStore.setAIOverride('maxTokens', tokens)
    } else {
      settingsStore.setMaxTokens(tokens)
    }
  },

  setThinkingBudget(budget: number) {
    if (currentStoryStore.isInitialized) {
      currentStoryStore.setAIOverride('thinkingBudget', budget)
    } else {
      settingsStore.setThinkingBudget(budget)
    }
  },

  setContextSize(size: number) {
    if (currentStoryStore.isInitialized) {
      currentStoryStore.setAIOverride('contextSize', size)
    } else {
      settingsStore.setContextSize(size)
    }
  },
}
