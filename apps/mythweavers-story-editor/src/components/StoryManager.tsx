import { Component, Show, createSignal, createEffect, createMemo } from 'solid-js'
import { unwrap } from 'solid-js/store'
import { useNavigate } from '@solidjs/router'
import { storyManager, StoryMetadata } from '../utils/storyManager'
import { ApiStoryMetadata, apiClient } from '../utils/apiClient'
import { settingsStore } from '../stores/settingsStore'
import { modelsStore } from '../stores/modelsStore'
import { currentStoryStore } from '../stores/currentStoryStore'
import { messagesStore } from '../stores/messagesStore'
import { charactersStore } from '../stores/charactersStore'
import { storyManagerStore } from '../stores/storyManagerStore'
import { createSavePayload } from '../utils/savePayload'
import { RefinementPreview, RefinementBatch } from './RefinementPreview'
import { StoryList, StoryListItem } from './StoryList'
import { BsServer } from 'solid-icons/bs'
import { generateStoryFingerprint } from '../utils/storyFingerprint'

export const StoryManager: Component = () => {
  const navigate = useNavigate()
  const [savedStories, setSavedStories] = createSignal<StoryMetadata[]>([])
  const [serverStories, setServerStories] = createSignal<ApiStoryMetadata[]>([])
  const [storageInfo, setStorageInfo] = createSignal<{ usedKB: number; totalKB: number; storyCount: number; totalSizeKB: number } | null>(null)
  const [serverAvailable, setServerAvailable] = createSignal(false)
  const [localFingerprints, setLocalFingerprints] = createSignal<Map<string, string>>(new Map())
  // Combined stories list for StoryList component
  const combinedStories = createMemo((): StoryListItem[] => {
    const fingerprints = localFingerprints()
    
    // Create a Set of server story IDs for quick lookup
    const serverStoryIds = new Set(serverStories().map(s => s.id))
    
    // Process saved stories from the index, filtering out local duplicates of server stories
    const indexedStories: StoryListItem[] = savedStories()
      .filter(story => !serverStoryIds.has(story.id)) // Exclude local stories that exist on server
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
        isCurrentStory: currentStoryStore.id === story.id
      }))
    
    // Add server stories with fingerprint comparison
    const serverStoriesWithType: StoryListItem[] = serverStories().map(story => {
      const localFingerprint = fingerprints.get(story.id)
      // Only show button if we actually have a local fingerprint (meaning local version exists)
      const hasLocalDifferences = !!localFingerprint
      
      // Debug logging
      if (story.fingerprint) {
        console.log(`[combinedStories] Story ${story.name} has server fingerprint: ${story.fingerprint}, local: ${localFingerprint || 'none'}`)
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
        hasLocalDifferences
      }
    })
    
    // Combine and sort by date (newest first)
    return [...indexedStories, ...serverStoriesWithType]
      .sort((a, b) => b.savedAt.getTime() - a.savedAt.getTime())
  })
  const [refining, setRefining] = createSignal<string | null>(null)
  const [refinementProgress, setRefinementProgress] = createSignal<Record<string, number>>({})
  const [showRefinementPreview, setShowRefinementPreview] = createSignal(false)
  const [refinementBatches, setRefinementBatches] = createSignal<RefinementBatch[]>([])
  const [refinementStatus, setRefinementStatus] = createSignal<'not_started' | 'processing' | 'completed' | 'failed'>('not_started')
  const [currentRefinementStory, setCurrentRefinementStory] = createSignal<ApiStoryMetadata | null>(null)
  const [refinementPollInterval, setRefinementPollInterval] = createSignal<ReturnType<typeof setInterval> | null>(null)
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = createSignal<number | undefined>(undefined)
  const [averageBatchTime, setAverageBatchTime] = createSignal<number | undefined>(undefined)
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

  const handleSave = async () => {
    try {
      // If no story is loaded, prompt to use Save As instead
      if (!currentStoryStore.id || currentStoryStore.id === 'new') {
        alert('Please use "Save As" to save a new story')
        setShowSaveAs(true)
        return
      }
      if (currentStoryStore.storageMode === 'server') {
        // Use the centralized save function
        await messagesStore.saveManually()
        alert('Story saved successfully!')
      } else {
        // Save to IndexedDB (though this happens automatically)
        // Need to unwrap proxy objects before saving
        await storyManager.saveStory(
          currentStoryStore.name,
          unwrap(messagesStore.messages),
          unwrap(charactersStore.characters),
          messagesStore.input,
          currentStoryStore.storySetting,
          'local',
          currentStoryStore.person,
          currentStoryStore.tense
        )
        console.log('Story saved to IndexedDB')
      }
      
      // Refresh the stories list
      const stories = await storyManager.getSavedStories()
      setSavedStories(stories)
      if (serverAvailable()) {
        await loadServerStories()
      }
      
      // Show a brief success message (you could add a toast notification here)
      console.log('Story saved successfully')
    } catch (error) {
      console.error('Failed to save story:', error)
      alert('Failed to save story: ' + (error instanceof Error ? error.message : 'Unknown error'))
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
        const id = await storyManager.saveStory(name, unwrap(messagesStore.messages), unwrap(charactersStore.characters), messagesStore.input, currentStoryStore.storySetting, 'local', currentStoryStore.person, currentStoryStore.tense)
        currentStoryStore.loadStory(id, name, 'local')
      }
    } else {
      // Save to local
      const id = await storyManager.saveStory(name, unwrap(messagesStore.messages), unwrap(charactersStore.characters), messagesStore.input, currentStoryStore.storySetting, 'local')
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
    const story = serverStories().find(s => s.id === storyId)
    if (story) {
      await handleDownloadPdf(story)
    }
  }

  const handleRefineStoryWrapper = async (storyId: string) => {
    const story = serverStories().find(s => s.id === storyId)
    if (story) {
      await handleRefineStory(story)
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

  const handleRefineStory = async (story: ApiStoryMetadata) => {
    // Just open the preview modal
    setCurrentRefinementStory(story)
    setRefinementBatches([])
    setRefinementStatus('not_started')
    setRefinementProgress({})
    setEstimatedTimeRemaining(undefined)
    setAverageBatchTime(undefined)
    setShowRefinementPreview(true)
  }

  const startRefinement = async (model: string) => {
    const story = currentRefinementStory()
    if (!story) return
    
    try {
      setRefining(story.id)
      setRefinementStatus('processing')
      
      const result = await apiClient.startRefinement(
        story.id, 
        model,
        currentStoryStore.person,
        currentStoryStore.tense
      )
      
      if (result.success) {
        // Start polling for status
        const pollInterval = setInterval(async () => {
          try {
            const status = await apiClient.getRefinementStatus(story.id)
            
            if (status.status === 'processing' && status.progress !== undefined) {
              setRefinementProgress(prev => ({ ...prev, [story.id]: status.progress! }))
              
              // Update batches and timing
              if (status.batches) {
                setRefinementBatches(status.batches)
              }
              if (status.estimatedTimeRemaining !== undefined) {
                setEstimatedTimeRemaining(status.estimatedTimeRemaining)
              }
              if (status.averageBatchTime !== undefined) {
                setAverageBatchTime(status.averageBatchTime)
              }
            } else if (status.status === 'completed') {
              clearInterval(pollInterval)
              setRefinementPollInterval(null)
              setRefining(null)
              setRefinementProgress(prev => {
                const newProgress = { ...prev }
                delete newProgress[story.id]
                return newProgress
              })
              setRefinementStatus('completed')
              
              // Update final batches
              if (status.batches) {
                setRefinementBatches(status.batches)
              }
              
              // Reload server stories to show the refined version
              await loadServerStories()
            } else if (status.status === 'failed') {
              clearInterval(pollInterval)
              setRefinementPollInterval(null)
              setRefining(null)
              setRefinementProgress(prev => {
                const newProgress = { ...prev }
                delete newProgress[story.id]
                return newProgress
              })
              setRefinementStatus('failed')
              
              // Update final batches
              if (status.batches) {
                setRefinementBatches(status.batches)
              }
            }
          } catch (error) {
            console.error('Failed to check refinement status:', error)
          }
        }, 2000) // Poll every 2 seconds
        
        setRefinementPollInterval(pollInterval)
      }
    } catch (error) {
      console.error('Failed to start refinement:', error)
      setRefining(null)
      setRefinementStatus('failed')
      alert('Failed to start refinement. Make sure the server is running.')
    }
  }

  const stopRefinement = async () => {
    const story = currentRefinementStory()
    if (!story) return
    
    try {
      // Stop polling
      const pollInterval = refinementPollInterval()
      if (pollInterval) {
        clearInterval(pollInterval)
        setRefinementPollInterval(null)
      }
      
      // Call stop endpoint
      await apiClient.stopRefinement(story.id)
      
      setRefining(null)
      setRefinementStatus('failed')
      setRefinementProgress(prev => {
        const newProgress = { ...prev }
        delete newProgress[story.id]
        return newProgress
      })
    } catch (error) {
      console.error('Failed to stop refinement:', error)
    }
  }

  return (
    <>
      <Show when={storyManagerStore.isOpen}>
        <div class="modal-overlay" onClick={() => storyManagerStore.close()}>
          <div class="modal-content story-modal" onClick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h3>Story Manager</h3>
              <button class="modal-close" onClick={() => storyManagerStore.close()}>×</button>
            </div>
            
            <div class="modal-body">
              {/* Current story info */}
              <div class="current-story-section" style="padding: 1rem; background: var(--background-secondary); border-radius: 4px; margin-bottom: 1rem;">
                <h4 style="margin-top: 0;">Current Story</h4>
                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                  <div><strong>Name:</strong> {currentStoryStore.name || 'Untitled Story'}</div>
                  <div><strong>ID:</strong> {currentStoryStore.id || 'New Story'}</div>
                  <div><strong>Storage:</strong> {currentStoryStore.storageMode === 'server' ? '☁️ Server' : '💾 Local'}</div>
                  <div><strong>Stats:</strong> {messagesStore.messages.length} messages, {charactersStore.characters.length} characters</div>
                </div>
                
                {/* Save and Save As buttons */}
                <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                  <button
                    onClick={handleSave}
                    class="save-story-button"
                    title={currentStoryStore.storageMode === 'local' ? 'Save to IndexedDB (auto-saves on changes)' : 'Save to server'}
                  >
                    Save
                  </button>
                  <Show when={!showSaveAs()}>
                    <button 
                      class="save-as-button"
                      onClick={() => setShowSaveAs(true)}
                      style="background: var(--background-secondary); border: 1px solid var(--primary-color); color: var(--primary-color);"
                    >
                      Save As...
                    </button>
                  </Show>
                </div>
                
                {/* Save As form */}
                <Show when={showSaveAs()}>
                  <div class="save-as-form" style="margin-top: 1rem; padding: 1rem; border: 1px solid var(--border-color); border-radius: 4px;">
                    <h5>Save As New Story</h5>
                    <input
                      type="text"
                      placeholder="New story name..."
                      value={saveAsName()}
                      onInput={(e) => setSaveAsName(e.target.value)}
                      class="story-name-input"
                      style="margin-bottom: 0.5rem;"
                    />
                    <div style="margin-bottom: 0.5rem;">
                      <label style="margin-right: 1rem;">
                        <input
                          type="radio"
                          name="storage-mode"
                          checked={saveAsMode() === 'local'}
                          onChange={() => setSaveAsMode('local')}
                        />
                        💾 Local
                      </label>
                      <Show when={serverAvailable()}>
                        <label>
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
                    <div style="display: flex; gap: 0.5rem;">
                      <button
                        onClick={handleSaveAs}
                        disabled={!saveAsName().trim()}
                        class="save-story-button"
                      >
                        Save As
                      </button>
                      <button
                        onClick={() => {
                          setShowSaveAs(false)
                          setSaveAsName('')
                        }}
                        style="background: var(--background-secondary); color: var(--text-primary);"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </Show>
              </div>

              {/* Server status indicator */}
              <Show when={serverAvailable()}>
                <div class="server-status">
                  <BsServer /> Server connected
                </div>
              </Show>

              {/* Storage info */}
              <Show when={storageInfo()}>
                <div class="storage-info">
                  <small>
                    {storageInfo()!.storyCount} stories • {storageInfo()!.totalSizeKB}KB used
                  </small>
                </div>
              </Show>

              {/* All stories header */}
              <div class="saved-stories-header">
                <h4>Stories</h4>
              </div>

              {/* Unified stories list */}
              <div class="saved-stories-section">
                <Show when={combinedStories().length === 0} fallback={
                  <StoryList
                    stories={combinedStories()}
                    onLoadStory={handleLoadStoryWrapper}
                    onDeleteStory={handleDeleteStoryWrapper}
                    onExportPdf={handleExportPdf}
                    onRefineStory={handleRefineStoryWrapper}
                    onRename={refreshStories}
                    refining={refining()}
                    editingEnabled={true}
                    serverAvailable={serverAvailable()}
                  />
                }>
                  <div class="no-stories">No stories yet</div>
                </Show>
              </div>
            </div>
          </div>
        </div>
      </Show>
      
      <RefinementPreview
        storyName={currentRefinementStory()?.name || ''}
        storyId={currentRefinementStory()?.id}
        show={showRefinementPreview()}
        onClose={() => setShowRefinementPreview(false)}
        batches={refinementBatches()}
        overallProgress={refinementProgress()[currentRefinementStory()?.id || ''] || 0}
        status={refinementStatus()}
        availableModels={modelsStore.availableModels}
        currentModel={settingsStore.model}
        onStartRefinement={startRefinement}
        onStopRefinement={stopRefinement}
        estimatedTimeRemaining={estimatedTimeRemaining()}
        averageBatchTime={averageBatchTime()}
      />
    </>
  )
}