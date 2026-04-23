import { createStore, reconcile } from 'solid-js/store'
import { saveService } from '../services/saveService'
import { CurrentStory } from '../types/store'
import { generateMessageId } from '../utils/id'
import { websocketManager } from '../utils/websocket'
import type { StoryAIOverrides } from './effectiveSettingsStore'
import { emit } from './storeEvents'

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
  get storyFormat() {
    return storyState.story?.storyFormat || 'narrative'
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
  get aiOverrides(): StoryAIOverrides | null {
    return storyState.story?.aiOverrides ?? null
  },
  get publishedAt(): string | null {
    return storyState.story?.publishedAt ?? null
  },
  get firstChapterReleasedAt(): string | null {
    return storyState.story?.firstChapterReleasedAt ?? null
  },
  get lastChapterReleasedAt(): string | null {
    return storyState.story?.lastChapterReleasedAt ?? null
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

  setStoryFormat: (format: 'narrative' | 'cyoa') => {
    if (!storyState.story) return
    setStoryState('story', 'storyFormat', format)
    // Save through saveService (handles local vs server)
    saveService.saveStorySettings(storyState.story.id, { format })
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

  /** Load AI overrides from a story (called during story load). */
  loadAIOverrides: (overrides: StoryAIOverrides | null) => {
    if (!storyState.story) return
    setStoryState('story', 'aiOverrides', overrides ? { ...overrides } : null)
  },

  /**
   * Load publishing state from a story (called during story load). These
   * fields don't round-trip through saveService — they're set by server
   * responses only (either on initial load here, or after the saveService
   * publishing callbacks below).
   */
  loadPublishing: (publishing: {
    publishedAt?: string | null
    firstChapterReleasedAt?: string | null
    lastChapterReleasedAt?: string | null
  }) => {
    if (!storyState.story) return
    setStoryState('story', 'publishedAt', publishing.publishedAt ?? null)
    setStoryState('story', 'firstChapterReleasedAt', publishing.firstChapterReleasedAt ?? null)
    setStoryState('story', 'lastChapterReleasedAt', publishing.lastChapterReleasedAt ?? null)
  },

  /**
   * Apply a publishedAt change returned by the server after a story
   * publish/schedule/unpublish. Does NOT persist — saveService already did.
   */
  applyServerStoryPublishedAt: (publishedAt: string | null) => {
    if (!storyState.story) return
    setStoryState('story', 'publishedAt', publishedAt)
  },

  /**
   * Apply release-date recomputation returned by the server after a chapter
   * publish/schedule/unpublish. Does NOT persist — the chapter mutation is
   * what changed these, and saveService already did the write.
   */
  applyServerReleaseDates: (releaseDates: {
    firstChapterReleasedAt: string | null
    lastChapterReleasedAt: string | null
  }) => {
    if (!storyState.story) return
    setStoryState('story', 'firstChapterReleasedAt', releaseDates.firstChapterReleasedAt)
    setStoryState('story', 'lastChapterReleasedAt', releaseDates.lastChapterReleasedAt)
  },

  /** Set a single AI override for the current story. Pass null to clear. */
  setAIOverride: <K extends keyof StoryAIOverrides>(key: K, value: StoryAIOverrides[K] | null) => {
    if (!storyState.story) return
    const current = storyState.story.aiOverrides ?? {}
    const updated: StoryAIOverrides = { ...current }
    if (value === null || value === undefined) {
      delete updated[key]
    } else {
      updated[key] = value
    }
    // Use reconcile to properly replace the entire object (SolidJS gotcha)
    setStoryState('story', 'aiOverrides', reconcile(updated))
    // Persist
    saveService.saveStorySettings(storyState.story.id, { aiOverrides: Object.keys(updated).length > 0 ? updated : null })
  },

  /** Clear all AI overrides for the current story. */
  clearAllAIOverrides: () => {
    if (!storyState.story) return
    setStoryState('story', 'aiOverrides', null)
    saveService.saveStorySettings(storyState.story.id, { aiOverrides: null })
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
      storyFormat: 'narrative',
      paragraphsPerTurn: 3,
      globalScript: undefined,
      branchChoices: {},
      timelineStartTime: undefined,
      timelineEndTime: undefined,
      timelineGranularity: 'hour',
      provider: provider || 'ollama',
      model: model || null,
      aiOverrides: null,
      publishedAt: null,
      firstChapterReleasedAt: null,
      lastChapterReleasedAt: null,
    })

    // Connect WebSocket for real-time sync (only if server exists)
    if (storageMode === 'server') {
      websocketManager.connect(id)
    }

    emit('story:new', { storyId: id })
  },

  // Load existing story with optional story-specific settings
  loadStory: (
    id: string,
    name: string,
    storageMode: 'server' | 'local' = 'local',
    person?: 'first' | 'second' | 'third',
    tense?: 'present' | 'past',
    storySetting?: string,
    storyFormat?: 'narrative' | 'cyoa',
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
      storyFormat: storyFormat || 'narrative',
      paragraphsPerTurn: paragraphsPerTurn ?? 3,
      globalScript: globalScript,
      branchChoices: {}, // Start with empty, set later after data loads
      timelineStartTime: timelineStartTime ?? undefined,
      timelineEndTime: timelineEndTime ?? undefined,
      timelineGranularity: timelineGranularity || 'hour',
      provider: provider,
      model: model,
      aiOverrides: null, // Loaded separately via loadAIOverrides()
    })

    // Connect WebSocket for real-time sync (only if server exists)
    if (storageMode === 'server') {
      websocketManager.connect(id)
    }

    emit('story:loaded', { storyId: id, storageMode })
  },

  // Clear the current story
  clearStory: () => {
    // Disconnect WebSocket if connected
    websocketManager.disconnect()
    setStoryState('story', null)

    emit('story:cleared')
  },
}
