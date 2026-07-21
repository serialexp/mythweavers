import { Route, useNavigate, useParams } from '@solidjs/router'
import { Component, Show, createEffect, createMemo, createSignal, onCleanup, onMount, untrack } from 'solid-js'
import './styles/variables.css'
import './App.css'
import * as styles from './App.css.ts'
import { Spinner } from '@mythweavers/ui'
import { ConflictResolutionDialog } from './components/ConflictResolutionDialog'
import { ContextPreviewModal } from './components/ContextPreviewModal'
import { CopyTokenModal } from './components/CopyTokenModal'
import { ErrorNotifications } from './components/ErrorNotifications'
import { GlobalStatusIndicator } from './components/GlobalStatusIndicator'
import { LoginForm } from './components/LoginForm'
// SceneEditorWrapper import removed - component used via lazy loading or routes
import { MessageList } from './components/MessageList'
import { MessageRewriterDialog } from './components/MessageRewriterDialog'
import { MassRewriteDialog } from './components/MassRewriteDialog'
import { SingleRewriteDialog } from './components/SingleRewriteDialog'
import { PendingEntitiesModal } from './components/PendingEntitiesModal'
import { SearchModal } from './components/SearchModal'
import { ServerStatusIndicator } from './components/ServerStatusIndicator'
import { StorageFullModal } from './components/StorageFullModal'
import { StoryHeader } from './components/StoryHeader'
import { StoryInput } from './components/StoryInput'
import { StoryLandingPage } from './components/StoryLandingPage'
import { StoryManager } from './components/StoryManager'
import { StoryNavigation } from './components/StoryNavigation'
import { SnowflakeView } from './components/snowflake/SnowflakeView'
import { useCacheManagement } from './hooks/useCacheManagement'
import { useOllama } from './hooks/useOllama'
import { useStoryGeneration } from './hooks/useStoryGeneration'
import { authStore } from './stores/authStore'
import { calendarStore } from './stores/calendarStore'
import { languageStore } from './stores/languageStore'
import { charactersStore } from './stores/charactersStore'
import { contextItemsStore } from './stores/contextItemsStore'
import { currentStoryStore } from './stores/currentStoryStore'
import { headerStore } from './stores/headerStore'
import { mapsStore } from './stores/mapsStore'
import { messagesStore } from './stores/messagesStore'
import { plotPointsStore } from './stores/plotPointsStore'
import { modelsStore } from './stores/modelsStore'
import { nodeStore } from './stores/nodeStore'
import { rewriteDialogStore } from './stores/rewriteDialogStore'
import { serverStore } from './stores/serverStore'
import { settingsStore } from './stores/settingsStore'
import { effectiveSettings } from './stores/effectiveSettingsStore'
import { ApiStory } from './types/api'
import { Character, ContextItem, Message, Node } from './types/core'
import type { BranchConversionResult } from './utils/claudeChatImport'
import { importClaudeChat, importClaudeChatWithBranches } from './utils/claudeChatImporter'
import { PasswordForEncryptionDialog } from './components/PasswordForEncryptionDialog'
import { AdventurePage } from './pages/AdventurePage'
import UsagePage from './pages/UsagePage'
import DeviceAuthorizationPage from './pages/DeviceAuthorizationPage'
import { saveService } from './services/saveService'
import { storyManager } from './utils/storyManager'

type StoryLoadResult =
  | { type: 'loaded' }
  | { type: 'not-found' }
  | { type: 'error'; message: string; details?: unknown; status?: number }

function getStoryLoadError(error: unknown, status?: number): Omit<Extract<StoryLoadResult, { type: 'error' }>, 'type'> {
  const errorData = error && typeof error === 'object' ? (error as Record<string, unknown>) : undefined
  const message =
    typeof errorData?.error === 'string'
      ? errorData.error
      : error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : status
            ? `Request failed with status ${status}`
            : 'Unable to reach the server'

  return {
    message,
    details: errorData?.debug,
    status,
  }
}

// Component to redirect to login
const RedirectToLogin: Component = () => {
  const navigate = useNavigate()
  onMount(() => {
    navigate('/login', { replace: true })
  })
  return <div class={styles.app}>Redirecting...</div>
}

