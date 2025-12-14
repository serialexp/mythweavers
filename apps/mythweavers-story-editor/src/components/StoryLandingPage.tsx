import { Component, Show, createSignal, onMount, createMemo } from 'solid-js'
import { storyManager, StoryMetadata } from '../utils/storyManager'
import { ApiStoryMetadata, apiClient } from '../utils/apiClient'
import { postMyStories, postMyStoriesByStoryIdCalendars, getCalendarsPresets } from '../client/config'
import { currentStoryStore } from '../stores/currentStoryStore'
import { messagesStore } from '../stores/messagesStore'
import { charactersStore } from '../stores/charactersStore'
import { contextItemsStore } from '../stores/contextItemsStore'
import { nodeStore } from '../stores/nodeStore'
import { mapsStore } from '../stores/mapsStore'
import { StoryList, StoryListItem } from './StoryList'
import { NewStoryForm } from './NewStoryForm'
import { generateStoryFingerprint } from '../utils/storyFingerprint'
import styles from './StoryLandingPage.module.css'

interface StoryLandingPageProps {
  onSelectStory: (storyId: string) => void
}

export const StoryLandingPage: Component<StoryLandingPageProps> = (props) => {
  const [localStories, setLocalStories] = createSignal<StoryMetadata[]>([])
  const [serverStories, setServerStories] = createSignal<ApiStoryMetadata[]>([])
  const [serverAvailable, setServerAvailable] = createSignal(false)
  const [loading, setLoading] = createSignal(true)
  const [syncing, setSyncing] = createSignal<string | null>(null)
  const [activeTab, setActiveTab] = createSignal<'new' | 'load'>('new')
  const [localFingerprints, setLocalFingerprints] = createSignal<Map<string, string>>(new Map())

  // Combined stories list
  const combinedStories = createMemo((): StoryListItem[] => {
    const serverStoryIds = new Set(serverStories().map(s => s.id))
    const fingerprints = localFingerprints()
    
    // Process local stories, filtering out duplicates
    const localStoriesProcessed: StoryListItem[] = localStories()
      .filter(story => !serverStoryIds.has(story.id))
      .map(story => ({
        id: story.id,
        name: story.name,
        savedAt: story.savedAt,
        updatedAt: undefined,
        messageCount: story.messageCount,
        characterCount: story.characterCount,
        chapterCount: story.chapterCount || 0,
        storySetting: story.storySetting,
        type: (story.storageMode || 'local') as 'local' | 'server',
        isCurrentStory: false // No current story on landing page
      }))
    
    // Process server stories with fingerprint comparison
    const serverStoriesProcessed: StoryListItem[] = serverStories().map(story => {
      const localFingerprint = fingerprints.get(story.id)
      // Only show button if we actually have a local fingerprint (meaning local version exists)
      const hasLocalDifferences = !!localFingerprint
      
      return {
        id: story.id,
        name: story.name,
        savedAt: new Date(story.savedAt),
        updatedAt: story.updatedAt,
        messageCount: story.messageCount,
        characterCount: story.characterCount,
        chapterCount: story.chapterCount || 0,
        storySetting: story.storySetting,
        type: 'server' as const,
        isCurrentStory: false,
        fingerprint: story.fingerprint,
        localFingerprint,
        hasLocalDifferences
      }
    })
    
    // Combine and sort by date (newest first)
    return [...localStoriesProcessed, ...serverStoriesProcessed]
      .sort((a, b) => b.savedAt.getTime() - a.savedAt.getTime())
  })

  const loadStories = async () => {
    setLoading(true)
    
    // Check server availability
    console.log('[LandingPage] Checking server availability...')
    const available = await storyManager.isServerAvailable()
    console.log('[LandingPage] Server available:', available)
    setServerAvailable(available)
    
    // Load local stories
    const stories = await storyManager.getSavedStories()
    console.log('[LandingPage] Local stories from index:', stories.map(s => ({ id: s.id, name: s.name })))
    setLocalStories(stories)
    
    // Load server stories if available
    if (available) {
      try {
        console.log('[LandingPage] Loading server stories...')
        const serverStoriesList = await storyManager.getServerStories()
        console.log('[LandingPage] Server stories loaded:', serverStoriesList)
        setServerStories(serverStoriesList)
        
        // Compute local fingerprints for server stories that have local versions
        const newFingerprints = new Map<string, string>()
        for (const serverStory of serverStoriesList) {
          if (serverStory.fingerprint) {
            // Check if we have a local version
            const localStory = await storyManager.loadStory(serverStory.id)
            if (localStory) {
              console.log(`[LandingPage] Local story loaded:`, localStory)
              console.log(`[LandingPage] Local story ${serverStory.name} has ${localStory.messages?.length || 0} messages`)
              console.log(`[LandingPage] First message:`, localStory.messages?.[0])
              const localFingerprint = generateStoryFingerprint(localStory.messages)
              console.log(`[LandingPage] Story ${serverStory.name}: server=${serverStory.fingerprint.substring(0,6)}, local=${localFingerprint}`)
              newFingerprints.set(serverStory.id, localFingerprint)
            } else {
              console.log(`[LandingPage] No local version found for ${serverStory.name}`)
            }
          }
        }
        setLocalFingerprints(newFingerprints)
      } catch (error) {
        console.error('Failed to load server stories:', error)
      }
    }
    
    setLoading(false)
  }

  // Load stories on mount
  onMount(loadStories)

  const handleLoadStory = async (storyId: string, _type: 'local' | 'server') => {
    // Simply navigate to the story route
    props.onSelectStory(storyId)
  }

  const handleCreateStory = async (name: string, storageMode: 'local' | 'server', calendarPresetId?: string) => {
    const trimmedName = name.trim()
    if (!trimmedName) return

    if (storageMode === 'server') {
      // For server stories, don't clear state - let the route handler do a clean load
      // The route's loadStoryById will call resetStoryState before loading
      try {
        const result = await postMyStories({
          body: {
            name: trimmedName,
            summary: '',
          }
        })

        if (!result.data) {
          console.error('Failed to create story on server')
          return
        }

        const newStory = result.data.story

        // Create default calendar if preset was selected
        if (calendarPresetId) {
          try {
            // Fetch the preset configuration
            const presetsResponse = await getCalendarsPresets()
            const preset = presetsResponse.data?.presets?.find(p => p.id === calendarPresetId)

            if (preset) {
              await postMyStoriesByStoryIdCalendars({
                path: { storyId: newStory.id },
                body: {
                  name: preset.name,
                  config: preset,
                  setAsDefault: true,
                }
              })
            }
          } catch (error) {
            console.error('Failed to create default calendar:', error)
            // Continue anyway - calendar can be created later
          }
        }

        // Don't manually load the story - let the route handler load it properly via export endpoint
        // Just navigate to it and the /story/:id route will call loadStoryById which uses getMyStoriesByIdExport
        props.onSelectStory(newStory.id)
        return
      } catch (error) {
        console.error('Failed to create server story:', error)
        alert('Failed to create story on server. Please try again.')
        return
      }
    }

    // Local stories are created entirely client-side
    // Clear existing in-memory state first
    messagesStore.setMessages([])
    messagesStore.setInput('')
    charactersStore.setCharacters([])
    contextItemsStore.setContextItems([])
    nodeStore.clear()
    mapsStore.clearMaps()
    currentStoryStore.clearStory()

    currentStoryStore.newStory(storageMode)
    currentStoryStore.setName(trimmedName, false)
    messagesStore.setInput('')

    // Save the empty story to localStorage immediately so it can be reloaded
    const storyId = currentStoryStore.id
    await storyManager.updateLocalStory(storyId, {
      id: storyId,
      name: trimmedName,
      savedAt: new Date(),
      messages: [],
      characters: [],
      contextItems: [],
      nodes: [],
      input: '',
      storySetting: '',
      storageMode: 'local',
      person: 'third',
      tense: 'past',
    })

    props.onSelectStory(storyId)
  }

  const handleDeleteStory = async (storyId: string, type: 'local' | 'server') => {
    try {
      if (type === 'server') {
        await storyManager.deleteFromServer(storyId)
        setServerStories(prev => prev.filter(s => s.id !== storyId))
      } else {
        await storyManager.deleteStory(storyId)
        setLocalStories(prev => prev.filter(s => s.id !== storyId))
      }
    } catch (error) {
      console.error('Failed to delete story:', error)
      alert('Failed to delete story. Please try again.')
    }
  }

  const handleSyncToServer = async (storyId: string) => {
    setSyncing(storyId)
    try {
      const data = await storyManager.loadStory(storyId)
      if (data) {
        await apiClient.createStory({
          name: data.name,
          messages: data.messages || [],
          characters: data.characters || [],
          contextItems: data.contextItems || [],
          input: data.input || '',
          storySetting: data.storySetting || '',
          person: data.person || 'third',
          tense: data.tense || 'past',
          globalScript: data.globalScript
        })
        
        // Update local story to mark it as server-synced
        await storyManager.updateStoryMetadata(storyId, { storageMode: 'server' })
        
        // Reload stories
        const serverStoriesList = await apiClient.getStories()
        setServerStories(serverStoriesList)
        const localStoriesList = await storyManager.getSavedStories()
        setLocalStories(localStoriesList)
      }
    } catch (error) {
      console.error('Failed to sync story:', error)
      alert('Failed to sync story to server. Please try again.')
    } finally {
      setSyncing(null)
    }
  }

  return (
    <div class={styles.container}>
      <div class={styles.header}>
        <h1>Story Writer</h1>
        <p>Create a new story or load an existing one</p>
      </div>

      <div class={styles.content}>
        <div class={styles.tabs}>
          <button
            class={`${styles.tab} ${activeTab() === 'new' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('new')}
          >
            New Story
          </button>
          <button
            class={`${styles.tab} ${activeTab() === 'load' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('load')}
          >
            Load Story ({combinedStories().length})
          </button>
        </div>

        <div class={styles.tabContent}>
          <Show when={activeTab() === 'new'}>
            <div class={styles.newStorySection}>
              <h2>Create New Story</h2>
              <NewStoryForm
                serverAvailable={serverAvailable()}
                onCreateStory={handleCreateStory}
              />
            </div>
          </Show>

          <Show when={activeTab() === 'load'}>
            <div class={styles.loadStorySection}>
              <Show 
                when={!loading()} 
                fallback={<div class={styles.loading}>Loading stories...</div>}
              >
                <Show 
                  when={combinedStories().length > 0}
                  fallback={
                    <div class={styles.noStories}>
                      No saved stories found. Create a new story to get started!
                    </div>
                  }
                >
                  <StoryList
                    stories={combinedStories()}
                    onLoadStory={handleLoadStory}
                    onDeleteStory={handleDeleteStory}
                    onSyncToServer={serverAvailable() ? handleSyncToServer : undefined}
                    syncing={syncing()}
                    editingEnabled={true}
                    serverAvailable={serverAvailable()}
                    onRename={loadStories}
                  />
                </Show>
              </Show>
            </div>
          </Show>
        </div>
      </div>
    </div>
  )
}
