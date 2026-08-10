import {
  Button,
  Card,
  CardBody,
  Dropdown,
  DropdownItem,
  IconButton,
  Modal,
  NavBar,
  NavBarActions,
  NavBarBrand,
  Spinner,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Text,
  useTheme,
} from '@mythweavers/ui'
import { useNavigate } from '@solidjs/router'
import { Component, Show, createMemo, createSignal, onMount } from 'solid-js'
import { PhGearIcon, PhUserCircleIcon } from 'solidjs-phosphor'
import {
  getApiBaseUrl,
  getCalendarsPresets,
  getMyAdventures,
  postMyStories,
  postMyStoriesByStoryIdCalendars,
} from '../client/config'
import { authStore } from '../stores/authStore'
import { charactersStore } from '../stores/charactersStore'
import { contextItemsStore } from '../stores/contextItemsStore'
import { currentStoryStore } from '../stores/currentStoryStore'
import { mapsStore } from '../stores/mapsStore'
import { messagesStore } from '../stores/messagesStore'
import { nodeStore } from '../stores/nodeStore'
import type { ApiStoryMetadata } from '../types/api'
import type { Message } from '../types/core'
import type { BranchConversionResult } from '../utils/claudeChatImport'
import { importClaudeChat, importClaudeChatWithBranches } from '../utils/claudeChatImporter'
import { createServerStoryFromSnapshot } from '../utils/serverStoryClone'
import { generateStoryFingerprint } from '../utils/storyFingerprint'
import { StoryMetadata, storyManager } from '../utils/storyManager'
import { AISettingsPanel } from './AISettingsPanel'
import { AdventureList } from './AdventureList'
import { ClaudeChatImportModal } from './ClaudeChatImportModal'
import { NewStoryForm } from './NewStoryForm'
import * as styles from './StoryLandingPage.css'
import { StoryList, StoryListItem } from './StoryList'

interface StoryLandingPageProps {
  onSelectStory: (storyId: string) => void
  initialTab?: 'load' | 'adventures'
}