const App: Component = () => {
  const { generateResponse, abortGeneration, isGenerating, checkIfOllamaIsBusy } = useOllama()

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
    handleShowContextPreview,
  } = useStoryGeneration({
    generateResponse,
  })

  // Initialize cache management
  useCacheManagement()

  // Update window title with active story and selected node
  createEffect(() => {
    const storyName = currentStoryStore.name
    const selectedNode = nodeStore.getSelectedNode()
    if (!storyName) {
      document.title = 'MythWeavers'
    } else if (selectedNode) {
      document.title = `${selectedNode.title} — ${storyName} — MythWeavers`
    } else {
      document.title = `${storyName} — MythWeavers`
    }
  })

  // Effective context size based on model and provider
  const effectiveContextSize = createMemo(() => {
    const selectedModel = modelsStore.availableModels.find((m) => m.name === effectiveSettings.model)

    // For Anthropic and OpenRouter, always use the model's full context length
    if (effectiveSettings.provider === 'anthropic' || effectiveSettings.provider === 'openrouter') {
      if (selectedModel?.context_length) {
        return selectedModel.context_length
      }
    }

    // For Ollama, use the minimum of user setting and model's context length
    if (selectedModel?.context_length) {
      return Math.min(effectiveSettings.contextSize, selectedModel.context_length)
    }
    return effectiveSettings.contextSize
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

    const flushPendingSaves = () => {
      void saveService.flushPendingSaves()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushPendingSaves()
    }

    window.addEventListener('focus', handleFocus)
    window.addEventListener('resize', handleResize)
    window.addEventListener('pagehide', flushPendingSaves)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    onCleanup(() => {
      cleanup()
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('pagehide', flushPendingSaves)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    })
  })

  // Fetch models on initialization and when provider changes
  // Only fetch if server is available
  createEffect(() => {
    // Access provider to make this effect reactive to provider changes
    effectiveSettings.provider

    // Only fetch models if server is available or if using a non-server provider
    if (serverStore.isAvailable || effectiveSettings.provider !== 'ollama') {
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

      // Load publishing state (publishedAt + rollup of chapter release dates).
      // Backend returns ISO strings or nulls; forward straight through.
      currentStoryStore.loadPublishing({
        publishedAt: story.publishedAt ?? null,
        firstChapterReleasedAt: story.firstChapterReleasedAt ?? null,
        lastChapterReleasedAt: story.lastChapterReleasedAt ?? null,
      })

      // Load editable metadata (summary + cover art + default background)
      // from the server payload.
      currentStoryStore.loadDetails({
        summary: story.summary ?? null,
        coverArtFileId: story.coverArtFileId ?? null,
        coverArtUrl: (story as { coverArtUrl?: string | null }).coverArtUrl ?? null,
        defaultBackgroundFileId: story.defaultBackgroundFileId ?? null,
        defaultBackgroundUrl:
          (story as { defaultBackgroundUrl?: string | null }).defaultBackgroundUrl ?? null,
      })

      // Load story-level AI overrides (provider/model from story become overrides)
      console.log('[loadServerStoryData] Loading AI overrides...')
      const aiOverrides = story.aiOverrides ?? null
      // Migrate legacy: if story has provider/model but no aiOverrides, treat them as overrides
      if (!aiOverrides && (story.provider && story.provider !== 'ollama' || story.model)) {
        currentStoryStore.loadAIOverrides({
          provider: story.provider !== 'ollama' ? story.provider : null,
          model: story.model || null,
        })
      } else {
        currentStoryStore.loadAIOverrides(aiOverrides as any)
      }

      // Load calendars
      if (calendars && calendars.length > 0) {
        calendarStore.loadFromExport(calendars)
      } else {
        calendarStore.clear()
      }

      // Load languages
      const { languages } = exportData
      if (languages && languages.length > 0) {
        languageStore.loadFromExport(languages)
      } else {
        languageStore.clear()
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
          sentenceSummary: book.sentenceSummary,
          paragraphSummary: book.paragraphSummary,
          summary: book.summary,
          order: book.sortOrder ?? bookIndex,
          coverArtFileId: book.coverArtFileId ?? null,
          coverArtUrl: book.coverArtUrl ?? null,
          defaultBackgroundFileId: book.defaultBackgroundFileId ?? null,
          defaultBackgroundUrl: book.defaultBackgroundUrl ?? null,
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
            sentenceSummary: arc.sentenceSummary,
            paragraphSummary: arc.paragraphSummary,
            summary: arc.summary,
            order: arc.sortOrder ?? arcIndex,
            defaultBackgroundFileId: arc.defaultBackgroundFileId ?? null,
            defaultBackgroundUrl: arc.defaultBackgroundUrl ?? null,
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
              sentenceSummary: chapter.sentenceSummary,
              paragraphSummary: chapter.paragraphSummary,
              summary: chapter.summary,
              order: chapter.sortOrder ?? chapterIndex,
              nodeType: chapter.nodeType || 'story',
              status: chapter.status,
              // publishedAt drives the Draft/Scheduled/Live indicator in the
              // chapter tree and publishing modal. Fall back to the legacy
              // publishedOn field for older exports that pre-date the rename.
              publishedAt: chapter.publishedAt ?? chapter.publishedOn ?? null,
              defaultBackgroundFileId: chapter.defaultBackgroundFileId ?? null,
              defaultBackgroundUrl: chapter.defaultBackgroundUrl ?? null,
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
                sentenceSummary: scene.sentenceSummary,
                paragraphSummary: scene.paragraphSummary,
                summary: scene.summary,
                summarySegments: scene.summarySegments,
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
                defaultBackgroundFileId: scene.defaultBackgroundFileId ?? null,
                defaultBackgroundUrl: scene.defaultBackgroundUrl ?? null,
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
                    isQuery: message.isQuery ?? false,
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

  /**
   * During route cleanup we normally clear the loaded story so navigating
   * away (e.g. back to the story list) does not leave stale data in the
   * global stores. The exception is flipping between the editor
   * (`/story/:id`) and the outline view (`/story/:id/snowflake`): these are
   * sibling routes over the *same* node tree, so the data is already in the
   * stores and clearing it would only force an unnecessary full re-fetch.
   * Returns true when the in-progress navigation truly leaves the current
   * story and the stores should be cleared.
   */
  const shouldResetStoryOnLeave = (storyId: string): boolean => {
    if (!storyId) return true
    const dest = window.location.pathname
    const prefix = `/story/${storyId}`
    // Exact editor route, or any sub-route (`/story/:id/snowflake`, …).
    return dest !== prefix && !dest.startsWith(`${prefix}/`)
  }

  // Load story by ID (used by story route)
  const loadStoryById = async (storyId: string): Promise<StoryLoadResult> => {
    // Loading story by ID

    // Check if this is an old ID format (timestamp-based)
    // Matches patterns like: 1754232850821-w2kv7u3vl or 1754232438376-pm7i6zrj2
    if (/^\d{13}-\w+$/.test(storyId)) {
      // Detected old story ID format
      return { type: 'not-found' }
    }

    // Try server first (server stories take priority)
    try {
      const { getMyStoriesByIdLoadStory } = await import('./client/config')
      const result = await getMyStoriesByIdLoadStory({ path: { id: storyId } })
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
        return { type: 'loaded' }
      }

      if (result.error) {
        const status = result.response?.status
        if (status !== 404) {
          const loadError = getStoryLoadError(result.error, status)
          console.error('[loadStoryById] Error loading story:', { status, ...loadError })
          return { type: 'error', ...loadError }
        }
      } else {
        const status = result.response?.status
        const loadError = getStoryLoadError('The server returned an invalid story response', status)
        console.error('[loadStoryById] Export succeeded but no story in response data:', exportData)
        return { type: 'error', ...loadError }
      }

      console.log('[loadStoryById] Story was not found on the server; checking local storage')
    } catch (error: any) {
      console.log('[loadStoryById] Export endpoint failed:', error)
      const status = error?.response?.status || error?.status
      if (status !== 404) {
        const errorData = error?.response?.data || error?.data || error
        const loadError = getStoryLoadError(errorData, status)
        console.error('[loadStoryById] Error loading story:', { status, ...loadError })
        return { type: 'error', ...loadError }
      }
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

      // Load story-level AI overrides
      const localAiOverrides = (story as any).aiOverrides ?? null
      // Migrate legacy: if story has provider/model but no aiOverrides, treat them as overrides
      if (!localAiOverrides && (story.provider && story.provider !== 'ollama' || story.model)) {
        currentStoryStore.loadAIOverrides({
          provider: story.provider !== 'ollama' ? story.provider : null,
          model: story.model || null,
        })
      } else {
        currentStoryStore.loadAIOverrides(localAiOverrides)
      }

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
      return { type: 'loaded' }
    }

    return { type: 'not-found' }
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
    if (effectiveSettings.provider === 'ollama') {
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
      {/* Decrypt API keys dialog — shown when backend has encrypted secrets but this device doesn't have them */}
      <Show when={authStore.isAuthenticated && !authStore.isOfflineMode && settingsStore.needsDecryption()}>
        <PasswordForEncryptionDialog
          mode="decrypt"
          onClose={() => settingsStore.dismissDecryption()}
        />
      </Show>

      {/* Auth loading indicator */}
      <Show when={authStore.isLoading}>
        <div class={styles.authLoadingOverlay}>
          <div class={styles.authLoadingContent}>
            <Spinner size="lg" />
            <div class={styles.loadingText}>Checking authentication...</div>
          </div>
        </div>
      </Show>

      <Route path="/device" component={DeviceAuthorizationPage} />
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

      {/* Root route - redirects to /stories/list */}
      <Route
        path="/"
        component={() => {
          const navigate = useNavigate()
          onMount(() => navigate('/stories/list', { replace: true }))
          return <div class={styles.app}>Loading...</div>
        }}
      />

      {/* Story selection routes with tab segments */}
      <Route
        path={["/stories/list", "/stories/new", "/stories"]}
        component={() => {
          const navigate = useNavigate()
          return (
            <Show when={!authStore.isLoading} fallback={<div class={styles.app}>Loading...</div>}>
              <Show when={authStore.isAuthenticated} fallback={<RedirectToLogin />}>
                <StoryLandingPage
                  initialTab="load"
                  onSelectStory={(storyId: string) => {
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
          // Start in the "loaded" state when the story is already in the
          // stores (e.g. flipping back from the outline view) so the view
          // swaps instantly with no loading flash or re-fetch.
          const [loadingStory, setLoadingStory] = createSignal(
            !untrack(() => currentStoryStore.isInitialized && currentStoryStore.id === params.id),
          )
          const [storyNotFound, setStoryNotFound] = createSignal(false)
          const [storyLoadError, setStoryLoadError] = createSignal<{
            message: string
            details?: unknown
            status?: number
          } | null>(null)

          // Clear the active story (and related stores) when leaving the
          // /story/:id route. Without this, navigating "back to story list"
          // leaves currentStoryStore populated, so the Settings dialog and
          // other store-driven components keep showing stale data from the
          // story we just left. SolidJS Router reuses the same component
          // when navigating between two /story/:id routes (only the params
          // signal changes), so this onCleanup only fires on a true unmount
          // — switching between two stories is still handled by
          // loadStoryById -> resetStoryState.
          //
          // Exception: flipping between the editor and the outline view
          // (`/story/:id` <-> `/story/:id/snowflake`) also unmounts this
          // route, but the two views share the same loaded story. Skip the
          // reset in that case so we don't discard the data and trigger a
          // full server re-fetch.
          onCleanup(() => {
            if (shouldResetStoryOnLeave(currentStoryStore.id)) {
              void resetStoryState()
            }
          })

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
              .then((result) => {
                if (disposed) return
                if (result.type === 'error') {
                  setStoryLoadError(result)
                } else if (result.type === 'not-found') {
                  setStoryNotFound(true)
                  setTimeout(() => navigate('/stories'), 2000)
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
                              <div class={styles.errorTitle}>
                                Unable to Load Story{error().status ? ` (${error().status})` : ''}
                              </div>
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
                          onMigrateInstructions={handleMigrateInstructions}
                          onRemoveUserMessages={handleRemoveUserMessages}
                          onCleanupThinkTags={handleCleanupThinkTags}
                          onRewriteMessages={handleRewriteMessages}
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
                                model={effectiveSettings.model}
                                provider={effectiveSettings.provider as 'ollama' | 'openrouter' | 'anthropic'}
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
                                      navigate('/stories/list')
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

      {/* Snowflake outline - top-down story planning over the same node tree */}
      <Route
        path="/story/:id/snowflake"
        component={() => {
          const params = useParams()
          const navigate = useNavigate()
          // Skip the loading state when the story is already loaded (e.g.
          // flipping over from the editor) — same data, just a view swap.
          const [loadingStory, setLoadingStory] = createSignal(
            !untrack(() => currentStoryStore.isInitialized && currentStoryStore.id === params.id),
          )
          const [storyNotFound, setStoryNotFound] = createSignal(false)
          const [storyLoadError, setStoryLoadError] = createSignal<{
            message: string
            details?: unknown
            status?: number
          } | null>(null)

          // Mirror the /story/:id route: reset on true unmount, load on entry
          // (skipping if the story is already in the stores). The reset is
          // skipped when flipping to the sibling editor route so the loaded
          // story survives the view switch (see shouldResetStoryOnLeave).
          onCleanup(() => {
            if (shouldResetStoryOnLeave(currentStoryStore.id)) {
              void resetStoryState()
            }
          })

          createEffect(() => {
            const storyId = params.id
            if (!storyId) return

            let disposed = false
            onCleanup(() => {
              disposed = true
            })

            const alreadyLoaded = untrack(() => currentStoryStore.isInitialized && currentStoryStore.id === storyId)
            if (alreadyLoaded) {
              setLoadingStory(false)
              return
            }

            setLoadingStory(true)
            setStoryNotFound(false)
            setStoryLoadError(null)

            void loadStoryById(storyId)
              .then((result) => {
                if (disposed) return
                if (result.type === 'error') {
                  setStoryLoadError(result)
                } else if (result.type === 'not-found') {
                  setStoryNotFound(true)
                  setTimeout(() => navigate('/stories'), 2000)
                }
              })
              .finally(() => {
                if (!disposed) setLoadingStory(false)
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
                              <div class={styles.errorTitle}>
                                Unable to Load Story{error().status ? ` (${error().status})` : ''}
                              </div>
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
                          onMigrateInstructions={handleMigrateInstructions}
                          onRemoveUserMessages={handleRemoveUserMessages}
                          onCleanupThinkTags={handleCleanupThinkTags}
                          onRewriteMessages={handleRewriteMessages}
                          onImportClaudeChat={handleImportClaudeChat}
                          onImportClaudeChatWithBranches={handleImportClaudeChatWithBranches}
                          serverAvailable={serverStore.isAvailable}
                          isGenerating={isGenerating() || ollamaExternallyBusy()}
                          contextSize={effectiveContextSize()}
                          charsPerToken={settingsStore.charsPerToken}
                        />

                        <div class={styles.mainContent}>
                          <SnowflakeView onBack={() => navigate(`/story/${params.id}`)} />
                        </div>

                        <ErrorNotifications />
                        <ServerStatusIndicator />
                      </div>
                    </Show>
                  </Show>
                </Show>
              </Show>
            </Show>
          )
        }}
      />

      {/* Usage history - balance ledger and LLM generation costs */}
      <Route path="/usage" component={() => <UsagePage />} />

      {/* World Pulse Adventure - standalone CYOA with world trajectory */}
      <Route path="/adventure/:id" component={() => <AdventurePage />} />
      <Route
        path="/adventure"
        component={() => {
          const navigate = useNavigate()
          onMount(() => {
            if (authStore.isOfflineMode) {
              navigate('/adventure/local', { replace: true })
            } else {
              navigate('/adventure/new', { replace: true })
            }
          })
          return <div class={styles.app}>Loading...</div>
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
