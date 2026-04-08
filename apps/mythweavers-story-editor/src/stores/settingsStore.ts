import { createEffect } from 'solid-js'
import { createStore } from 'solid-js/store'
import { DEFAULT_CHARS_PER_TOKEN, DEFAULT_CONTEXT_SIZE } from '../constants'
import type { CategoryOverrides } from '../utils/llm/resolveModel'

export interface CustomProvider {
  /** Unique ID, e.g. "moonshot" — used as the provider key everywhere */
  id: string
  /** Display name, e.g. "Moonshot AI" */
  name: string
  /** Base URL, e.g. "https://api.moonshot.cn" */
  endpoint: string
  /** API key for this provider */
  apiKey: string
}

const getInitialCustomProviders = (): CustomProvider[] => {
  try {
    const saved = localStorage.getItem('story-custom-providers')
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

const getInitialCategoryOverrides = (): CategoryOverrides => {
  try {
    const saved = localStorage.getItem('story-category-overrides')
    return saved ? JSON.parse(saved) : {}
  } catch {
    return {}
  }
}

// Initialize values from localStorage
const getInitialContextSize = (): number => {
  const saved = localStorage.getItem('story-context-size')
  return saved ? Number.parseInt(saved) : DEFAULT_CONTEXT_SIZE
}

const getInitialCharsPerToken = (): number => {
  const saved = localStorage.getItem('story-chars-per-token')
  return saved ? Number.parseFloat(saved) : DEFAULT_CHARS_PER_TOKEN
}

const [settingsState, setSettingsState] = createStore({
  model: '', // Start empty, will be set when models load
  storySetting: localStorage.getItem('story-setting') || '',
  contextSize: getInitialContextSize(),
  charsPerToken: getInitialCharsPerToken(),
  showSettings: false,
  provider: localStorage.getItem('story-provider') || 'ollama',
  openrouterApiKey: localStorage.getItem('story-openrouter-api-key') || '',
  anthropicApiKey: localStorage.getItem('story-anthropic-api-key') || '',
  openaiApiKey: localStorage.getItem('story-openai-api-key') || '',
  person: localStorage.getItem('story-person') || 'third',
  tense: localStorage.getItem('story-tense') || 'past',
  autoGenerate: localStorage.getItem('story-auto-generate') === 'true',
  showEventMessages: localStorage.getItem('story-show-event-messages') !== 'false', // Default to true
  thinkingBudget: Number.parseInt(localStorage.getItem('story-thinking-budget') || '0'), // 0 = no budget
  refineClichés: localStorage.getItem('story-refine-cliches') === 'true',
  includeNameSuggestions: localStorage.getItem('story-include-name-suggestions') !== 'false', // Default to true
  maxTokens: Number.parseInt(localStorage.getItem('story-max-tokens') || '4096'),
  categoryOverrides: getInitialCategoryOverrides(),
  customProviders: getInitialCustomProviders(),
})

// Auto-save effects

createEffect(() => {
  if (settingsState.model) {
    localStorage.setItem('story-model', settingsState.model)
  }
})

createEffect(() => {
  localStorage.setItem('story-setting', settingsState.storySetting)
})

createEffect(() => {
  localStorage.setItem('story-context-size', settingsState.contextSize.toString())
})

createEffect(() => {
  localStorage.setItem('story-chars-per-token', settingsState.charsPerToken.toString())
})

createEffect(() => {
  localStorage.setItem('story-provider', settingsState.provider)
})

createEffect(() => {
  localStorage.setItem('story-openrouter-api-key', settingsState.openrouterApiKey)
})

createEffect(() => {
  localStorage.setItem('story-anthropic-api-key', settingsState.anthropicApiKey)
})

createEffect(() => {
  localStorage.setItem('story-openai-api-key', settingsState.openaiApiKey)
})

createEffect(() => {
  localStorage.setItem('story-person', settingsState.person)
})

createEffect(() => {
  localStorage.setItem('story-tense', settingsState.tense)
})

createEffect(() => {
  localStorage.setItem('story-auto-generate', settingsState.autoGenerate.toString())
})

createEffect(() => {
  localStorage.setItem('story-show-event-messages', settingsState.showEventMessages.toString())
})

createEffect(() => {
  localStorage.setItem('story-thinking-budget', settingsState.thinkingBudget.toString())
})

createEffect(() => {
  localStorage.setItem('story-refine-cliches', settingsState.refineClichés.toString())
})

createEffect(() => {
  localStorage.setItem('story-include-name-suggestions', settingsState.includeNameSuggestions.toString())
})

createEffect(() => {
  localStorage.setItem('story-max-tokens', settingsState.maxTokens.toString())
})

createEffect(() => {
  localStorage.setItem('story-category-overrides', JSON.stringify(settingsState.categoryOverrides))
})

createEffect(() => {
  localStorage.setItem('story-custom-providers', JSON.stringify(settingsState.customProviders))
})

export const settingsStore = {
  // Getters
  get model() {
    return settingsState.model
  },
  get storySetting() {
    return settingsState.storySetting
  },
  get contextSize() {
    return settingsState.contextSize
  },
  get charsPerToken() {
    return settingsState.charsPerToken
  },
  get showSettings() {
    return settingsState.showSettings
  },
  get provider() {
    return settingsState.provider
  },
  get openrouterApiKey() {
    return settingsState.openrouterApiKey
  },
  get anthropicApiKey() {
    return settingsState.anthropicApiKey
  },
  get openaiApiKey() {
    return settingsState.openaiApiKey
  },
  get person() {
    return settingsState.person
  },
  get tense() {
    return settingsState.tense
  },
  get autoGenerate() {
    return settingsState.autoGenerate
  },
  get showEventMessages() {
    return settingsState.showEventMessages
  },
  get thinkingBudget() {
    return settingsState.thinkingBudget
  },
  get refineClichés() {
    return settingsState.refineClichés
  },
  get includeNameSuggestions() {
    return settingsState.includeNameSuggestions
  },
  get maxTokens() {
    return settingsState.maxTokens
  },
  get categoryOverrides() {
    return settingsState.categoryOverrides
  },
  get customProviders() {
    return settingsState.customProviders
  },

  // Actions
  setModel: (model: string) => {
    setSettingsState('model', model)

    // Sync with current story if one is loaded
    import('./currentStoryStore').then(({ currentStoryStore }) => {
      if (currentStoryStore.isInitialized) {
        currentStoryStore.setModel(model)
      }
    })
  },
  setStorySetting: (setting: string) => setSettingsState('storySetting', setting),
  setContextSize: (size: number) => setSettingsState('contextSize', size),
  setCharsPerToken: (ratio: number) => setSettingsState('charsPerToken', ratio),
  setShowSettings: (show: boolean) => setSettingsState('showSettings', show),
  toggleSettings: () => setSettingsState('showSettings', !settingsState.showSettings),
  setProvider: (provider: string) => {
    setSettingsState('provider', provider)
    // Clear model selection when switching providers since models are provider-specific
    setSettingsState('model', '')

    // Sync with current story if one is loaded
    import('./currentStoryStore').then(({ currentStoryStore }) => {
      if (currentStoryStore.isInitialized) {
        currentStoryStore.setProvider(provider)
        currentStoryStore.setModel(null)
      }
    })
  },
  setOpenrouterApiKey: (key: string) => setSettingsState('openrouterApiKey', key),
  setAnthropicApiKey: (key: string) => setSettingsState('anthropicApiKey', key),
  setOpenaiApiKey: (key: string) => setSettingsState('openaiApiKey', key),
  setPerson: (person: string) => setSettingsState('person', person),
  setTense: (tense: string) => setSettingsState('tense', tense),
  setAutoGenerate: (enabled: boolean) => setSettingsState('autoGenerate', enabled),
  setShowEventMessages: (show: boolean) => setSettingsState('showEventMessages', show),
  toggleEventMessages: () => setSettingsState('showEventMessages', !settingsState.showEventMessages),
  setThinkingBudget: (budget: number) => setSettingsState('thinkingBudget', budget),
  setRefineClichés: (enabled: boolean) => setSettingsState('refineClichés', enabled),
  setIncludeNameSuggestions: (enabled: boolean) => setSettingsState('includeNameSuggestions', enabled),
  setMaxTokens: (tokens: number) => setSettingsState('maxTokens', tokens),
  addCustomProvider: (provider: CustomProvider) => {
    setSettingsState('customProviders', (prev) => [...prev.filter((p) => p.id !== provider.id), provider])
    // Clear cached client so it picks up new config
    import('../utils/llm/LLMClientFactory').then(({ LLMClientFactory }) => {
      LLMClientFactory.clearClientCache(`custom:${provider.id}`)
    })
  },
  updateCustomProvider: (id: string, updates: Partial<Omit<CustomProvider, 'id'>>) => {
    setSettingsState('customProviders', (p) => p.id === id, updates as any)
  },
  removeCustomProvider: (id: string) => {
    setSettingsState('customProviders', (prev) => prev.filter((p) => p.id !== id))
    // Clear the LLMClientFactory cache for this provider
    import('../utils/llm/LLMClientFactory').then(({ LLMClientFactory }) => {
      LLMClientFactory.clearClientCache(`custom:${id}`)
    })
  },
  getCustomProvider: (id: string): CustomProvider | undefined => {
    return settingsState.customProviders.find((p) => p.id === id)
  },
  setCategoryOverride: (category: string, override: { provider: string; model: string } | null) => {
    if (override) {
      setSettingsState('categoryOverrides', category as keyof CategoryOverrides, override as any)
    } else {
      // Remove the override — create a new object without the key
      const current = { ...settingsState.categoryOverrides }
      delete current[category as keyof CategoryOverrides]
      setSettingsState('categoryOverrides', current)
    }
  },

  // Sync provider and model from story (called when loading a story)
  syncFromStory: (provider?: string, model?: string | null) => {
    if (provider) {
      setSettingsState('provider', provider)
    }
    if (model !== undefined) {
      setSettingsState('model', model || '')
    }
  },
}
