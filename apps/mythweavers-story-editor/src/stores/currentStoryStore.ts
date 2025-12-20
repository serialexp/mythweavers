import { createStore } from 'solid-js/store'
import { saveService } from '../services/saveService'
import { CurrentStory } from '../types/store'
import { generateMessageId } from '../utils/id'
import { websocketManager } from '../utils/websocket'

// Initialize from URL hash only
const getInitialStory = (): CurrentStory | null => {
  // No hash - return null to show landing page
  return null
}

const initialState = getInitialStory()

// Create a wrapper object to handle null state
interface StoryStateWrapper {
  story: CurrentStory | null
}

const [storyState, setStoryState] = createStore<StoryStateWrapper>({
  story: initialState,
})

export const currentStoryStore = {
  // Getters
  get isInitialized() {
    return storyState.story !== null
  },
  get id() {
    return storyState.story?.id || ''
  },
  get name() {
    return storyState.story?.name || ''
  },
  get isPlaceholderName() {
    return storyState.story?.isPlaceholderName || false
  },
  get lastAutoSaveAt() {
    return storyState.story?.lastAutoSaveAt
  },
  get storageMode() {
    return storyState.story?.storageMode || 'local'
  },
  get person() {
    return storyState.story?.person || 'third'
  },
  get tense() {
    return storyState.story?.tense || 'past'
  },
  get storySetting() {
    return storyState.story?.storySetting || ''
  },
  get lastKnownUpdatedAt() {
    return storyState.story?.lastKnownUpdatedAt
  },
  get globalScript() {
    return storyState.story?.globalScript
  },
  get branchChoices() {
    return storyState.story?.branchChoices || {}
  },
  get timelineStartTime() {
    return storyState.story?.timelineStartTime
  },
  get timelineEndTime() {
    return storyState.story?.timelineEndTime
  },
  get timelineGranularity() {
    return storyState.story?.timelineGranularity || 'hour'
  },
  get provider() {
    return storyState.story?.provider
  },
  get model() {
    return storyState.story?.model
  },
  get paragraphsPerTurn() {
    return storyState.story?.paragraphsPerTurn ?? 3
  },

  // Actions
  setName: (name: string, isPlaceholder = false) => {
    if (!storyState.story) return
    setStoryState('story', 'name', name)
    setStoryState('story', 'isPlaceholderName', isPlaceholder)
  },

  setLastKnownUpdatedAt: (updatedAt: string | undefined) => {
    if (!storyState.story) return
    setStoryState('story', 'lastKnownUpdatedAt', updatedAt)
    // saveService will call this when it gets a response from the server
  },

  setStorageMode: (mode: 'server' | 'local') => {
    if (!storyState.story) return
    setStoryState('story', 'storageMode', mode)
  },

  setPerson: (person: 'first' | 'second' | 'third') => {
    if (!storyState.story) return
    setStoryState('story', 'person', person)
    // Save through saveService (handles local vs server)
    saveService.saveStorySettings(storyState.story.id, { person })
  },

  setTense: (tense: 'present' | 'past') => {
    if (!storyState.story) return
    setStoryState('story', 'tense', tense)
    // Save through saveService (handles local vs server)
    saveService.saveStorySettings(storyState.story.id, { tense })
  },

  setStorySetting: (setting: string) => {
    if (!storyState.story) return
    setStoryState('story', 'storySetting', setting)
    // Save through saveService (handles local vs server)
    saveService.saveStorySettings(storyState.story.id, { storySetting: setting })
  },

  setGlobalScript: (script: string | undefined) => {
    if (!storyState.story) return
    setStoryState('story', 'globalScript', script)
    // Save through saveService (handles local vs server)
    saveService.saveStorySettings(storyState.story.id, { globalScript: script || '' })
  },

  setTimelineStartTime: (time: number | null) => {
    if (!storyState.story) return
    setStoryState('story', 'timelineStartTime', time ?? undefined)
    // Save through saveService (handles local vs server)
    saveService.saveStorySettings(storyState.story.id, { timelineStartTime: time ?? undefined })
  },

  setTimelineEndTime: (time: number | null) => {
    if (!storyState.story) return
    setStoryState('story', 'timelineEndTime', time ?? undefined)
    // Save through saveService (handles local vs server)
    saveService.saveStorySettings(storyState.story.id, { timelineEndTime: time ?? undefined })
  },

  setTimelineGranularity: (granularity: 'hour' | 'day') => {
    if (!storyState.story) return
    setStoryState('story', 'timelineGranularity', granularity)
    // Save through saveService (handles local vs server)
    saveService.saveStorySettings(storyState.story.id, { timelineGranularity: granularity })
  },

  setProvider: (provider: string) => {
    if (!storyState.story) return
    setStoryState('story', 'provider', provider)
    // Save through saveService (handles local vs server)
    saveService.saveStorySettings(storyState.story.id, { provider })
  },

  setModel: (model: string | null) => {
    if (!storyState.story) return
    setStoryState('story', 'model', model)
    // Save through saveService (handles local vs server)
    saveService.saveStorySettings(storyState.story.id, { model })
  },

  setParagraphsPerTurn: (paragraphs: number) => {
    if (!storyState.story) return
    setStoryState('story', 'paragraphsPerTurn', paragraphs)
    // Save through saveService (handles local vs server)
    saveService.saveStorySettings(storyState.story.id, { paragraphsPerTurn: paragraphs })
  },

  setBranchChoice: (branchMessageId: string, optionId: string | null) => {
    if (!storyState.story) return

    const newBranchChoices = { ...storyState.story.branchChoices }

    if (optionId === null) {
      // Remove the choice
      delete newBranchChoices[branchMessageId]
    } else {
      // Set the choice
      newBranchChoices[branchMessageId] = optionId
    }

    setStoryState('story', 'branchChoices', newBranchChoices)
    // Save through saveService (handles local vs server)
    saveService.saveStorySettings(storyState.story.id, { branchChoices: newBranchChoices })
  },

  // Set all branch choices at once (used during story load to avoid multiple updates)
  setBranchChoices: (branchChoices: Record<string, string>) => {
    if (!storyState.story) return
    setStoryState('story', 'branchChoices', branchChoices)
  },

  clearBranchChoices: () => {
    if (!storyState.story) return
    setStoryState('story', 'branchChoices', {})
    // Save through saveService (handles local vs server)
    saveService.saveStorySettings(storyState.story.id, { branchChoices: {} })
  },

  updateAutoSaveTime: () => {
    if (!storyState.story) return
    setStoryState('story', 'lastAutoSaveAt', new Date())
  },

  // Start a new story
  newStory: (storageMode: 'server' | 'local' = 'local', provider?: string, model?: string | null) => {
    const id = generateMessageId()
    setStoryState('story', {
      id,
      name: 'Untitled Story',
      isPlaceholderName: true,
      lastAutoSaveAt: undefined,
      storageMode,
      person: 'third',
      tense: 'past',
      storySetting: '',
      paragraphsPerTurn: 3,
      globalScript: undefined,
      branchChoices: {},
      timelineStartTime: undefined,
      timelineEndTime: undefined,
      timelineGranularity: 'hour',
      provider: provider || 'ollama',
      model: model || null,
    })

    // Connect WebSocket for real-time sync (only if server exists)
    if (storageMode === 'server') {
      websocketManager.connect(id)
    }

    // Clear maps for new story
    import('../stores/mapsStore').then(({ mapsStore }) => {
      mapsStore.clearMaps()
    })
  },

  // Load existing story with optional story-specific settings
  loadStory: (
    id: string,
    name: string,
    storageMode: 'server' | 'local' = 'local',
    person?: 'first' | 'second' | 'third',
    tense?: 'present' | 'past',
    storySetting?: string,
    paragraphsPerTurn?: number,
    globalScript?: string,
    timelineStartTime?: number | null,
    timelineEndTime?: number | null,
    timelineGranularity?: 'hour' | 'day',
    provider?: string,
    model?: string | null,
  ) => {
    setStoryState('story', {
      id,
      name,
      isPlaceholderName: false,
      lastAutoSaveAt: undefined,
      storageMode,
      person: person || 'third',
      tense: tense || 'past',
      storySetting: storySetting || '',
      paragraphsPerTurn: paragraphsPerTurn ?? 3,
      globalScript: globalScript,
      branchChoices: {}, // Start with empty, set later after data loads
      timelineStartTime: timelineStartTime ?? undefined,
      timelineEndTime: timelineEndTime ?? undefined,
      timelineGranularity: timelineGranularity || 'hour',
      provider: provider,
      model: model,
    })

    // Connect WebSocket for real-time sync (only if server exists)
    if (storageMode === 'server') {
      websocketManager.connect(id)
    }

    // Initialize maps for this story
    import('../stores/mapsStore').then(({ mapsStore }) => {
      mapsStore.initializeMaps(storageMode === 'server' ? id : undefined)
    })

    // Initialize landmark states for this story
    if (id) {
      import('../stores/landmarkStatesStore').then(({ landmarkStatesStore }) => {
        if (storageMode === 'server') {
          landmarkStatesStore.loadStates(id)
        } else {
          // For local mode, states are loaded from localStorage as part of the full story
          // Just clear any existing states from a previous story
          landmarkStatesStore.clearStates()
        }
      })
    }
  },

  // Clear the current story
  clearStory: () => {
    // Disconnect WebSocket if connected
    websocketManager.disconnect()
    setStoryState('story', null)

    // Clear landmark states
    import('../stores/landmarkStatesStore').then(({ landmarkStatesStore }) => {
      landmarkStatesStore.clearStates()
    })
  },
}
