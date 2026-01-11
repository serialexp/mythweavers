import { Route, useNavigate, useParams } from '@solidjs/router'
import { Component, Show, createEffect, createMemo, createSignal, onCleanup, onMount, untrack } from 'solid-js'
import './styles/variables.css'
import './App.css'
import * as styles from './App.css.ts'
import { Spinner } from '@mythweavers/ui'
import { ConflictResolutionDialog } from './components/ConflictResolutionDialog'
import { ContextPreviewModal } from './components/ContextPreviewModal'
import { CopyTokenModal } from './components/CopyTokenModal'
import { EpisodeViewer } from './components/EpisodeViewer'
import { ErrorNotifications } from './components/ErrorNotifications'
import { GlobalStatusIndicator } from './components/GlobalStatusIndicator'
import { LoginForm } from './components/LoginForm'
// SceneEditorWrapper import removed - component used via lazy loading or routes
import { MessageList } from './components/MessageList'
import { MessageRewriterDialog } from './components/MessageRewriterDialog'
import { MassRewriteDialog } from './components/MassRewriteDialog'
import { SingleRewriteDialog } from './components/SingleRewriteDialog'
import { PendingEntitiesModal } from './components/PendingEntitiesModal'
import { ResetPassword } from './components/ResetPassword'
import { SearchModal } from './components/SearchModal'
import { ServerStatusIndicator } from './components/ServerStatusIndicator'
import { StorageFullModal } from './components/StorageFullModal'
import { StoryHeader } from './components/StoryHeader'
import { StoryInput } from './components/StoryInput'
import { StoryLandingPage } from './components/StoryLandingPage'
import { StoryManager } from './components/StoryManager'
import { StoryNavigation } from './components/StoryNavigation'
import { useCacheManagement } from './hooks/useCacheManagement'
import { useOllama } from './hooks/useOllama'
import { useStoryGeneration } from './hooks/useStoryGeneration'
import { authStore } from './stores/authStore'
import { calendarStore } from './stores/calendarStore'
import { charactersStore } from './stores/charactersStore'
import { contextItemsStore } from './stores/contextItemsStore'
import { currentStoryStore } from './stores/currentStoryStore'
import { episodeViewerStore } from './stores/episodeViewerStore'
import { globalOperationStore } from './stores/globalOperationStore'
import { headerStore } from './stores/headerStore'
import { mapsStore } from './stores/mapsStore'
import { messagesStore } from './stores/messagesStore'
import { plotPointsStore } from './stores/plotPointsStore'
import { modelsStore } from './stores/modelsStore'
import { nodeStore } from './stores/nodeStore'
import { rewriteDialogStore } from './stores/rewriteDialogStore'
import { serverStore } from './stores/serverStore'
import { settingsStore } from './stores/settingsStore'
import { ApiStory } from './types/api'
import { Character, ContextItem, Message, Node } from './types/core'
import type { BranchConversionResult } from './utils/claudeChatImport'
import { importClaudeChat, importClaudeChatWithBranches } from './utils/claudeChatImporter'
import { storyManager } from './utils/storyManager'

// Component to redirect to login
const RedirectToLogin: Component = () => {
  const navigate = useNavigate()
  onMount(() => {
    navigate('/login', { replace: true })
  })
  return <div class={styles.app}>Redirecting...</div>
}

