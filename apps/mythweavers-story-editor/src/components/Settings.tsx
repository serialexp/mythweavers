import { ListDetailPanel, type ListDetailPanelRef } from '@mythweavers/ui'
import {
  BsArrowUpSquare,
  BsChatLeftText,
  BsClock,
  BsDownload,
  BsGear,
  BsKey,
  BsLayers,
  BsLink45deg,
  BsPlug,
  BsListTask,
  BsPencilSquare,
  BsTrash,
} from 'solid-icons/bs'
import { type Component, For, type JSX, Show, createMemo, createSignal, onMount } from 'solid-js'
import { CONTEXT_SIZE_STEP, STORY_FORMATS, STORY_SETTINGS } from '../constants'
import { calendarStore } from '../stores/calendarStore'
import { currentStoryStore } from '../stores/currentStoryStore'
import { globalOperationStore } from '../stores/globalOperationStore'
import { messagesStore } from '../stores/messagesStore'
import { nodeStore } from '../stores/nodeStore'
import { modelsStore } from '../stores/modelsStore'
import { settingsStore } from '../stores/settingsStore'
import type { Message, Model } from '../types/core'
import type { BranchConversionResult } from '../utils/claudeChatImport'
import { ClaudeChatImportModal } from './ClaudeChatImportModal'
import { DeletedNodesModal } from './DeletedNodesModal'
import { DeletedTurnsModal } from './DeletedTurnsModal'
import { CategoryModelOverrides } from './CategoryModelOverrides'
import { CustomProviders } from './CustomProviders'
import { ModelSelector } from './ModelSelector'
import { ProviderSelector, ApiKeys } from './ProviderModelSelector'
import * as styles from './Settings.css'
import { StoryTimePicker } from './StoryTimePicker'

interface SettingsSection {
  id: string
  name: string
  icon: JSX.Element
}

const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: 'api-keys', name: 'API Keys', icon: <BsKey /> },
  { id: 'models', name: 'Models', icon: <BsLayers /> },
  { id: 'custom-providers', name: 'Custom Providers', icon: <BsPlug /> },
  { id: 'story', name: 'Story Settings', icon: <BsPencilSquare /> },
  { id: 'timeline', name: 'Timeline', icon: <BsClock /> },
  { id: 'operations', name: 'Bulk Operations', icon: <BsGear /> },
  { id: 'import-export', name: 'Import / Export', icon: <BsDownload /> },
]

interface SettingsProps {
  showSettings: boolean
  storySetting: string
  setStorySetting: (value: string) => void
  contextSize: number
  setContextSize: (value: number) => void
  model: string
  setModel: (value: string) => void
  availableModels: Model[]
  isLoadingModels: boolean
  onRefreshModels: () => void
  onBulkSummarize: () => void
  onMigrateInstructions: () => void
  onRemoveUserMessages: () => void
  onCleanupThinkTags: () => void
  onRewriteMessages: () => void
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
  isLoading: boolean
  isGenerating: boolean
  provider: string
  setProvider: (value: string) => void
  openrouterApiKey: string
  setOpenrouterApiKey: (value: string) => void
  anthropicApiKey: string
  setAnthropicApiKey: (value: string) => void
  openaiApiKey: string
  setOpenaiApiKey: (value: string) => void
  person: string
  setPerson: (value: string) => void
  tense: string
  setTense: (value: string) => void
}

