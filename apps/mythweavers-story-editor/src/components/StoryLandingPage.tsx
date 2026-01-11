import {
  Button,
  Card,
  CardBody,
  Dropdown,
  DropdownDivider,
  DropdownItem,
  IconButton,
  NavBar,
  NavBarActions,
  NavBarBrand,
  NavBarNav,
  NavLink,
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
import { authStore } from '../stores/authStore'
import { getCalendarsPresets, postMyStories, postMyStoriesByStoryIdCalendars } from '../client/config'
import { charactersStore } from '../stores/charactersStore'
import { contextItemsStore } from '../stores/contextItemsStore'
import { currentStoryStore } from '../stores/currentStoryStore'
import { mapsStore } from '../stores/mapsStore'
import { messagesStore } from '../stores/messagesStore'
import { nodeStore } from '../stores/nodeStore'
import { ApiStoryMetadata, apiClient } from '../utils/apiClient'
import type { BranchConversionResult } from '../utils/claudeChatImport'
import { importClaudeChat, importClaudeChatWithBranches } from '../utils/claudeChatImporter'
import { generateStoryFingerprint } from '../utils/storyFingerprint'
import { StoryMetadata, storyManager } from '../utils/storyManager'
import type { Message } from '../types/core'
import { ClaudeChatImportModal } from './ClaudeChatImportModal'
import { NewStoryForm } from './NewStoryForm'
import { StoryList, StoryListItem } from './StoryList'
import * as styles from './StoryLandingPage.css'

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
  const [showClaudeChatImport, setShowClaudeChatImport] = createSignal(false)

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
      }
    })

    // Combine and sort by date (newest first)
    return [...localStoriesProcessed, ...serverStoriesProcessed].sort(
      (a, b) => b.savedAt.getTime() - a.savedAt.getTime(),
    )
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
    console.log(
      '[LandingPage] Local stories from index:',
      stories.map((s) => ({ id: s.id, name: s.name })),
    )
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
              console.log('[LandingPage] Local story loaded:', localStory)
              console.log(
                `[LandingPage] Local story ${serverStory.name} has ${localStory.messages?.length || 0} messages`,
              )
              console.log('[LandingPage] First message:', localStory.messages?.[0])
              const localFingerprint = generateStoryFingerprint(localStory.messages)
              console.log(
                `[LandingPage] Story ${serverStory.name}: server=${serverStory.fingerprint.substring(0, 6)}, local=${localFingerprint}`,
              )
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
        await apiClient.createStory({
          name: data.name,
          messages: data.messages || [],
          characters: data.characters || [],
          contextItems: data.contextItems || [],
          input: data.input || '',
          storySetting: data.storySetting || '',
          person: data.person || 'third',
          tense: data.tense || 'past',
          globalScript: data.globalScript,
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

  const navigate = useNavigate()
  const { resolvedTheme, setTheme } = useTheme()

  const toggleTheme = () => {
    setTheme(resolvedTheme() === 'starlight' ? 'chronicle' : 'starlight')
  }

  const isDark = () => resolvedTheme() === 'chronicle'

  const handleLogout = () => {
    authStore.logout()
    navigate('/login')
  }

  return (
    <div class={styles.pageWrapper}>
      <NavBar variant="elevated" style={{ 'flex-shrink': '0' }}>
        <NavBarBrand href="/">
          <img src="/mythweavers.png" alt="MythWeavers" style={{ height: '32px', 'margin-right': '8px' }} />
          MythWeavers
        </NavBarBrand>

        <NavBarNav>
          <NavLink href="/">Stories</NavLink>
        </NavBarNav>

        <NavBarActions>
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
            <Dropdown alignRight trigger={<Button variant="ghost">{authStore.user?.username || 'User'}</Button>}>
              <DropdownItem onClick={() => navigate('/settings')}>Settings</DropdownItem>
              <DropdownDivider />
              <DropdownItem danger onClick={handleLogout}>
                Logout
              </DropdownItem>
            </Dropdown>
          </Show>

          <IconButton
            variant="ghost"
            onClick={toggleTheme}
            aria-label={isDark() ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark() ? '☀️' : '🌙'}
          </IconButton>
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
          onTabChange={(id) => setActiveTab(id as 'new' | 'load')}
          size="md"
          style={{ display: 'flex', 'flex-direction': 'column', height: '100%', 'min-height': '0' }}
        >
          <TabList style={{ 'flex-shrink': '0' }}>
            <Tab id="new">New Story</Tab>
            <Tab id="load">Load Story ({combinedStories().length})</Tab>
          </TabList>

          <TabPanel id="new" style={{ flex: '1', 'overflow-y': 'auto', 'min-height': '0' }}>
            <CardBody>
              <NewStoryForm serverAvailable={serverAvailable()} onCreateStory={handleCreateStory} />

              <div style={{ 'margin-top': '2rem', 'padding-top': '1.5rem', 'border-top': '1px solid var(--color-border-default)' }}>
                <Text size="sm" color="secondary" style={{ 'margin-bottom': '0.75rem' }}>
                  Or import from external source:
                </Text>
                <Button variant="secondary" onClick={() => setShowClaudeChatImport(true)}>
                  Import Claude Chat
                </Button>
              </div>
            </CardBody>
          </TabPanel>

          <TabPanel id="load" style={{ flex: '1', 'overflow-y': 'auto', 'min-height': '0' }}>
            <CardBody>
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
                    <Text as="span" color="secondary">Loading stories...</Text>
                  </div>
                }
              >
                <Show
                  when={combinedStories().length > 0}
                  fallback={
                    <Text
                      size="lg"
                      color="secondary"
                      align="center"
                      style={{ padding: '3rem' }}
                    >
                      No saved stories found. Create a new story to get started!
                    </Text>
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
            </CardBody>
          </TabPanel>
        </Tabs>
      </Card>
      </div>

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
