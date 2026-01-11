import { Button, Dropdown, DropdownDivider, DropdownItem, IconButton, useTheme } from '@mythweavers/ui'
import { useNavigate } from '@solidjs/router'
import {
  BsArrowsMove,
  BsBook,
  BsBookHalf,
  BsBoxArrowRight,
  BsCalendar3,
  BsChevronDown,
  BsChevronUp,
  BsCodeSlash,
  BsCpu,
  BsFilm,
  BsGear,
  BsGlobe,
  BsMap,
  BsMoon,
  BsPeople,
  BsPlus,
  BsSearch,
  BsSun,
  BsThreeDots,
} from 'solid-icons/bs'
import * as styles from './StoryHeader.css'
import { Component, For, Show, createEffect, createMemo, createSignal } from 'solid-js'
import { authStore } from '../stores/authStore'
import { charactersStore } from '../stores/charactersStore'
import { contextItemsStore } from '../stores/contextItemsStore'
import { currentStoryStore } from '../stores/currentStoryStore'
import { episodeViewerStore } from '../stores/episodeViewerStore'
import { headerStore } from '../stores/headerStore'
import { llmActivityStore } from '../stores/llmActivityStore'
import { mapsStore } from '../stores/mapsStore'
import { messagesStore } from '../stores/messagesStore'
import { modelsStore } from '../stores/modelsStore'
import { navigationStore } from '../stores/navigationStore'
import { searchModalStore } from '../stores/searchModalStore'
import { settingsStore } from '../stores/settingsStore'
import { viewModeStore } from '../stores/viewModeStore'
import { Character, Message } from '../types/core'
import type { BranchConversionResult } from '../utils/claudeChatImport'
import { CalendarManagement } from './CalendarManagement'
import { Characters, type CharactersRef } from './Characters'
import { ContextItems, type ContextItemsRef } from './ContextItems'
import { EpisodeViewer } from './EpisodeViewer'
import { HeaderButton } from './HeaderButton'
import { LlmActivityPanel } from './LlmActivityPanel'
import { Maps } from './Maps'
import { NewStoryForm } from './NewStoryForm'
import { OverlayPanel } from './OverlayPanel'
import { SaveIndicator } from './SaveIndicator'
import { Settings } from './Settings'
import { StoryNavigation } from './StoryNavigation'
import { StoryStats } from './StoryStats'
import { TravelTimeCalculator } from './TravelTimeCalculator'

interface StoryHeaderProps {
  onLoadStory: (
    messages: Message[],
    characters: Character[],
    input: string,
    storySetting: string,
  ) => void
  onBulkSummarize: () => void
  onBulkAnalysis: () => void
  onMigrateInstructions: () => void
  onRemoveUserMessages: () => void
  onCleanupThinkTags: () => void
  onRewriteMessages: () => void
  onExportStory: () => void
  onImportStory: () => void
  onImportClaudeChat: (
    conversationName: string,
    messages: Message[],
    importTarget: 'new' | 'current',
    storageMode: 'local' | 'server',
  ) => Promise<void>
  onImportClaudeChatWithBranches: (
    conversationName: string,
    branchData: BranchConversionResult,
    importTarget: 'new' | 'current',
    storageMode: 'local' | 'server',
  ) => Promise<void>
  serverAvailable: boolean
  isGenerating: boolean
  contextSize: number
  charsPerToken: number
}