export const Settings: Component<SettingsProps> = (props) => {
  const [showClaudeChatImportModal, setShowClaudeChatImportModal] = createSignal(false)
  const [showDeletedTurnsModal, setShowDeletedTurnsModal] = createSignal(false)
  const [showDeletedNodesModal, setShowDeletedNodesModal] = createSignal(false)

  let panelRef: ListDetailPanelRef | undefined

  // Auto-select first section on mount
  onMount(() => {
    panelRef?.select('api-keys')
  })

  const needsMigrationCount = createMemo(() => messagesStore.getNeedsMigrationCount())
  const standaloneUserCount = createMemo(() => messagesStore.getStandaloneUserMessageCount())
  const thinkTagsToCleanup = createMemo(
    () =>
      messagesStore.messages.filter((msg) => msg.content?.includes('<think>') && msg.content.includes('</think>'))
        .length,
  )
  const orphanedMessagesCount = createMemo(
    () => messagesStore.messages.filter((msg) => !msg.sceneId).length,
  )

  const handleAttachOrphanedMessages = () => {
    const chapterNodes = nodeStore.nodesArray.filter((n) => n.type === 'chapter').sort((a, b) => a.order - b.order)
    const targetNode =
      nodeStore.selectedNodeId || (chapterNodes.length > 0 ? chapterNodes[chapterNodes.length - 1].id : null)

    if (targetNode) {
      messagesStore.attachOrphanedMessagesToNode(targetNode)
      alert(`Attached ${orphanedMessagesCount()} orphaned messages to node`)
    } else {
      alert('No target node found to attach orphaned messages. Please create or select a chapter first.')
    }
  }

  const renderModelsSection = () => (
    <div class={styles.section}>
      <ProviderSelector />

      <div class={styles.settingRow}>
        <label class={styles.label}>Default Model</label>
        <ModelSelector
          model={settingsStore.model}
          setModel={settingsStore.setModel}
          availableModels={modelsStore.availableModels}
          isLoadingModels={modelsStore.isLoadingModels}
          onRefreshModels={() => modelsStore.fetchModels()}
        />
      </div>

      <CategoryModelOverrides />

      <div class={styles.settingRow}>
        <label class={styles.label}>Context Size</label>
        <Show
          when={props.model && props.availableModels.length > 0}
          fallback={<span class={styles.infoText}>Select a model first</span>}
        >
          {(() => {
            const selectedModel = props.availableModels.find((m) => m.name === props.model)
            const maxContext = selectedModel?.context_length || 8192
            const contextOptions = []
            for (let i = CONTEXT_SIZE_STEP; i <= maxContext; i += CONTEXT_SIZE_STEP) {
              contextOptions.push(i)
            }
            return (
              <>
                <Show when={props.provider === 'openrouter' || props.provider === 'anthropic'}>
                  <span class={styles.infoText}>{(maxContext / 1000).toFixed(0)}k tokens (model maximum)</span>
                </Show>
                <Show when={props.provider === 'ollama'}>
                  <select
                    value={props.contextSize}
                    onChange={(e) => {
                      const newSize = Number.parseInt(e.target.value)
                      props.setContextSize(newSize)
                      localStorage.setItem('story-context-size', newSize.toString())
                    }}
                    class={styles.select}
                  >
                    <For each={contextOptions}>{(size) => <option value={size}>{(size / 1000).toFixed(0)}k tokens</option>}</For>
                  </select>
                </Show>
              </>
            )
          })()}
        </Show>
      </div>
    </div>
  )

  const renderStorySection = () => (
    <div class={styles.section}>
      <div class={styles.settingRow}>
        <label class={styles.label}>Story Format</label>
        <select
          value={currentStoryStore.storyFormat}
          onChange={(e) => currentStoryStore.setStoryFormat(e.target.value as 'narrative' | 'cyoa')}
          class={styles.select}
        >
          <For each={STORY_FORMATS}>{(format) => <option value={format.value}>{format.label}</option>}</For>
        </select>
      </div>

      <div class={styles.settingRow}>
        <label class={styles.label}>Story Genre</label>
        <select
          value={currentStoryStore.storySetting}
          onChange={(e) => currentStoryStore.setStorySetting(e.target.value)}
          class={styles.select}
        >
          <For each={STORY_SETTINGS}>{(setting) => <option value={setting.value}>{setting.label}</option>}</For>
        </select>
      </div>

      <div class={styles.settingRow}>
        <label class={styles.label}>Person</label>
        <select
          value={currentStoryStore.person}
          onChange={(e) => currentStoryStore.setPerson(e.target.value as 'first' | 'second' | 'third')}
          class={styles.select}
        >
          <option value="third">Third Person</option>
          <option value="first">First Person</option>
          <option value="second">Second Person</option>
        </select>
      </div>

      <div class={styles.settingRow}>
        <label class={styles.label}>Tense</label>
        <select
          value={currentStoryStore.tense}
          onChange={(e) => currentStoryStore.setTense(e.target.value as 'present' | 'past')}
          class={styles.select}
        >
          <option value="past">Past Tense</option>
          <option value="present">Present Tense</option>
        </select>
      </div>

      <div class={styles.settingRow}>
        <label class={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={settingsStore.refineClichés}
            onChange={(e) => settingsStore.setRefineClichés(e.target.checked)}
            class={styles.checkbox}
          />
          Refine clichés
        </label>
        <span class={styles.infoText}>
          After generation, run a second pass to identify and remove clichés, purple prose, and melodramatic writing.
          Uses more tokens but produces better quality content.
        </span>
      </div>

      <div class={styles.settingRow}>
        <label class={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={settingsStore.includeNameSuggestions}
            onChange={(e) => settingsStore.setIncludeNameSuggestions(e.target.checked)}
            class={styles.checkbox}
          />
          Include name suggestions
        </label>
        <span class={styles.infoText}>
          Append a list of random name suggestions to the context. Some models overuse these names — disable if characters are being named too eagerly.
        </span>
      </div>
    </div>
  )

  const renderTimelineSection = () => {
    const [showStartPicker, setShowStartPicker] = createSignal(false)
    const [showEndPicker, setShowEndPicker] = createSignal(false)
    const startTimeFormatted = () => calendarStore.formatStoryTime(currentStoryStore.timelineStartTime)
    const endTimeFormatted = () => calendarStore.formatStoryTime(currentStoryStore.timelineEndTime)

    return (
      <div class={styles.section}>
        <Show
          when={calendarStore.hasCalendar()}
          fallback={
            <div class={styles.infoText}>
              Timeline settings require a calendar. Create a calendar for this story in Calendar Management.
            </div>
          }
        >
          <div class={styles.settingRow}>
            <label class={styles.label}>Map Timeline Granularity</label>
            <select
              value={currentStoryStore.timelineGranularity || 'hour'}
              onChange={(e) => currentStoryStore.setTimelineGranularity(e.target.value as 'hour' | 'day')}
              class={styles.select}
            >
              <option value="hour">Hour (60 min increments)</option>
              <option value="day">Day (1440 min increments)</option>
            </select>
            <span class={styles.infoText}>
              Controls the step size for the map timeline slider. Story scenes can still be placed at any minute.
            </span>
          </div>

          <div class={styles.settingRow}>
            <label class={styles.label}>Timeline Start Time</label>
            <button class={styles.button} onClick={() => setShowStartPicker(true)}>
              {startTimeFormatted() ?? 'Not set (auto-calculate from earliest chapter)'}
            </button>
            <StoryTimePicker
              modal
              open={showStartPicker()}
              currentTime={currentStoryStore.timelineStartTime}
              onSave={(time) => {
                currentStoryStore.setTimelineStartTime(time)
                setShowStartPicker(false)
              }}
              onCancel={() => setShowStartPicker(false)}
            />
          </div>

          <div class={styles.settingRow}>
            <label class={styles.label}>Timeline End Time</label>
            <button class={styles.button} onClick={() => setShowEndPicker(true)}>
              {endTimeFormatted() ?? 'Not set (auto-calculate from latest chapter)'}
            </button>
            <StoryTimePicker
              modal
              open={showEndPicker()}
              currentTime={currentStoryStore.timelineEndTime}
              onSave={(time) => {
                currentStoryStore.setTimelineEndTime(time)
                setShowEndPicker(false)
              }}
              onCancel={() => setShowEndPicker(false)}
            />
          </div>
        </Show>
      </div>
    )
  }

  const renderOperationsSection = () => (
    <div class={styles.section}>
      <div class={styles.settingRow}>
        <button
          onClick={props.onBulkSummarize}
          disabled={props.isLoading || !props.model || globalOperationStore.isOperationInProgress() || props.isGenerating}
          class={styles.button}
          title={
            props.isGenerating
              ? 'AI is currently generating content - please wait'
              : globalOperationStore.isOperationInProgress()
                ? 'Another operation is in progress'
                : !props.model
                  ? 'Select a model first'
                  : "Generate summaries for all story messages that don't have one yet"
          }
        >
          <BsListTask /> Generate Missing Summaries
        </button>
      </div>


      <Show when={needsMigrationCount() > 0}>
        <div class={styles.settingRow}>
          <button
            onClick={props.onMigrateInstructions}
            disabled={props.isLoading || globalOperationStore.isOperationInProgress()}
            class={styles.button}
            title="Copy user instructions to assistant messages for unified story turns"
          >
            <BsArrowUpSquare /> Migrate {needsMigrationCount()} Instructions
          </button>
        </div>
      </Show>

      <Show when={standaloneUserCount() > 0}>
        <div class={styles.settingRow}>
          <button
            onClick={props.onRemoveUserMessages}
            disabled={props.isLoading || globalOperationStore.isOperationInProgress()}
            class={styles.button}
            title="Remove standalone user messages (instructions are now stored in assistant messages)"
          >
            Remove {standaloneUserCount()} User Messages
          </button>
        </div>
      </Show>

      <Show when={thinkTagsToCleanup() > 0}>
        <div class={styles.settingRow}>
          <button
            onClick={props.onCleanupThinkTags}
            disabled={props.isLoading || globalOperationStore.isOperationInProgress()}
            class={styles.button}
            title="Extract think tags from message content and move to separate think property"
          >
            Clean {thinkTagsToCleanup()} Think Tags
          </button>
        </div>
      </Show>

      <Show when={orphanedMessagesCount() > 0}>
        <div class={styles.settingRow}>
          <button
            onClick={handleAttachOrphanedMessages}
            disabled={props.isLoading || globalOperationStore.isOperationInProgress()}
            class={styles.button}
            title="Attach messages without node assignment to the current or last chapter"
          >
            <BsLink45deg /> Attach {orphanedMessagesCount()} Orphaned Messages
          </button>
        </div>
      </Show>

      <Show when={messagesStore.hasStoryMessages}>
        <div class={styles.settingRow}>
          <button
            onClick={props.onRewriteMessages}
            disabled={props.isLoading || globalOperationStore.isOperationInProgress()}
            class={styles.button}
            title="Select and rewrite multiple messages with specific instructions"
          >
            Rewrite Messages
          </button>
        </div>
      </Show>
    </div>
  )

  const renderImportExportSection = () => (
    <div class={styles.section}>
      <div class={styles.settingRow}>
        <button
          onClick={() => setShowClaudeChatImportModal(true)}
          disabled={props.isLoading || globalOperationStore.isOperationInProgress()}
          class={styles.button}
          title="Import a conversation from a Claude chat export"
        >
          <BsChatLeftText /> Import Claude Chat
        </button>
      </div>

      <Show when={currentStoryStore.storageMode === 'server'}>
        <div class={styles.settingRow}>
          <button
            onClick={() => setShowDeletedTurnsModal(true)}
            disabled={props.isLoading || globalOperationStore.isOperationInProgress()}
            class={styles.button}
            title="View and restore recently deleted story turns"
          >
            <BsTrash /> View Deleted Turns
          </button>
        </div>
        <div class={styles.settingRow}>
          <button
            onClick={() => setShowDeletedNodesModal(true)}
            disabled={props.isLoading || globalOperationStore.isOperationInProgress()}
            class={styles.button}
            title="View and restore recently deleted chapters, scenes, etc."
          >
            <BsTrash /> View Deleted Nodes
          </button>
        </div>
      </Show>
    </div>
  )

  const renderSectionContent = (sectionId: string) => {
    switch (sectionId) {
      case 'models':
        return renderModelsSection()
      case 'api-keys':
        return <ApiKeys />
      case 'custom-providers':
        return <CustomProviders />
      case 'story':
        return renderStorySection()
      case 'timeline':
        return renderTimelineSection()
      case 'operations':
        return renderOperationsSection()
      case 'import-export':
        return renderImportExportSection()
      default:
        return null
    }
  }

  return (
    <>
      <ListDetailPanel
        ref={(r) => (panelRef = r)}
        items={SETTINGS_SECTIONS}
        emptyStateMessage="Select a section to view settings"
        renderListItem={(section) => (
          <div class={styles.listItem}>
            {section.icon}
            <span>{section.name}</span>
          </div>
        )}
        detailTitle={(section) => section.name}
        renderDetail={(section) => renderSectionContent(section.id)}
      />

      <DeletedTurnsModal
        show={showDeletedTurnsModal()}
        onClose={() => setShowDeletedTurnsModal(false)}
        onRestore={() => {
          messagesStore.refreshMessages()
        }}
      />

      <DeletedNodesModal
        show={showDeletedNodesModal()}
        onClose={() => setShowDeletedNodesModal(false)}
        onRestore={() => {
          // Reload page to refresh nodes after restore
          window.location.reload()
        }}
      />

      <ClaudeChatImportModal
        show={showClaudeChatImportModal()}
        hasCurrentStory={currentStoryStore.isInitialized}
        serverAvailable={props.serverAvailable}
        onClose={() => setShowClaudeChatImportModal(false)}
        onImport={props.onImportClaudeChat}
        onImportWithBranches={props.onImportClaudeChatWithBranches}
      />
    </>
  )
}
