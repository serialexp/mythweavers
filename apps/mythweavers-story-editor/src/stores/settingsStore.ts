import { createEffect } from 'solid-js'
import { createStore } from 'solid-js/store'
import { DEFAULT_CHARS_PER_TOKEN, DEFAULT_CONTEXT_SIZE } from '../constants'

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
  useSmartContext: localStorage.getItem('story-use-smart-context') === 'true',
  person: localStorage.getItem('story-person') || 'third',
  tense: localStorage.getItem('story-tense') || 'past',
  autoGenerate: localStorage.getItem('story-auto-generate') === 'true',
  paragraphsPerTurn: Number.parseInt(localStorage.getItem('story-paragraphs-per-turn') || '3'),
  showEventMessages: localStorage.getItem('story-show-event-messages') !== 'false', // Default to true
  thinkingBudget: Number.parseInt(localStorage.getItem('story-thinking-budget') || '0'), // 0 = no budget
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
  localStorage.setItem('story-use-smart-context', settingsState.useSmartContext.toString())
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
  localStorage.setItem('story-paragraphs-per-turn', settingsState.paragraphsPerTurn.toString())
})

createEffect(() => {
  localStorage.setItem('story-show-event-messages', settingsState.showEventMessages.toString())
})

createEffect(() => {
  localStorage.setItem('story-thinking-budget', settingsState.thinkingBudget.toString())
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
  get useSmartContext() {
    return settingsState.useSmartContext
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
  get paragraphsPerTurn() {
    return settingsState.paragraphsPerTurn
  },
  get showEventMessages() {
    return settingsState.showEventMessages
  },
  get thinkingBudget() {
    return settingsState.thinkingBudget
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
  setUseSmartContext: (enabled: boolean) => setSettingsState('useSmartContext', enabled),
  setPerson: (person: string) => setSettingsState('person', person),
  setTense: (tense: string) => setSettingsState('tense', tense),
  setAutoGenerate: (enabled: boolean) => setSettingsState('autoGenerate', enabled),
  setParagraphsPerTurn: (paragraphs: number) => setSettingsState('paragraphsPerTurn', paragraphs),
  setShowEventMessages: (show: boolean) => setSettingsState('showEventMessages', show),
  toggleEventMessages: () => setSettingsState('showEventMessages', !settingsState.showEventMessages),
  setThinkingBudget: (budget: number) => setSettingsState('thinkingBudget', budget),

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