export const StoryHeader: Component<StoryHeaderProps> = (props) => {
  const navigate = useNavigate()
  const { resolvedTheme, setTheme } = useTheme()
  const [showNewStoryModal, setShowNewStoryModal] = createSignal(false)
  const [serverAvailable, setServerAvailable] = createSignal(false)
  const [activeSection, setActiveSection] = createSignal<
    'settings' | 'characters' | 'context' | 'maps' | 'navigation' | null
  >(null)
  const [isMobile, setIsMobile] = createSignal(window.innerWidth <= 768)
  const [showTravelTimeCalculator, setShowTravelTimeCalculator] = createSignal(false)
  const [showCalendarManagement, setShowCalendarManagement] = createSignal(false)

  // Refs for overlay panel actions
  let charactersRef: CharactersRef | undefined
  let contextItemsRef: ContextItemsRef | undefined

  // Get all plot-type context items (storylines)
  const storylines = createMemo(() => contextItemsStore.contextItems.filter((item) => item.type === 'plot'))

  // Use header store directly as single source of truth
  const isCollapsed = headerStore.isCollapsed

  // Track window resize
  createEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  })

  // Check server availability
  import('../utils/storyManager').then(({ storyManager }) => {
    storyManager.isServerAvailable().then(setServerAvailable)
  })

  const handleNewStory = (name: string, storageMode: 'local' | 'server', _calendarPresetId?: string) => {
    messagesStore.clearMessages()
    charactersStore.setCharacters([])
    contextItemsStore.setContextItems([])
    currentStoryStore.newStory(storageMode, settingsStore.provider, settingsStore.model)
    currentStoryStore.setName(name, false) // false = not a placeholder name

    setShowNewStoryModal(false)
    // Navigate to the new story
    navigate(`/story/${currentStoryStore.id}`)
  }

  return (
    <>
      <div class={styles.headerWrapper}>
        <IconButton
          class={styles.headerToggle}
          variant="primary"
          onClick={() => {
            const willCollapse = !isCollapsed()
            headerStore.toggle()
            // Close any open sections when collapsing
            if (willCollapse) {
              setActiveSection(null)
              settingsStore.setShowSettings(false)
              charactersStore.setShowCharacters(false)
              contextItemsStore.setShowContextItems(false)
              mapsStore.setShowMaps(false)
              navigationStore.setShowNavigation(false)
            }
          }}
          aria-label={isCollapsed() ? 'Show header' : 'Hide header'}
        >
          <Show when={isCollapsed()} fallback={<BsChevronUp />}>
            <BsChevronDown />
          </Show>
        </IconButton>
        <header
          class={isCollapsed() ? `${styles.header} ${styles.headerCollapsed}` : styles.header}
        >
          {/* Only show navigation button on mobile */}
          <Show when={isMobile()}>
            <button
              class={
                activeSection() === 'navigation'
                  ? `${styles.navigationButton} ${styles.navigationButtonActive}`
                  : styles.navigationButton
              }
              onClick={() => {
                const newSection = activeSection() === 'navigation' ? null : 'navigation'
                setActiveSection(newSection)
                navigationStore.setShowNavigation(newSection === 'navigation')
                settingsStore.setShowSettings(false)
                charactersStore.setShowCharacters(false)
                contextItemsStore.setShowContextItems(false)
                mapsStore.setShowMaps(false)
              }}
              title={activeSection() === 'navigation' ? 'Hide chapters' : 'Navigate chapters'}
            >
              <BsBookHalf />
            </button>
          </Show>
          <div class={styles.config}>
            <HeaderButton
              onClick={() => {
                const newSection = activeSection() === 'characters' ? null : 'characters'
                setActiveSection(newSection)
                settingsStore.setShowSettings(false)
                charactersStore.setShowCharacters(newSection === 'characters')
                contextItemsStore.setShowContextItems(false)
                mapsStore.setShowMaps(false)
                navigationStore.setShowNavigation(false)
              }}
              variant={activeSection() === 'characters' ? 'active' : 'default'}
              title={activeSection() === 'characters' ? 'Hide characters' : 'Show characters'}
            >
              <BsPeople />
            </HeaderButton>
            <HeaderButton
              onClick={() => {
                const newSection = activeSection() === 'context' ? null : 'context'
                setActiveSection(newSection)
                settingsStore.setShowSettings(false)
                charactersStore.setShowCharacters(false)
                contextItemsStore.setShowContextItems(newSection === 'context')
                mapsStore.setShowMaps(false)
                navigationStore.setShowNavigation(false)
              }}
              variant={activeSection() === 'context' ? 'active' : 'default'}
              title={activeSection() === 'context' ? 'Hide context items' : 'Show context items'}
            >
              <BsGlobe />
            </HeaderButton>
            <HeaderButton
              onClick={() => {
                const newSection = activeSection() === 'maps' ? null : 'maps'
                setActiveSection(newSection)
                settingsStore.setShowSettings(false)
                charactersStore.setShowCharacters(false)
                contextItemsStore.setShowContextItems(false)
                mapsStore.setShowMaps(newSection === 'maps')
                navigationStore.setShowNavigation(false)
              }}
              variant={activeSection() === 'maps' ? 'active' : 'default'}
              title={activeSection() === 'maps' ? 'Hide maps' : 'Show maps'}
            >
              <BsMap />
            </HeaderButton>
            {/* View Mode Dropdown */}
            <Show when={messagesStore.hasStoryMessages}>
              <Dropdown
                alignRight
                trigger={
                  <HeaderButton
                    title="Change view mode"
                    variant={viewModeStore.viewMode() !== 'normal' ? 'active' : 'default'}
                  >
                    <div style={{ display: 'flex', 'flex-direction': 'column', 'align-items': 'center', 'padding-top': '4px' }}>
                      {viewModeStore.viewMode() === 'normal' && <BsBook />}
                      {viewModeStore.viewMode() === 'reorder' && <BsArrowsMove />}
                      {viewModeStore.viewMode() === 'script' && <BsCodeSlash />}
                      {viewModeStore.viewMode() === 'read' && <BsBookHalf />}
                      <BsChevronDown style={{ 'font-size': '10px' }} />
                    </div>
                  </HeaderButton>
                }
              >
                <DropdownItem
                  icon={<BsBook />}
                  active={viewModeStore.viewMode() === 'normal'}
                  onClick={() => viewModeStore.setViewMode('normal')}
                >
                  Normal View
                </DropdownItem>
                <DropdownItem
                  icon={<BsArrowsMove />}
                  active={viewModeStore.viewMode() === 'reorder'}
                  onClick={() => viewModeStore.setViewMode('reorder')}
                >
                  Reorder/Move Messages
                </DropdownItem>
                <DropdownItem
                  icon={<BsCodeSlash />}
                  active={viewModeStore.viewMode() === 'script'}
                  onClick={() => viewModeStore.setViewMode('script')}
                >
                  Script View
                </DropdownItem>
                <DropdownItem
                  icon={<BsBookHalf />}
                  active={viewModeStore.viewMode() === 'read'}
                  onClick={() => viewModeStore.setViewMode('read')}
                >
                  Read View
                </DropdownItem>
              </Dropdown>
            </Show>

            {/* Storyline Filter Dropdown */}
            <Show when={messagesStore.hasStoryMessages && storylines().length > 0}>
              <Dropdown
                alignRight
                trigger={
                  <HeaderButton
                    title="Filter by storyline"
                    variant={navigationStore.selectedStorylineId ? 'active' : 'default'}
                  >
                    <div style={{ display: 'flex', 'flex-direction': 'column', 'align-items': 'center', 'padding-top': '4px' }}>
                      <BsGlobe />
                      <BsChevronDown style={{ 'font-size': '10px' }} />
                    </div>
                  </HeaderButton>
                }
              >
                <DropdownItem
                  active={!navigationStore.selectedStorylineId}
                  onClick={() => navigationStore.clearStorylineFilter()}
                >
                  All Chapters
                </DropdownItem>
                <DropdownDivider />
                <For each={storylines()}>
                  {(storyline) => (
                    <DropdownItem
                      active={navigationStore.selectedStorylineId === storyline.id}
                      onClick={() => navigationStore.setSelectedStorylineId(storyline.id)}
                    >
                      {storyline.name}
                    </DropdownItem>
                  )}
                </For>
              </Dropdown>
            </Show>

            {/* More menu with dropdown */}
            <Dropdown
              alignRight
              trigger={
                <HeaderButton title="More options">
                  <BsThreeDots />
                </HeaderButton>
              }
            >
              <DropdownItem
                icon={<BsGear />}
                onClick={() => {
                  const newSection = activeSection() === 'settings' ? null : 'settings'
                  setActiveSection(newSection)
                  settingsStore.setShowSettings(newSection === 'settings')
                  charactersStore.setShowCharacters(false)
                  contextItemsStore.setShowContextItems(false)
                  mapsStore.setShowMaps(false)
                  navigationStore.setShowNavigation(false)
                }}
              >
                Story Settings
              </DropdownItem>
              <DropdownItem
                icon={<BsBook />}
                onClick={() => {
                  import('../stores/storyManagerStore').then(({ storyManagerStore }) => {
                    storyManagerStore.open()
                  })
                }}
              >
                Story Manager
              </DropdownItem>
              <Show when={messagesStore.hasStoryMessages}>
                <DropdownItem icon={<BsSearch />} onClick={() => searchModalStore.show()}>
                  Search Messages
                </DropdownItem>
              </Show>
              <DropdownItem icon={<BsFilm />} onClick={() => episodeViewerStore.toggle()}>
                Episode Viewer
              </DropdownItem>
              <DropdownItem icon={<BsCpu />} onClick={() => llmActivityStore.show()}>
                LLM Activity
              </DropdownItem>
              <Show when={mapsStore.maps.length > 0}>
                <DropdownItem icon={<BsArrowsMove />} onClick={() => setShowTravelTimeCalculator(true)}>
                  Travel Time Calculator
                </DropdownItem>
              </Show>
              <Show when={currentStoryStore.storageMode === 'server'}>
                <DropdownItem icon={<BsCalendar3 />} onClick={() => setShowCalendarManagement(true)}>
                  Calendar Management
                </DropdownItem>
              </Show>
              <DropdownDivider />
              <Show when={messagesStore.hasQueries}>
                <DropdownItem onClick={() => messagesStore.clearQueries()}>Clear Queries</DropdownItem>
              </Show>
              <Show when={messagesStore.hasStoryMessages}>
                <DropdownItem icon={<BsPlus />} onClick={() => setShowNewStoryModal(true)}>
                  New Story
                </DropdownItem>
              </Show>
              <DropdownDivider />
              <DropdownItem
                icon={resolvedTheme() === 'chronicle' ? <BsSun /> : <BsMoon />}
                onClick={() => setTheme(resolvedTheme() === 'chronicle' ? 'starlight' : 'chronicle')}
              >
                {resolvedTheme() === 'chronicle' ? 'Light Theme' : 'Dark Theme'}
              </DropdownItem>
              <DropdownItem icon={<BsBoxArrowRight />} onClick={() => authStore.logout()}>
                Logout
              </DropdownItem>
            </Dropdown>

            <SaveIndicator />
          </div>
        </header>
        <div
          class={isCollapsed() ? `${styles.statsWrapper} ${styles.statsWrapperCollapsed}` : styles.statsWrapper}
        >
          <StoryStats />
        </div>
      </div>
      {/* Overlay Panels */}
      <OverlayPanel
        show={settingsStore.showSettings}
        onClose={() => {
          settingsStore.setShowSettings(false)
          setActiveSection(null)
        }}
        title="Story Settings"
        position="left"
      >
        <Settings
          showSettings={true}
          storySetting={currentStoryStore.storySetting}
          setStorySetting={currentStoryStore.setStorySetting}
          contextSize={settingsStore.contextSize}
          setContextSize={settingsStore.setContextSize}
          model={settingsStore.model}
          setModel={settingsStore.setModel}
          availableModels={modelsStore.availableModels}
          isLoadingModels={modelsStore.isLoadingModels}
          onRefreshModels={() => modelsStore.fetchModels()}
          onBulkSummarize={props.onBulkSummarize}
          onBulkAnalysis={props.onBulkAnalysis}
          onMigrateInstructions={props.onMigrateInstructions}
          onRemoveUserMessages={props.onRemoveUserMessages}
          onCleanupThinkTags={props.onCleanupThinkTags}
          onRewriteMessages={props.onRewriteMessages}
          onExportStory={props.onExportStory}
          onImportStory={props.onImportStory}
          onImportClaudeChat={props.onImportClaudeChat}
          onImportClaudeChatWithBranches={props.onImportClaudeChatWithBranches}
          serverAvailable={props.serverAvailable}
          isLoading={messagesStore.isLoading}
          isGenerating={props.isGenerating}
          provider={settingsStore.provider}
          setProvider={settingsStore.setProvider}
          openrouterApiKey={settingsStore.openrouterApiKey}
          setOpenrouterApiKey={settingsStore.setOpenrouterApiKey}
          anthropicApiKey={settingsStore.anthropicApiKey}
          setAnthropicApiKey={settingsStore.setAnthropicApiKey}
          openaiApiKey={settingsStore.openaiApiKey}
          setOpenaiApiKey={settingsStore.setOpenaiApiKey}
          person={currentStoryStore.person}
          setPerson={(value: string) => currentStoryStore.setPerson(value as 'first' | 'second' | 'third')}
          tense={currentStoryStore.tense}
          setTense={(value: string) => currentStoryStore.setTense(value as 'present' | 'past')}
        />
      </OverlayPanel>

      <OverlayPanel
        show={charactersStore.showCharacters}
        onClose={() => {
          charactersStore.setShowCharacters(false)
          setActiveSection(null)
        }}
        title="Characters"
        position="left"
        headerAction={
          <Button size="sm" onClick={() => charactersRef?.addNew()}>
            <BsPlus /> Add
          </Button>
        }
      >
        <Characters ref={(r) => (charactersRef = r)} />
      </OverlayPanel>

      <OverlayPanel
        show={contextItemsStore.showContextItems}
        onClose={() => {
          contextItemsStore.setShowContextItems(false)
          setActiveSection(null)
        }}
        title="Context Items"
        position="left"
        headerAction={
          <Button size="sm" onClick={() => contextItemsRef?.addNew()}>
            <BsPlus /> Add
          </Button>
        }
      >
        <ContextItems ref={(r) => (contextItemsRef = r)} />
      </OverlayPanel>

      <OverlayPanel
        show={mapsStore.showMaps}
        onClose={() => {
          mapsStore.setShowMaps(false)
          setActiveSection(null)
        }}
        title="Maps"
        position="left"
      >
        <Maps />
      </OverlayPanel>

      {/* Mobile only: Navigation overlay */}
      <Show when={isMobile()}>
        <OverlayPanel
          show={navigationStore.showNavigation}
          onClose={() => {
            navigationStore.setShowNavigation(false)
            setActiveSection(null)
          }}
          title="Story Structure"
          position="left"
        >
          <StoryNavigation
            onSelectChapter={() => {
              // On mobile, close the navigation when a chapter is selected
              navigationStore.setShowNavigation(false)
              setActiveSection(null)
            }}
          />
        </OverlayPanel>
      </Show>

      <OverlayPanel
        show={llmActivityStore.isOpen}
        onClose={() => llmActivityStore.hide()}
        title="LLM Activity"
        position="right"
      >
        <LlmActivityPanel />
      </OverlayPanel>

      {/* New Story Modal */}
      <Show when={showNewStoryModal()}>
        <div class="modal-overlay" onClick={() => setShowNewStoryModal(false)}>
          <div class="modal-content" onClick={(e) => e.stopPropagation()} style="max-width: 400px;">
            <div class="modal-header">
              <h3>Create New Story</h3>
              <button class="modal-close" onClick={() => setShowNewStoryModal(false)}>
                ×
              </button>
            </div>
            <div class="modal-body">
              <p style="margin-bottom: 1.5rem;">This will clear the current story and create a new one.</p>
              <NewStoryForm
                serverAvailable={serverAvailable()}
                onCreateStory={handleNewStory}
                onCancel={() => setShowNewStoryModal(false)}
              />
            </div>
          </div>
        </div>
      </Show>

      {/* Only show modal version when not in docked mode */}
      <Show when={!episodeViewerStore.isDocked}>
        <EpisodeViewer isOpen={episodeViewerStore.isOpen} onClose={() => episodeViewerStore.hide()} mode="modal" />
      </Show>

      {/* Travel Time Calculator */}
      <TravelTimeCalculator
        isOpen={showTravelTimeCalculator()}
        onClose={() => setShowTravelTimeCalculator(false)}
        storyId={currentStoryStore.id}
      />

      {/* Calendar Management */}
      <OverlayPanel
        show={showCalendarManagement()}
        onClose={() => setShowCalendarManagement(false)}
        title="Calendar Management"
        position="left"
      >
        <CalendarManagement />
      </OverlayPanel>
    </>
  )
}