const App: Component = () => {
  const { generateResponse, generateSummaries, abortGeneration, isGenerating, checkIfOllamaIsBusy } = useOllama()

  const [showContextPreview, setShowContextPreview] = createSignal(false)
  const [contextPreviewData, setContextPreviewData] = createSignal<{
    type: string
    messages: Array<{
      role: 'system' | 'user' | 'assistant'
      content: string
      cache_control?: { type: 'ephemeral'; ttl?: '5m' | '1h' }
    }>
  } | null>(null)
  const [ollamaExternallyBusy, setOllamaExternallyBusy] = createSignal(false)
  const [serverDataConflict, setServerDataConflict] = createSignal<{
    serverStory: ApiStory
    localMessages: Message[]
  } | null>(null)

  // Mobile detection - updates on window resize
  const [isMobile, setIsMobile] = createSignal(window.innerWidth <= 768)

  // Check if story is initialized
  const storyLoaded = createMemo(() => currentStoryStore.isInitialized)

  // Initialize story generation hook
  const {
    handleAutoOrManualSubmit,
    handleSubmit,
    regenerateLastMessage,
    handleSummarizeMessage,
    handleAnalyzeMessage,
    handleShowContextPreview,
  } = useStoryGeneration({
    generateResponse,
    generateSummaries,
  })

  // Initialize cache management
  useCacheManagement()

  // Effective context size based on model and provider
  const effectiveContextSize = createMemo(() => {
    const selectedModel = modelsStore.availableModels.find((m) => m.name === settingsStore.model)

    // For Anthropic and OpenRouter, always use the model's full context length
    if (settingsStore.provider === 'anthropic' || settingsStore.provider === 'openrouter') {
      if (selectedModel?.context_length) {
        return selectedModel.context_length
      }
    }

    // For Ollama, use the minimum of user setting and model's context length
    if (selectedModel?.context_length) {
      return Math.min(settingsStore.contextSize, selectedModel.context_length)
    }
    return settingsStore.contextSize
  })

  // Initialize messagesStore effects for localStorage persistence
  messagesStore.initializeEffects()

  // Clean up old settings
  localStorage.removeItem('story-ollama-host')
  localStorage.removeItem('story-current') // No longer using localStorage for current story

  // Check session on mount - has built-in protection against overwriting fresh logins
  onMount(() => {
    authStore.checkSession()

    // Start periodic health checks
    const cleanup = serverStore.startHealthCheck(30000)

    const handleFocus = () => {
      serverStore.checkHealth()
    }

    // Update mobile detection on resize
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768)
    }

    window.addEventListener('focus', handleFocus)
    window.addEventListener('resize', handleResize)

    onCleanup(() => {
      cleanup()
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('resize', handleResize)
    })
  })

  // Fetch models on initialization and when provider changes
  // Only fetch if server is available
  createEffect(() => {
    // Access provider to make this effect reactive to provider changes
    settingsStore.provider

    // Only fetch models if server is available or if using a non-server provider
    if (serverStore.isAvailable || settingsStore.provider !== 'ollama') {
      modelsStore.fetchModels()
    }
  })

  // Helper function to load server story data from export format
  const loadServerStoryData = async (exportData: any, storyId: string) => {
    try {
      const { story, books, characters, contextItems, calendars, maps } = exportData

      console.log('[loadServerStoryData] Export data:', {
        bookCount: books?.length || 0,
        characterCount: characters?.length || 0,
        contextItemCount: contextItems?.length || 0,
        calendarCount: calendars?.length || 0,
        mapCount: maps?.length || 0,
      })

      console.log('[loadServerStoryData] Calling currentStoryStore.loadStory...')
      // Map backend enum values to frontend format
      const perspectiveMap: Record<string, 'first' | 'second' | 'third'> = {
        FIRST: 'first',
        SECOND: 'second',
        THIRD: 'third',
      }
      const tenseMap: Record<string, 'past' | 'present'> = {
        PAST: 'past',
        PRESENT: 'present',
      }
      currentStoryStore.loadStory(
        storyId,
        story.name,
        'server',
        perspectiveMap[story.defaultPerspective || 'THIRD'],
        tenseMap[story.defaultTense || 'PAST'],
        story.genre || '', // genre is the storySetting field
        (story.format as 'narrative' | 'cyoa') || 'narrative',
        story.paragraphsPerTurn ?? 3,
        story.globalScript ?? undefined,
        story.timelineStartTime ?? undefined,
        story.timelineEndTime ?? undefined,
        story.timelineGranularity || 'hour',
        story.provider || 'ollama',
        story.model,
      )

      console.log('[loadServerStoryData] Setting last known updated at...')
      currentStoryStore.setLastKnownUpdatedAt(story.updatedAt)

      // Sync provider and model from story to settingsStore
      console.log('[loadServerStoryData] Syncing provider and model...')
      settingsStore.syncFromStory(story.provider, story.model)

      // Load calendars
      if (calendars && calendars.length > 0) {
        calendarStore.loadFromExport(calendars)
      } else {
        calendarStore.clear()
      }

      // Load basic map metadata (details will be lazy-loaded when map is opened)
      if (maps && maps.length > 0) {
        mapsStore.loadFromExport(maps)
      } else {
        mapsStore.clearMaps()
      }

      // Load plot point definitions from story
      plotPointsStore.setDefinitions(story.plotPointDefaults || [])

      // Fetch plot point states from API
      try {
        const { getMyStoriesByStoryIdPlotPointStates } = await import('./client/config')
        const { data } = await getMyStoriesByStoryIdPlotPointStates({ path: { storyId } })
        const plotPointStates = data?.plotPointStates ?? []
        plotPointsStore.setStates(
          plotPointStates.map((s) => ({
            id: s.id,
            storyId: s.storyId,
            messageId: s.messageId,
            key: s.key,
            value: s.value,
          })),
        )
      } catch (error) {
        console.error('[loadServerStoryData] Failed to load plot point states:', error)
        // Don't fail the whole load, just continue with empty states
        plotPointsStore.setStates([])
      }

      // Transform the hierarchical data into flat arrays for the old system
      // TODO: This is a temporary bridge - eventually we should update the stores to use the new hierarchy
      const nodes: any[] = []
      const messages: Message[] = []

      // Build nodes array from books → arcs → chapters
      books?.forEach((book: any, bookIndex: number) => {
        const bookNode = {
          id: book.id,
          storyId: book.storyId,
          parentId: null,
          type: 'book',
          title: book.name,
          summary: book.summary,
          order: book.sortOrder ?? bookIndex,
          expanded: true,
          isOpen: true,
          createdAt: book.createdAt,
          updatedAt: book.updatedAt,
        }
        nodes.push(bookNode)

        book.arcs?.forEach((arc: any, arcIndex: number) => {
          const arcNode = {
            id: arc.id,
            storyId: book.storyId,
            parentId: book.id,
            type: 'arc',
            title: arc.name,
            summary: arc.summary,
            order: arc.sortOrder ?? arcIndex,
            expanded: true,
            isOpen: true,
            createdAt: arc.createdAt,
            updatedAt: arc.updatedAt,
          }
          nodes.push(arcNode)

          arc.chapters?.forEach((chapter: any, chapterIndex: number) => {
            const chapterNode = {
              id: chapter.id,
              storyId: book.storyId,
              parentId: arc.id,
              type: 'chapter',
              title: chapter.name,
              summary: chapter.summary,
              order: chapter.sortOrder ?? chapterIndex,
              nodeType: chapter.nodeType || 'story',
              status: chapter.status,
              expanded: true,
              isOpen: true,
              createdAt: chapter.createdAt,
              updatedAt: chapter.updatedAt,
            }
            nodes.push(chapterNode)

            // Process scenes - now keeping them as nodes in the hierarchy
            chapter.scenes?.forEach((scene: any, sceneIndex: number) => {
              const sceneNode = {
                id: scene.id,
                storyId: book.storyId,
                parentId: chapter.id,
                type: 'scene',
                title: scene.name || `Scene ${sceneIndex + 1}`,
                summary: scene.summary,
                order: scene.sortOrder ?? sceneIndex,
                // Scene-specific fields
                goal: scene.goal,
                activeCharacterIds: scene.activeCharacterIds,
                activeContextItemIds: scene.activeContextItemIds,
                viewpointCharacterId: scene.viewpointCharacterId,
                perspective: scene.perspective,
                storyTime: scene.storyTime,
                status: scene.status,
                includeInFull: scene.includeInFull,
                expanded: true,
                isOpen: true,
                createdAt: scene.createdAt,
                updatedAt: scene.updatedAt,
              }
              nodes.push(sceneNode)

              // Extract messages from scene
              scene.messages?.forEach((message: any) => {
                if (message.revision) {
                  // Map paragraphs using body/contentSchema format directly (matches backend)
                  const paragraphs =
                    message.revision.paragraphs?.map((para: any) => ({
                      id: para.id,
                      body: para.revision?.body || '',
                      contentSchema: para.revision?.contentSchema || null,
                      state: (para.revision?.state || 'draft').toLowerCase(),
                      comments: [],
                      plotPointActions: para.revision?.plotPointActions || [],
                      inventoryActions: para.revision?.inventoryActions || [],
                    })) || []

                  // Create flattened content for display (body is always plain text)
                  const content = paragraphs.map((p: any) => p.body).join('\n\n')

                  const messageWithParagraphs: Message = {
                    id: message.id,
                    role: 'assistant',
                    content, // For backward compat display
                    paragraphs, // The actual structured data!
                    instruction: message.instruction || undefined,
                    script: message.script || undefined,
                    timestamp: new Date(message.createdAt),
                    order: message.sortOrder,
                    sceneId: scene.id,
                    currentMessageRevisionId: message.currentMessageRevisionId, // Needed for paragraph operations
                    isQuery: false,
                    think: message.revision.think || undefined,
                    model: message.revision.model || undefined,
                    tokensPerSecond: message.revision.tokensPerSecond || undefined,
                    totalTokens: message.revision.totalTokens || undefined,
                    promptTokens: message.revision.promptTokens || undefined,
                    // Branch support
                    type: message.type || undefined,
                    options: message.options || undefined,
                  }

                  messages.push(messageWithParagraphs)
                }
              })
            })
          })
        })
      })

      console.log('[loadServerStoryData] Transformed data:', {
        nodeCount: nodes.length,
        messageCount: messages.length,
      })

      // Transform characters to include image URLs
      const { getApiBaseUrl } = await import('./client/config')
      const baseUrl = getApiBaseUrl()
      const transformedCharacters = (characters || []).map((char: any) => ({
        ...char,
        // If pictureFileUrl exists, construct the full URL for the image
        profileImageData: char.pictureFileUrl ? `${baseUrl}${char.pictureFileUrl}` : null,
      }))

      // Load the story data with transformed arrays
      handleLoadStory(
        messages,
        transformedCharacters,
        '', // input - not stored in new schema
        '', // storySetting - not stored in new schema
        contextItems || [],
        nodes,
        story.selectedNodeId || null, // Restore last selected node
      )

      // Set branch choices after data is loaded
      if (story.branchChoices) {
        currentStoryStore.setBranchChoices(story.branchChoices)
      }

      // Clean up any local duplicate
      console.log('[loadServerStoryData] Cleaning up local duplicate...')
      const localStory = await storyManager.loadStory(storyId)
      if (localStory) {
        await storyManager.deleteStory(storyId)
      }

      console.log('[loadServerStoryData] Done loading server story')
    } catch (error) {
      console.error('[loadServerStoryData] Error loading server story:', error)
      console.error('[loadServerStoryData] Error stack:', error instanceof Error ? error.stack : 'No stack')
      throw error
    }
  }

  const resetStoryState = async () => {
    console.log('[resetStoryState] Clearing previous story data before loading new story')
    setServerDataConflict(null)
    messagesStore.setShowConflictDialog(false)
    messagesStore.setMessages([])
    messagesStore.clearInput()
    charactersStore.setCharacters([])
    contextItemsStore.setContextItems([])
    nodeStore.clear()
    currentStoryStore.clearStory()
    mapsStore.clearMaps()
    plotPointsStore.clear()
  }

  // Load story by ID (used by story route)
  const loadStoryById = async (storyId: string): Promise<boolean> => {
    // Loading story by ID

    // Check if this is an old ID format (timestamp-based)
    // Matches patterns like: 1754232850821-w2kv7u3vl or 1754232438376-pm7i6zrj2
    if (/^\d{13}-\w+$/.test(storyId)) {
      // Detected old story ID format
      return false
    }

    // Try server first (server stories take priority)
    try {
      const { getMyStoriesByIdExport } = await import('./client/config')
      const result = await getMyStoriesByIdExport({ path: { id: storyId } })
      const exportData = result.data
      console.log('[loadStoryById] Received exported story data:', {
        hasStory: !!exportData?.story,
        bookCount: exportData?.books?.length || 0,
        characterCount: exportData?.characters?.length || 0,
        contextItemCount: exportData?.contextItems?.length || 0,
        calendarCount: exportData?.calendars?.length || 0,
        mapCount: exportData?.maps?.length || 0,
      })
      if (exportData?.story) {
        // Found server story

        // For now, skip conflict detection with the new format
        // TODO: Implement conflict detection for the new hierarchical format
        const isSameStory = currentStoryStore.id === storyId
        if (!isSameStory) {
          await resetStoryState()
        }

        // Load the exported story data
        await loadServerStoryData(exportData, storyId)
        return true
      }
      console.log('[loadStoryById] Export succeeded but no story in response data:', exportData)
    } catch (error: any) {
      console.log('[loadStoryById] Export endpoint failed:', error)

      // Check if this is a server error (500) vs not found (404)
      const status = error?.response?.status || error?.status
      if (status && status >= 500) {
        // Server error - show error message but don't redirect
        const errorMessage = error?.response?.data?.error || error?.data?.error || 'Server error occurred'
        const errorDetails = error?.response?.data?.debug || error?.data?.debug

        console.error('[loadStoryById] Server error loading story:', {
          status,
          message: errorMessage,
          details: errorDetails,
        })

        // Set error state instead of "not found"
        // TODO: setStoryLoadError is defined in StoryPage, not accessible here
        // This code path should display the error differently
        console.error('[loadStoryById] Cannot set story load error - signal not in scope')
        return false
      }

      // 404 or other client errors - try local storage
      // Story not found on server, checking local storage
    }

    // If not on server, try local storage
    const story = await storyManager.loadStory(storyId)
    if (story) {
      // Found local story
      const isSameStory = currentStoryStore.id === story.id
      if (!isSameStory) {
        await resetStoryState()
      }
      // Update currentStoryStore
      currentStoryStore.loadStory(
        story.id,
        story.name,
        story.storageMode || 'local',
        story.person,
        story.tense,
        story.storySetting,
        story.storyFormat,
        story.paragraphsPerTurn,
        story.globalScript,
        story.timelineStartTime,
        story.timelineEndTime,
        story.timelineGranularity,
        story.provider,
        story.model,
      )

      // Sync provider and model from story to settingsStore
      settingsStore.syncFromStory(story.provider, story.model)

      // Initialize plot points for local stories (definitions only, no API states)
      // Local stories may have plotPointDefaults if they were synced from server
      plotPointsStore.setDefinitions((story as any).plotPointDefaults || [])
      plotPointsStore.setStates([]) // Local stories don't have API-stored states

      // Load the story data
      handleLoadStory(
        story.messages || [],
        story.characters,
        story.input,
        story.storySetting,
        story.contextItems,
        story.nodes || [],
        story.selectedNodeId,
      )
      // Set branch choices after data is loaded (now with loop detection)
      if (story.branchChoices) {
        currentStoryStore.setBranchChoices(story.branchChoices)
      }
      return true
    }

    return false // Story not found
  }

  // Run story migration on startup
  createEffect(() => {
    storyManager.migrateStories().catch((error) => {
      console.error('Failed to migrate stories:', error)
    })
  })

  // Auto-generation setup
  createEffect(() => {
    const handleAutoGenerate = async (event: Event) => {
      const customEvent = event as CustomEvent
      const instructions = customEvent.detail?.instructions || ''

      // Auto-generate event received
      messagesStore.setInput(instructions)

      await handleSubmit(false)
    }

    window.addEventListener('auto-generate-story', handleAutoGenerate as unknown as EventListener)

    onCleanup(() => {
      window.removeEventListener('auto-generate-story', handleAutoGenerate as unknown as EventListener)
    })
  })

  // Periodically check if Ollama is busy
  createEffect(() => {
    if (settingsStore.provider === 'ollama') {
      let checkInterval: NodeJS.Timeout
      const checkBusy = async () => {
        const isBusy = await checkIfOllamaIsBusy()
        setOllamaExternallyBusy(isBusy)
      }

      checkBusy()
      checkInterval = setInterval(checkBusy, 5000)

      onCleanup(() => {
        clearInterval(checkInterval)
      })
    } else {
      setOllamaExternallyBusy(false)
    }
  })

  const handleShowContextPreviewModal = async () => {
    console.log('[App] handleShowContextPreviewModal called')
    try {
      console.log('[App] Calling handleShowContextPreview...')
      const data = await handleShowContextPreview()
      console.log('[App] handleShowContextPreview returned:', data ? 'data received' : 'no data')

      if (data) {
        console.log('[App] Checking data size...')
        // Check if data is too large (over 2MB) - reduced from 10MB for safety
        const dataSize = JSON.stringify(data).length
        console.log('[App] Data size:', dataSize, 'bytes')

        if (dataSize > 2 * 1024 * 1024) {
          console.warn('[App] Data too large for safe display:', dataSize, 'bytes')
          // Instead of showing full data, show a summary
          const summary = {
            type: data.type,
            messages: [
              {
                role: 'system' as const,
                content: `Context preview too large to display safely.\n\nSummary:\n- Type: ${data.type}\n- Total messages: ${data.messages.length}\n- Total size: ${(dataSize / 1024 / 1024).toFixed(2)} MB\n\nThe context would include all ${data.messages.length} messages but is too large to display in the preview modal.`,
              },
            ],
          }
          setContextPreviewData(summary)
          setShowContextPreview(true)
          return
        }

        console.log('[App] Setting context preview data...')
        setContextPreviewData(data)
        console.log('[App] Setting show context preview to true...')
        setShowContextPreview(true)
        console.log('[App] Context preview modal should now be visible')
      } else {
        console.log('[App] No data returned from handleShowContextPreview')
      }
    } catch (error) {
      console.error('[App] Failed to show context preview:', error)
      console.error('[App] Error stack:', error instanceof Error ? error.stack : 'No stack')
      alert(`Failed to generate context preview: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
    console.log('[App] handleShowContextPreviewModal completed')
  }

  const handleBulkSummarize = async () => {
    if (!confirm('This will generate summaries for all messages. Continue?')) return

    const messages = messagesStore.messages.filter((m) => m.role === 'assistant' && !m.isQuery && !m.summary)
    globalOperationStore.startOperation('bulk-summarize', messages.length, 'Generating summaries...')

    try {
      for (let i = 0; i < messages.length; i++) {
        const message = messages[i]
        globalOperationStore.updateProgress(i + 1, `Summarizing message ${i + 1} of ${messages.length}`)
        await handleSummarizeMessage(message.id)
      }
    } finally {
      globalOperationStore.completeOperation()
    }
  }

  const handleBulkAnalysis = async () => {
    if (!confirm('This will analyze all story messages for scene context. Continue?')) return

    messagesStore.setIsAnalyzing(true)

    try {
      const storyMessages = messagesStore.messages.filter(
        (m) => m.role === 'assistant' && !m.isQuery && !m.sceneAnalysis,
      )

      for (const message of storyMessages) {
        await handleAnalyzeMessage(message.id)
      }
    } finally {
      messagesStore.setIsAnalyzing(false)
    }
  }

  const handleMigrateInstructions = () => {
    if (!confirm('This will update all messages to use the new instruction format. Continue?')) return
    // TODO: Implement migrateToInstructionFormat in messagesStore
    // migrateToInstructionFormat not implemented
  }

  const handleRemoveUserMessages = () => {
    if (!confirm('This will remove all user messages from the story. This action cannot be undone. Continue?')) return
    // TODO: Implement removeUserMessages in messagesStore
    // removeUserMessages not implemented
  }

  const handleCleanupThinkTags = () => {
    if (!confirm('This will remove all <think> tags from the story content. Continue?')) return
    messagesStore.cleanupThinkTags()
  }

  const handleRewriteMessages = (messageId?: string) => {
    rewriteDialogStore.show(messageId ? [messageId] : [])
  }

  const handleExportStory = () => {
    const storyMessages = messagesStore.messages.filter((m) => m.role === 'assistant' && !m.isQuery)
    const chapters = storyMessages.map((msg, index) => {
      const chapterHeader = `--- Chapter ${index + 1} ---\n\n`
      return chapterHeader + msg.content
    })

    const storyContent = chapters.join('\n\n\n')
    const blob = new Blob([storyContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'story-export.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportStory = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.txt,.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      const text = await file.text()
      await importStoryFromText(text)
    }
    input.click()
  }

  const importStoryFromText = async (importText: string) => {
    try {
      const importData = JSON.parse(importText)

      if (Array.isArray(importData.messages)) {
        messagesStore.clearMessages()

        importData.messages.forEach((msg: Message) => {
          const message: Message = {
            ...msg,
            timestamp: new Date(msg.timestamp),
            isSummarizing: false,
          }
          messagesStore.appendMessage(message)
        })

        if (importData.characters) {
          charactersStore.setCharacters(importData.characters)
        }

        if (importData.contextItems) {
          contextItemsStore.setContextItems(importData.contextItems)
        }

        if (importData.settings) {
          if (importData.settings.storySetting) {
            settingsStore.setStorySetting(importData.settings.storySetting)
          }
          if (importData.settings.provider) {
            settingsStore.setProvider(importData.settings.provider)
          }
          if (importData.settings.model) {
            settingsStore.setModel(importData.settings.model)
          }
        }

        if (importData.currentInput) {
          messagesStore.setInput(importData.currentInput)
        }

        // Story imported from JSON
        return
      }
    } catch (_jsonError) {
      // JSON import failed, trying text import
    }

    messagesStore.clearMessages()

    const chapters = importText
      .split(/--- Chapter \d+ ---|\n\n\n/)
      .map((chapter) => chapter.trim())
      .filter((chapter) => chapter.length > 0)

    const { generateMessageId } = await import('./utils/id')

    chapters.forEach((chapter, index) => {
      const message: Message = {
        id: generateMessageId(),
        role: 'assistant',
        content: chapter,
        instruction: index === 0 ? 'Begin the story' : 'Continue the story',
        timestamp: new Date(Date.now() + index * 1000),
        order: index, // Use index as order for imported messages
        isQuery: false,
      }
      messagesStore.appendMessage(message)
    })

    // Story imported from text
  }

  const handleImportClaudeChat = async (
    conversationName: string,
    messages: Message[],
    importTarget: 'new' | 'current',
    storageMode: 'local' | 'server',
  ) => {
    const { storyId } = await importClaudeChat({
      conversationName,
      messages,
      importTarget,
      storageMode,
    })

    // Navigate to the story if we created a new one
    if (importTarget === 'new') {
      window.location.href = `/story/${storyId}`
    }
  }

  const handleImportClaudeChatWithBranches = async (
    conversationName: string,
    branchData: BranchConversionResult,
    importTarget: 'new' | 'current',
    storageMode: 'local' | 'server',
  ) => {
    const { storyId } = await importClaudeChatWithBranches({
      conversationName,
      segments: branchData.segments,
      branchChoices: branchData.branchChoices,
      importTarget,
      storageMode,
    })

    // Navigate to the story if we created a new one
    if (importTarget === 'new') {
      window.location.href = `/story/${storyId}`
    }
  }

  const handleLoadStory = (
    messages: Message[],
    characters: Character[],
    input: string,
    storySetting: string,
    contextItems?: ContextItem[],
    nodes?: Node[],
    selectedNodeId?: string | null,
  ) => {
    console.log('[handleLoadStory] Called with:', {
      messageCount: messages?.length,
      characterCount: characters?.length,
      nodeCount: nodes?.length,
    })

    // Clear existing story state so new data doesn't mix with the previous story
    nodeStore.clear()
    messagesStore.setMessages([])
    charactersStore.setCharacters([])
    contextItemsStore.setContextItems([])

    // Ensure timestamps are Date objects and fix missing order fields
    let messagesWithDates = messages.map((msg, index) => ({
      ...msg,
      timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp),
      order: msg.order !== undefined && msg.order !== null ? msg.order : index,
    }))

    // Load nodes and select the appropriate one
    if (nodes && nodes.length > 0) {
      nodeStore.setNodes(nodes)

      // Select the saved node or auto-select first scene if none selected
      if (selectedNodeId) {
        nodeStore.selectNode(selectedNodeId)
      } else {
        const sceneNodes = nodes.filter((n) => n.type === 'scene')
        if (sceneNodes.length > 0 && !nodeStore.selectedNodeId) {
          nodeStore.selectNode(sceneNodes[0].id)
        }
      }
    } else {
      // Create default structure for stories without nodes
      const bookNode = nodeStore.addNode(null, 'book', 'Book 1')
      const arcNode = nodeStore.addNode(bookNode.id, 'arc', 'Arc 1')
      const chapterNode = nodeStore.addNode(arcNode.id, 'chapter', 'Chapter 1')
      const sceneNode = nodeStore.addNode(chapterNode.id, 'scene', 'Scene 1')

      // Auto-select the first scene
      nodeStore.selectNode(sceneNode.id)

      // If we have messages, assign them all to the default scene
      if (messagesWithDates.length > 0) {
        messagesWithDates = messagesWithDates.map((msg) => ({
          ...msg,
          sceneId: sceneNode.id,
        }))
      }
    }

    // Set messages and other data
    messagesStore.setMessages(messagesWithDates)
    charactersStore.setCharacters(characters)
    messagesStore.setInput(input)
    settingsStore.setStorySetting(storySetting)

    // Load context items if provided
    if (contextItems) {
      contextItemsStore.setContextItems(contextItems)
    }
  }

  return (
    <>
      {/* Auth loading indicator */}
      <Show when={authStore.isLoading}>
        <div class={styles.authLoadingOverlay}>
          <div class={styles.authLoadingContent}>
            <Spinner size="lg" />
            <div class={styles.loadingText}>Checking authentication...</div>
          </div>
        </div>
      </Show>

      <Route
        path="/login"
        component={() => {
          const navigate = useNavigate()

          return (
            <LoginForm
              onSuccess={(user) => {
                console.log('[App] Login onSuccess called with user:', user)
                if ('offline' in user && user.offline) {
                  console.log('[App] Setting offline mode')
                  authStore.setOfflineMode()
                } else {
                  console.log('[App] Setting user in authStore')
                  authStore.setUser(user)
                }
                console.log('[App] Navigating to /stories')
                navigate('/stories', { replace: true })
              }}
            />
          )
        }}
      />

      <Route
        path="/reset-password"
        component={() => {
          const navigate = useNavigate()
          return (
            <ResetPassword
              onClose={() => navigate('/login')}
              onSuccess={() => {
                // Navigate to login
                navigate('/login', { replace: true })
              }}
            />
          )
        }}
      />

      {/* Root route - story selection (same as /stories) */}
      <Route
        path="/"
        component={() => {
          const navigate = useNavigate()
          return (
            <Show when={!authStore.isLoading} fallback={<div class={styles.app}>Loading...</div>}>
              <Show when={authStore.isAuthenticated} fallback={<RedirectToLogin />}>
                <StoryLandingPage
                  onSelectStory={(storyId: string) => {
                    navigate(`/story/${storyId}`)
                  }}
                />
              </Show>
            </Show>
          )
        }}
      />

      {/* Story selection route (legacy, same as root) */}
      <Route
        path="/stories"
        component={() => {
          const navigate = useNavigate()
          return (
            <Show when={!authStore.isLoading} fallback={<div class={styles.app}>Loading...</div>}>
              <Show when={authStore.isAuthenticated} fallback={<RedirectToLogin />}>
                <StoryLandingPage
                  onSelectStory={(storyId: string) => {
                    // Navigate to the story route
                    navigate(`/story/${storyId}`)
                  }}
                />
              </Show>
            </Show>
          )
        }}
      />

      {/* Story route - loads and displays a specific story */}
      <Route
        path="/story/:id"
        component={() => {
          const params = useParams()
          const navigate = useNavigate()
          const [loadingStory, setLoadingStory] = createSignal(true)
          const [storyNotFound, setStoryNotFound] = createSignal(false)
          const [storyLoadError, setStoryLoadError] = createSignal<{
            message: string
            details?: any
            status: number
          } | null>(null)

          createEffect(() => {
            const storyId = params.id
            if (!storyId) return

            let disposed = false
            onCleanup(() => {
              disposed = true
            })

            // Use untrack to check if already loaded without creating dependencies
            const alreadyLoaded = untrack(() => currentStoryStore.isInitialized && currentStoryStore.id === storyId)

            if (alreadyLoaded) {
              setLoadingStory(false)
              return // Don't load again if already loaded
            }

            setLoadingStory(true)
            setStoryNotFound(false)
            setStoryLoadError(null)

            void loadStoryById(storyId)
              .then((loaded) => {
                if (disposed) return
                if (!loaded) {
                  // Only set "not found" if we don't already have a server error
                  if (!storyLoadError()) {
                    setStoryNotFound(true)
                    setTimeout(() => navigate('/stories'), 2000)
                  }
                }
              })
              .finally(() => {
                if (!disposed) {
                  setLoadingStory(false)
                }
              })
          })

          return (
            <Show
              when={!authStore.isLoading}
              fallback={
                <div class={styles.loadingContainer}>
                  <Spinner size="lg" />
                  <div class={styles.loadingText}>Loading...</div>
                </div>
              }
            >
              <Show when={authStore.isAuthenticated} fallback={<RedirectToLogin />}>
                <Show
                  when={!loadingStory()}
                  fallback={
                    <div class={styles.loadingContainer}>
                      <Spinner size="lg" />
                      <div class={styles.loadingText}>Loading story...</div>
                    </div>
                  }
                >
                  <Show
                    when={!storyLoadError() && !storyNotFound()}
                    fallback={
                      <div class={styles.loadingContainer}>
                        <Show when={storyLoadError()}>
                          {(error) => (
                            <div class={styles.errorContainer}>
                              <div class={styles.errorTitle}>Server Error ({error().status})</div>
                              <div class={styles.errorText}>{error().message}</div>
                              <Show when={error().details}>
                                <details class={styles.errorDetails}>
                                  <summary>Technical Details</summary>
                                  <pre>{JSON.stringify(error().details, null, 2)}</pre>
                                </details>
                              </Show>
                              <button class={styles.retryButton} onClick={() => window.location.reload()}>
                                Retry
                              </button>
                            </div>
                          )}
                        </Show>
                        <Show when={storyNotFound()}>
                          <div class={styles.errorText}>Story not found. Redirecting to stories page...</div>
                        </Show>
                      </div>
                    }
                  >
                    <Show
                      when={storyLoaded()}
                      fallback={
                        <div class={styles.loadingContainer}>
                          <Spinner size="lg" />
                          <div class={styles.loadingText}>Preparing story...</div>
                        </div>
                      }
                    >
                      <div class={styles.app}>
                        <GlobalStatusIndicator />

                        <StoryHeader
                          onLoadStory={handleLoadStory}
                          onBulkSummarize={handleBulkSummarize}
                          onBulkAnalysis={handleBulkAnalysis}
                          onMigrateInstructions={handleMigrateInstructions}
                          onRemoveUserMessages={handleRemoveUserMessages}
                          onCleanupThinkTags={handleCleanupThinkTags}
                          onRewriteMessages={handleRewriteMessages}
                          onExportStory={handleExportStory}
                          onImportStory={handleImportStory}
                          onImportClaudeChat={handleImportClaudeChat}
                          onImportClaudeChatWithBranches={handleImportClaudeChatWithBranches}
                          serverAvailable={serverStore.isAvailable}
                          isGenerating={isGenerating() || ollamaExternallyBusy()}
                          contextSize={effectiveContextSize()}
                          charsPerToken={settingsStore.charsPerToken}
                        />

                        <div class={styles.mainContent}>
                          {/* Desktop: Fixed inline sidebar - visible when header is visible */}
                          <Show when={!isMobile() && !headerStore.isCollapsed()}>
                            <div class={styles.desktopNavigation}>
                              <StoryNavigation />
                            </div>
                          </Show>

                          <main class={styles.chatContainer}>
                            <Show
                              when={(() => {
                                const selectedNode = nodeStore.getSelectedNode()
                                return selectedNode?.type === 'scene'
                              })()}
                              fallback={<div class={styles.noSceneMessage}>Select a scene to edit content</div>}
                            >
                              <MessageList
                                isLoading={messagesStore.isLoading}
                                hasStoryMessages={messagesStore.hasStoryMessages}
                                isGenerating={isGenerating() || ollamaExternallyBusy()}
                                model={settingsStore.model}
                                provider={settingsStore.provider as 'ollama' | 'openrouter' | 'anthropic'}
                              />
                            </Show>

                            <StoryInput
                              isLoading={messagesStore.isLoading}
                              isAnalyzing={messagesStore.isAnalyzing}
                              isGenerating={isGenerating() || ollamaExternallyBusy()}
                              onSubmit={handleSubmit}
                              onAutoOrManualSubmit={handleAutoOrManualSubmit}
                              onRegenerate={regenerateLastMessage}
                              onAbort={abortGeneration}
                              onShowContextPreview={handleShowContextPreviewModal}
                            />
                          </main>

                          {/* Right sidebar: Docked Episode Viewer on wide screens */}
                          <Show when={episodeViewerStore.isDocked && episodeViewerStore.isOpen}>
                            <div class={styles.desktopEpisodeViewer}>
                              <EpisodeViewer isOpen={true} onClose={() => episodeViewerStore.hide()} mode="docked" />
                            </div>
                          </Show>
                        </div>

                        <ContextPreviewModal
                          show={showContextPreview()}
                          data={contextPreviewData()}
                          onClose={() => {
                            console.log('[App] Closing context preview modal')
                            setShowContextPreview(false)
                            setContextPreviewData(null) // Clear data when closing
                          }}
                        />

                        <PendingEntitiesModal />

                        <MessageRewriterDialog />

                        <SingleRewriteDialog />

                        <MassRewriteDialog />

                        <CopyTokenModal />

                        <SearchModal />

                        <StorageFullModal
                          isOpen={messagesStore.showStorageFullModal}
                          onClose={() => messagesStore.setShowStorageFullModal(false)}
                        />

                        <ConflictResolutionDialog
                          isOpen={messagesStore.showConflictDialog}
                          serverUpdatedAt={messagesStore.conflictInfo?.serverUpdatedAt || ''}
                          clientUpdatedAt={messagesStore.conflictInfo?.clientUpdatedAt || ''}
                          onForce={() => messagesStore.forceSave()}
                          onCancel={() => messagesStore.setShowConflictDialog(false)}
                        />

                        <Show when={serverDataConflict()}>
                          <div class={styles.modalOverlay} onClick={(e) => e.stopPropagation()}>
                            <div class={styles.modalContent}>
                              <div class={styles.modalHeader}>
                                <h3>Local Changes Detected</h3>
                              </div>
                              <div class={styles.modalBody}>
                                <p style={{ 'margin-bottom': '1rem' }}>
                                  You have local messages that don't exist on the server. Loading the server version
                                  will lose these changes.
                                </p>
                                <p style={{ 'margin-bottom': '1rem' }}>
                                  <strong>Server story:</strong> {serverDataConflict()!.serverStory.messages.length}{' '}
                                  messages
                                  <br />
                                  <strong>Local story:</strong> {serverDataConflict()!.localMessages.length} messages
                                </p>
                                <p style={{ 'margin-bottom': '1.5rem' }}>
                                  Do you want to load the server version and lose your local changes?
                                </p>
                                <div class={styles.modalButtons}>
                                  <button
                                    class={styles.secondaryButton}
                                    onClick={() => {
                                      // Keep local version
                                      setServerDataConflict(null)
                                      // Go back to stories page
                                      navigate('/stories')
                                    }}
                                  >
                                    Keep Local Version
                                  </button>
                                  <button
                                    class={styles.primaryButton}
                                    onClick={async () => {
                                      const conflict = serverDataConflict()
                                      if (conflict) {
                                        await loadServerStoryData(conflict.serverStory, conflict.serverStory.id)
                                        setServerDataConflict(null)
                                      }
                                    }}
                                  >
                                    Load Server Version
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </Show>

                        <ErrorNotifications />
                        <ServerStatusIndicator />

                        {/* StoryManager modal */}
                        <StoryManager />
                      </div>
                    </Show>
                  </Show>
                </Show>
              </Show>
            </Show>
          )
        }}
      />

      {/* Legacy app route - redirects to stories */}
      <Route
        path="/app"
        component={() => {
          const navigate = useNavigate()
          onMount(() => {
            navigate('/stories', { replace: true })
          })
          return <div class={styles.app}>Redirecting to stories...</div>
        }}
      />
    </>
  )
}

export default App