export const StoryLandingPage: Component<StoryLandingPageProps> = (props) => {
  const navigate = useNavigate()
  const [localStories, setLocalStories] = createSignal<StoryMetadata[]>([])
  const [serverStories, setServerStories] = createSignal<ApiStoryMetadata[]>([])
  const [serverAvailable, setServerAvailable] = createSignal(false)
  const [loading, setLoading] = createSignal(true)
  const [syncing, setSyncing] = createSignal<string | null>(null)
  const [activeTab, setActiveTab] = createSignal<'load' | 'adventures'>(
    props.initialTab === 'adventures' ? 'adventures' : 'load',
  )
  const [localFingerprints, setLocalFingerprints] = createSignal<Map<string, string>>(new Map())
  const [showClaudeChatImport, setShowClaudeChatImport] = createSignal(false)
  const [showNewStory, setShowNewStory] = createSignal(false)
  const [showAISettings, setShowAISettings] = createSignal(false)
  const [importingMythWeavers, setImportingMythWeavers] = createSignal(false)
  const [adventureCount, setAdventureCount] = createSignal<number | null>(null)
  const [serverPage, setServerPage] = createSignal(1)
  const [serverTotalPages, setServerTotalPages] = createSignal(1)
  const [loadingMore, setLoadingMore] = createSignal(false)

  const hasMoreServerStories = () => serverAvailable() && serverPage() < serverTotalPages()

  // Combined stories list
  const combinedStories = createMemo((): StoryListItem[] => {
    const serverStoryIds = new Set(serverStories().map((s) => s.id))
    const fingerprints = localFingerprints()

    // Process local stories, filtering out duplicates
    const localStoriesProcessed: StoryListItem[] = localStories()
      .filter((story) => !serverStoryIds.has(story.id))
      .map((story) => ({
        id: story.id,
        name: story.name,
        savedAt: story.savedAt,
        updatedAt: undefined,
        messageCount: story.messageCount,
        characterCount: story.characterCount,
        storySetting: story.storySetting,
        type: (story.storageMode || 'local') as 'local' | 'server',
        isCurrentStory: false, // No current story on landing page
      }))

    // Process server stories with fingerprint comparison
    const serverStoriesProcessed: StoryListItem[] = serverStories().map((story) => {
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
        storySetting: story.storySetting,
        type: 'server' as const,
        isCurrentStory: false,
        fingerprint: story.fingerprint,
        localFingerprint,
        hasLocalDifferences,
        coverArtUrl: story.coverArtUrl ?? null,
      }
    })

    // Combine and sort by date (newest first)
    return [...localStoriesProcessed, ...serverStoriesProcessed].sort(
      (a, b) => b.savedAt.getTime() - a.savedAt.getTime(),
    )
  })

  // Compute local fingerprints for server stories that also have a local
  // version, merging them into the existing fingerprint map.
  const mergeLocalFingerprints = async (stories: ApiStoryMetadata[]) => {
    if (stories.length === 0) return
    const newFingerprints = new Map(localFingerprints())
    for (const serverStory of stories) {
      if (serverStory.fingerprint) {
        // Check if we have a local version
        const localStory = await storyManager.loadStory(serverStory.id)
        if (localStory) {
          newFingerprints.set(serverStory.id, generateStoryFingerprint(localStory.messages))
        }
      }
    }
    setLocalFingerprints(newFingerprints)
  }

  // Load the first page of server stories, resetting pagination state.
  const loadFirstServerPage = async () => {
    const { stories, pagination } = await storyManager.getServerStories({ page: 1 })
    setServerStories(stories)
    setServerPage(pagination?.page ?? 1)
    setServerTotalPages(pagination?.totalPages ?? 1)
    await mergeLocalFingerprints(stories)
  }

  const loadMoreServerStories = async () => {
    if (loadingMore()) return
    setLoadingMore(true)
    try {
      const { stories, pagination } = await storyManager.getServerStories({ page: serverPage() + 1 })
      // Dedupe by id: stories created/updated between page requests can shift
      // page boundaries and surface the same story twice.
      setServerStories((prev) => {
        const seen = new Set(prev.map((s) => s.id))
        return [...prev, ...stories.filter((s) => !seen.has(s.id))]
      })
      if (pagination) {
        setServerPage(pagination.page)
        setServerTotalPages(pagination.totalPages)
      } else {
        setServerPage((p) => p + 1)
      }
      await mergeLocalFingerprints(stories)
    } catch (error) {
      console.error('Failed to load more server stories:', error)
    } finally {
      setLoadingMore(false)
    }
  }

  const loadStories = async () => {
    setLoading(true)

    // Check server availability
    console.log('[LandingPage] Checking server availability...')
    const available = await storyManager.isServerAvailable()
    console.log('[LandingPage] Server available:', available)
    setServerAvailable(available)

    // Load local stories
    const stories = await storyManager.getSavedStories()
    console.log(
      '[LandingPage] Local stories from index:',
      stories.map((s) => ({ id: s.id, name: s.name })),
    )
    setLocalStories(stories)

    // Load server stories if available
    if (available) {
      try {
        console.log('[LandingPage] Loading server stories...')
        await loadFirstServerPage()
      } catch (error) {
        console.error('Failed to load server stories:', error)
      }
    } else {
      setServerStories([])
      setServerPage(1)
      setServerTotalPages(1)
    }

    setLoading(false)
  }

  // Load stories and adventure count on mount
  onMount(() => {
    loadStories()
    getMyAdventures()
      .then(({ data }) => {
        setAdventureCount(data?.adventures?.length ?? 0)
      })
      .catch(() => {
        // Silently fail — count just won't show
      })
  })

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
          },
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
            const presets = (presetsResponse.data?.presets || []) as { id: string; name: string }[]
            const preset = presets.find((p) => p.id === calendarPresetId)

            if (preset) {
              await postMyStoriesByStoryIdCalendars({
                path: { storyId: newStory.id },
                body: {
                  name: preset.name,
                  config: preset as any,
                  setAsDefault: true,
                },
              })
            }
          } catch (error) {
            console.error('Failed to create default calendar:', error)
            // Continue anyway - calendar can be created later
          }
        }

        // Don't manually load the story - let the route handler load it properly via load-story endpoint
        // Just navigate to it and the /story/:id route will call loadStoryById which uses getMyStoriesByIdLoadStory
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

  const handleImportClaudeChat = async (
    conversationName: string,
    messages: Message[],
    _importTarget: 'new' | 'current',
    storageMode: 'local' | 'server',
  ) => {
    // Always create a new story from the landing page (no current story exists)
    const { storyId } = await importClaudeChat({
      conversationName,
      messages,
      importTarget: 'new',
      storageMode,
    })

    setShowClaudeChatImport(false)
    navigate(`/story/${storyId}`)
  }

  const handleImportClaudeChatWithBranches = async (
    conversationName: string,
    branchData: BranchConversionResult,
    _importTarget: 'new' | 'current',
    storageMode: 'local' | 'server',
  ) => {
    // Always create a new story from the landing page (no current story exists)
    const { storyId } = await importClaudeChatWithBranches({
      conversationName,
      segments: branchData.segments,
      branchChoices: branchData.branchChoices,
      importTarget: 'new',
      storageMode,
    })

    setShowClaudeChatImport(false)
    navigate(`/story/${storyId}`)
  }

  const handleDeleteStory = async (storyId: string, type: 'local' | 'server') => {
    try {
      if (type === 'server') {
        await storyManager.deleteFromServer(storyId)
        setServerStories((prev) => prev.filter((s) => s.id !== storyId))
      } else {
        await storyManager.deleteStory(storyId)
        setLocalStories((prev) => prev.filter((s) => s.id !== storyId))
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
        await createServerStoryFromSnapshot(data)

        // Upload is a conversion to a server-backed story. The server assigns
        // a new ID, so retaining the old local index entry as `server` would
        // leave a route that can never resolve on the backend.
        await storyManager.deleteStory(storyId)

        // Reload stories (reset server pagination to the first page)
        await loadFirstServerPage()
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

  const { resolvedTheme, setTheme } = useTheme()

  const toggleTheme = () => {
    setTheme(resolvedTheme() === 'starlight' ? 'chronicle' : 'starlight')
  }

  const isDark = () => resolvedTheme() === 'chronicle'

  const handleLogout = () => {
    authStore.logout()
    navigate('/login')
  }

  const handleImportMythWeavers = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,.zip'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      setImportingMythWeavers(true)
      try {
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch(`${getApiBaseUrl()}/my/stories/import-zip`, {
          method: 'POST',
          body: formData,
          credentials: 'include',
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Import failed')
        }

        const result = await response.json()
        console.log('Story imported:', result)

        // Reload stories list
        await loadStories()

        // Navigate to the imported story
        props.onSelectStory(result.storyId)
      } catch (error) {
        console.error('Failed to import story:', error)
        alert(`Failed to import story: ${error instanceof Error ? error.message : 'Unknown error'}`)
      } finally {
        setImportingMythWeavers(false)
      }
    }
    input.click()
  }

  const handleExportZip = async (storyId: string) => {
    try {
      const baseUrl = getApiBaseUrl()
      const response = await fetch(`${baseUrl}/my/stories/${storyId}/export-zip`, {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Export failed' }))
        throw new Error(error.error || 'Export failed')
      }

      const blob = await response.blob()
      const contentDisposition = response.headers.get('Content-Disposition')
      const filenameMatch = contentDisposition?.match(/filename="?(.+?)"?$/)
      const filename = filenameMatch?.[1] || `story-${storyId}.zip`

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export story:', error)
      alert(`Failed to export story: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return (
    <div class={styles.pageWrapper}>
      <NavBar variant="elevated" style={{ 'flex-shrink': '0' }}>
        <NavBarBrand href="/">
          <img src="/mythweavers.png" alt="MythWeavers" style={{ height: '32px', 'margin-right': '8px' }} />
          <span class={styles.brandText}>MythWeavers</span>
        </NavBarBrand>

        <NavBarActions>
          <IconButton
            variant="ghost"
            onClick={toggleTheme}
            aria-label={isDark() ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark() ? '☀️' : '🌙'}
          </IconButton>

          <IconButton variant="ghost" onClick={() => setShowAISettings(true)} aria-label="AI Settings">
            <PhGearIcon />
          </IconButton>

          <Show
            when={authStore.user && !authStore.isOfflineMode}
            fallback={
              <Show when={authStore.isOfflineMode}>
                <Button variant="ghost" size="sm" disabled>
                  Offline Mode
                </Button>
              </Show>
            }
          >
            <Dropdown
              alignRight
              trigger={
                <IconButton variant="ghost" aria-label={authStore.user?.username || 'User'}>
                  <PhUserCircleIcon size={20} />
                </IconButton>
              }
            >
              <DropdownItem onClick={() => navigate('/connections')}>Connected apps</DropdownItem>
              <DropdownItem danger onClick={handleLogout}>
                Logout
              </DropdownItem>
            </Dropdown>
          </Show>
        </NavBarActions>
      </NavBar>

      <div class={styles.contentArea}>
        <Card
          style={{
            width: '100%',
            'max-width': '800px',
            flex: '1',
            display: 'flex',
            'flex-direction': 'column',
            'min-height': '0',
            overflow: 'hidden',
          }}
        >
          <Tabs
            activeTab={activeTab()}
            onTabChange={(id) => {
              const tab = id as 'load' | 'adventures'
              setActiveTab(tab)
            }}
            size="md"
            style={{ display: 'flex', 'flex-direction': 'column', height: '100%', 'min-height': '0' }}
          >
            <TabList style={{ 'flex-shrink': '0' }}>
              <Tab id="load">Stories ({combinedStories().length})</Tab>
              <Tab id="adventures">Adventures{adventureCount() != null ? ` (${adventureCount()})` : ''}</Tab>
            </TabList>

            <TabPanel id="load" style={{ flex: '1', 'overflow-y': 'auto', 'min-height': '0' }}>
              <CardBody>
                <div style={{ display: 'flex', gap: '0.5rem', 'margin-bottom': '1rem' }}>
                  <Button variant="primary" onClick={() => setShowNewStory(true)}>
                    New Story
                  </Button>
                  <Button variant="secondary" onClick={() => setShowClaudeChatImport(true)}>
                    Import Claude Chat
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleImportMythWeavers}
                    disabled={!serverAvailable() || importingMythWeavers()}
                  >
                    {importingMythWeavers() ? 'Importing...' : 'Import MythWeavers'}
                  </Button>
                </div>

                <Show
                  when={!loading()}
                  fallback={
                    <div
                      style={{
                        display: 'flex',
                        'align-items': 'center',
                        'justify-content': 'center',
                        gap: '0.5rem',
                        padding: '2rem',
                      }}
                    >
                      <Spinner size="sm" />
                      <Text as="span" color="secondary">
                        Loading stories...
                      </Text>
                    </div>
                  }
                >
                  <Show
                    when={combinedStories().length > 0}
                    fallback={
                      <Text size="lg" color="secondary" align="center" style={{ padding: '3rem' }}>
                        No saved stories found. Create a new story to get started!
                      </Text>
                    }
                  >
                    <StoryList
                      stories={combinedStories()}
                      onLoadStory={handleLoadStory}
                      onDeleteStory={handleDeleteStory}
                      onExportZip={serverAvailable() ? handleExportZip : undefined}
                      onSyncToServer={serverAvailable() ? handleSyncToServer : undefined}
                      syncing={syncing()}
                      editingEnabled={true}
                      serverAvailable={serverAvailable()}
                      onRename={loadStories}
                    />
                    <Show when={hasMoreServerStories()}>
                      <div style={{ display: 'flex', 'justify-content': 'center', 'margin-top': '1rem' }}>
                        <Button variant="secondary" onClick={loadMoreServerStories} disabled={loadingMore()}>
                          {loadingMore() ? 'Loading...' : 'Load more stories'}
                        </Button>
                      </div>
                    </Show>
                  </Show>
                </Show>
              </CardBody>
            </TabPanel>

            <TabPanel id="adventures" style={{ flex: '1', 'overflow-y': 'auto', 'min-height': '0' }}>
              <CardBody>
                <AdventureList onCountChange={setAdventureCount} />
              </CardBody>
            </TabPanel>
          </Tabs>
        </Card>
      </div>

      <Modal open={showNewStory()} onClose={() => setShowNewStory(false)} title="New Story" size="md">
        <NewStoryForm
          serverAvailable={serverAvailable()}
          onCreateStory={(name, storageMode, calendarPresetId) => {
            setShowNewStory(false)
            handleCreateStory(name, storageMode, calendarPresetId)
          }}
          onCancel={() => setShowNewStory(false)}
          submitText="Create Story"
        />
      </Modal>

      <AISettingsPanel show={showAISettings()} onClose={() => setShowAISettings(false)} />

      <ClaudeChatImportModal
        show={showClaudeChatImport()}
        hasCurrentStory={false}
        serverAvailable={serverAvailable()}
        onClose={() => setShowClaudeChatImport(false)}
        onImport={handleImportClaudeChat}
        onImportWithBranches={handleImportClaudeChatWithBranches}
      />
    </div>
  )
}
