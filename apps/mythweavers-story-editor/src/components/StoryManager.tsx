import { Button, Modal } from '@mythweavers/ui'
import { useNavigate } from '@solidjs/router'
import { Component, Show, createEffect, createMemo, createSignal } from 'solid-js'
import { unwrap } from 'solid-js/store'
import { charactersStore } from '../stores/charactersStore'
import { currentStoryStore } from '../stores/currentStoryStore'
import { messagesStore } from '../stores/messagesStore'
import { storyManagerStore } from '../stores/storyManagerStore'
import { ApiStoryMetadata, apiClient } from '../utils/apiClient'
import { createSavePayload } from '../utils/savePayload'
import { generateStoryFingerprint } from '../utils/storyFingerprint'
import { StoryMetadata, storyManager } from '../utils/storyManager'
import { StoryList, StoryListItem } from './StoryList'
import * as styles from './StoryManager.css'

export const StoryManager: Component = () => {
  const navigate = useNavigate()
  const [savedStories, setSavedStories] = createSignal<StoryMetadata[]>([])
  const [serverStories, setServerStories] = createSignal<ApiStoryMetadata[]>([])
  const [storageInfo, setStorageInfo] = createSignal<{
    usedKB: number
    totalKB: number
    storyCount: number
    totalSizeKB: number
  } | null>(null)
  const [serverAvailable, setServerAvailable] = createSignal(false)
  const [localFingerprints, setLocalFingerprints] = createSignal<Map<string, string>>(new Map())
  // Combined stories list for StoryList component
  const combinedStories = createMemo((): StoryListItem[] => {
    const fingerprints = localFingerprints()

    // Create a Set of server story IDs for quick lookup
    const serverStoryIds = new Set(serverStories().map((s) => s.id))

    // Process saved stories from the index, filtering out local duplicates of server stories
    const indexedStories: StoryListItem[] = savedStories()
      .filter((story) => !serverStoryIds.has(story.id)) // Exclude local stories that exist on server
      .map((story) => ({
        id: story.id,
        name: story.name,
        savedAt: story.savedAt,
        updatedAt: undefined,
        messageCount: story.messageCount,
        characterCount: story.characterCount,
        chapterCount: story.chapterCount || 0,
        storySetting: story.storySetting,
        type: (story.storageMode || 'local') as 'local' | 'server',
        isCurrentStory: currentStoryStore.id === story.id,
      }))

    // Add server stories with fingerprint comparison
    const serverStoriesWithType: StoryListItem[] = serverStories().map((story) => {
      const localFingerprint = fingerprints.get(story.id)
      // Only show button if we actually have a local fingerprint (meaning local version exists)
      const hasLocalDifferences = !!localFingerprint

      // Debug logging
      if (story.fingerprint) {
        console.log(
          `[combinedStories] Story ${story.name} has server fingerprint: ${story.fingerprint}, local: ${localFingerprint || 'none'}`,
        )
      }

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
        isCurrentStory: story.id === currentStoryStore.id,
        fingerprint: story.fingerprint,
        localFingerprint,
        hasLocalDifferences,
      }
    })

    // Combine and sort by date (newest first)
    return [...indexedStories, ...serverStoriesWithType].sort((a, b) => b.savedAt.getTime() - a.savedAt.getTime())
  })
  const [showSaveAs, setShowSaveAs] = createSignal(false)
  const [saveAsName, setSaveAsName] = createSignal('')
  const [saveAsMode, setSaveAsMode] = createSignal<'server' | 'local'>('local')

  // Load saved stories when modal opens
  createEffect(async () => {
    if (storyManagerStore.isOpen) {
      console.log('[StoryManager] Modal opened, loading stories...')
      const stories = await storyManager.getSavedStories()
      setSavedStories(stories)
      const info = await storyManager.getStorageInfo()
      setStorageInfo(info)

      // Check server availability when modal opens
      console.log('[StoryManager] Checking server availability...')
      const available = await storyManager.isServerAvailable()
      console.log('[StoryManager] Server available:', available)
      setServerAvailable(available)

      // Load server stories if available
      if (available) {
        loadServerStories()
      } else {
        console.log('[StoryManager] Server not available, skipping server stories')
      }
    }
  })

  const loadServerStories = async () => {
    console.log('[StoryManager] loadServerStories called!')
    try {
      const stories = await storyManager.getServerStories()
      console.log('[StoryManager] Loaded server stories:', stories)

      // First, set the server stories so they show up with fingerprints
      setServerStories(stories)

      // Then compute local fingerprints for server stories that have local versions
      const newFingerprints = new Map<string, string>()
      for (const serverStory of stories) {
        if (serverStory.fingerprint) {
          console.log(`[StoryManager] Server story ${serverStory.id} has fingerprint: ${serverStory.fingerprint}`)
          // Check if we have a local version
          const localStory = await storyManager.loadStory(serverStory.id)
          if (localStory) {
            const localFingerprint = generateStoryFingerprint(localStory.messages)
            console.log(`[StoryManager] Local story ${serverStory.id} has fingerprint: ${localFingerprint}`)
            console.log(`[StoryManager] Fingerprints match: ${localFingerprint === serverStory.fingerprint}`)
            newFingerprints.set(serverStory.id, localFingerprint)
          }
        }
      }
      // Update the local fingerprints signal - this will trigger a re-computation of combinedStories
      setLocalFingerprints(newFingerprints)
    } catch (error) {
      console.error('Failed to load server stories:', error)
    }
  }

  const handleSaveAs = async () => {
    const name = saveAsName().trim()
    if (!name) return

    if (saveAsMode() === 'server' && serverAvailable()) {
      try {
        // Save to server
        const response = await apiClient.createStory(createSavePayload({ name }))

        // Update current story to the new server story
        currentStoryStore.loadStory(response.id, name, 'server')
        currentStoryStore.setLastKnownUpdatedAt(response.updatedAt)
        currentStoryStore.updateAutoSaveTime()

        // Refresh server stories list
        await loadServerStories()
      } catch (error) {
        console.error('Failed to save as server story:', error)
        // Fall back to local save
        const id = await storyManager.saveStory(
          name,
          unwrap(messagesStore.messages),
          unwrap(charactersStore.characters),
          messagesStore.input,
          currentStoryStore.storySetting,
          'local',
          currentStoryStore.person,
          currentStoryStore.tense,
        )
        currentStoryStore.loadStory(id, name, 'local')
      }
    } else {
      // Save to local
      const id = await storyManager.saveStory(
        name,
        unwrap(messagesStore.messages),
        unwrap(charactersStore.characters),
        messagesStore.input,
        currentStoryStore.storySetting,
        'local',
      )
      currentStoryStore.loadStory(id, name, 'local')
      const stories = await storyManager.getSavedStories()
      setSavedStories(stories)
    }

    // Reset save as dialog
    setShowSaveAs(false)
    setSaveAsName('')
    setSaveAsMode('local')
    const info = await storyManager.getStorageInfo()
    setStorageInfo(info)
  }

  const handleDeleteStory = async (id: string) => {
    if (confirm('Are you sure you want to delete this story?')) {
      await storyManager.deleteStory(id)
      const stories = await storyManager.getSavedStories()
      setSavedStories(stories)
      const info = await storyManager.getStorageInfo()
      setStorageInfo(info)
    }
  }

  // Handlers for StoryList component
  const handleLoadStoryWrapper = async (storyId: string, _type: 'local' | 'server') => {
    // Navigate to the story route regardless of type
    navigate(`/story/${storyId}`)
    storyManagerStore.close()
  }

  const handleDeleteStoryWrapper = async (storyId: string, type: 'local' | 'server') => {
    if (type === 'local') {
      await handleDeleteStory(storyId)
    } else if (type === 'server') {
      if (confirm('Are you sure you want to delete this server story? This action cannot be undone.')) {
        try {
          await apiClient.deleteStory(storyId)
          // Refresh the server stories list
          await loadServerStories()
        } catch (error) {
          console.error('Failed to delete server story:', error)
          alert('Failed to delete server story')
        }
      }
    }
  }

  const handleExportPdf = async (storyId: string) => {
    const story = serverStories().find((s) => s.id === storyId)
    if (story) {
      await handleDownloadPdf(story)
    }
  }

  const refreshStories = async () => {
    const stories = await storyManager.getSavedStories()
    setSavedStories(stories)
    if (serverAvailable()) {
      await loadServerStories()
    }
  }

  const handleDownloadPdf = async (story: ApiStoryMetadata) => {
    try {
      const filename = `${story.name.replace(/[^a-z0-9]/gi, '_')}.pdf`
      await apiClient.downloadStoryAsPdf(story.id, filename)
    } catch (error) {
      console.error('Failed to download PDF:', error)
      alert('Failed to download PDF. Make sure Typst is installed on the server.')
    }
  }

  return (
    <>
      <Modal
        open={storyManagerStore.isOpen}
        onClose={() => storyManagerStore.close()}
        title="Story Manager"
        size="lg"
      >
        {/* Current story bar */}
        <div class={styles.currentStoryBar}>
          <div class={styles.currentStoryInfo}>
            <span class={styles.storageIcon} title={currentStoryStore.storageMode === 'server' ? 'Server storage' : 'Local storage'}>
              {currentStoryStore.storageMode === 'server' ? '☁️' : '💾'}
            </span>
            <span class={styles.storyName}>{currentStoryStore.name || 'Untitled Story'}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setShowSaveAs(!showSaveAs())}>
            Save As...
          </Button>
        </div>

        {/* Save As form */}
        <Show when={showSaveAs()}>
          <div class={styles.saveAsForm}>
            <h5 class={styles.saveAsFormTitle}>Save As New Story</h5>
            <input
              type="text"
              placeholder="New story name..."
              value={saveAsName()}
              onInput={(e) => setSaveAsName(e.target.value)}
              class={styles.inputField}
            />
            <div class={styles.radioGroup}>
              <label class={styles.radioLabel}>
                <input
                  type="radio"
                  name="storage-mode"
                  checked={saveAsMode() === 'local'}
                  onChange={() => setSaveAsMode('local')}
                />
                💾 Local
              </label>
              <Show when={serverAvailable()}>
                <label class={styles.radioLabel}>
                  <input
                    type="radio"
                    name="storage-mode"
                    checked={saveAsMode() === 'server'}
                    onChange={() => setSaveAsMode('server')}
                  />
                  ☁️ Server
                </label>
              </Show>
            </div>
            <div class={styles.buttonRow}>
              <Button variant="primary" onClick={handleSaveAs} disabled={!saveAsName().trim()}>
                Save As
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowSaveAs(false)
                  setSaveAsName('')
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Show>

        {/* Storage info */}
        <Show when={storageInfo()}>
          <div class={styles.storageInfo}>
            {storageInfo()!.storyCount} stories • {storageInfo()!.totalSizeKB}KB used
          </div>
        </Show>

        {/* All stories header */}
        <div class={styles.storiesHeader}>
          <h4 class={styles.storiesTitle}>Stories</h4>
        </div>

        {/* Unified stories list */}
        <div class={styles.storiesSection}>
          <Show
            when={combinedStories().length === 0}
            fallback={
              <StoryList
                stories={combinedStories()}
                onLoadStory={handleLoadStoryWrapper}
                onDeleteStory={handleDeleteStoryWrapper}
                onExportPdf={handleExportPdf}
                onRename={refreshStories}
                editingEnabled={true}
                serverAvailable={serverAvailable()}
              />
            }
          >
            <div class={styles.noStories}>No stories yet</div>
          </Show>
        </div>
      </Modal>
    </>
  )
}
