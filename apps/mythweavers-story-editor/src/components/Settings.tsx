import { ListDetailPanel, type ListDetailPanelRef } from '@mythweavers/ui'
import {
  BsArrowUpSquare,
  BsChatLeftText,
  BsClock,
  BsDownload,
  BsGear,
  BsKey,
  BsLink45deg,
  BsListTask,
  BsPencilSquare,
  BsSearch,
  BsTrash,
  BsUpload,
} from 'solid-icons/bs'
import { type Component, For, type JSX, Show, createMemo, createSignal, onMount } from 'solid-js'
import { CONTEXT_SIZE_STEP, STORY_FORMATS, STORY_SETTINGS } from '../constants'
import { calendarStore } from '../stores/calendarStore'
import { currentStoryStore } from '../stores/currentStoryStore'
import { globalOperationStore } from '../stores/globalOperationStore'
import { messagesStore } from '../stores/messagesStore'
import { nodeStore } from '../stores/nodeStore'
import { settingsStore } from '../stores/settingsStore'
import type { Message, Model } from '../types/core'
import { ClaudeChatImportModal } from './ClaudeChatImportModal'
import { DeletedNodesModal } from './DeletedNodesModal'
import { DeletedTurnsModal } from './DeletedTurnsModal'
import { ModelSelector } from './ModelSelector'
import * as styles from './Settings.css'
import { StoryTimePicker } from './StoryTimePicker'

interface SettingsSection {
  id: string
  name: string
  icon: JSX.Element
}

const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: 'provider', name: 'Provider & Model', icon: <BsKey /> },
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
  onBulkAnalysis: () => void
  onMigrateInstructions: () => void
  onRemoveUserMessages: () => void
  onCleanupThinkTags: () => void
  onRewriteMessages: () => void
  onExportStory: () => void
  onImportStory: (storyText: string) => void
  onImportClaudeChat: (
    conversationName: string,
    messages: Message[],
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
  const [showImportDialog, setShowImportDialog] = createSignal(false)
  const [showClaudeChatImportModal, setShowClaudeChatImportModal] = createSignal(false)
  const [importText, setImportText] = createSignal('')
  const [showOpenRouterKey, setShowOpenRouterKey] = createSignal(false)
  const [showAnthropicKey, setShowAnthropicKey] = createSignal(false)
  const [showOpenAIKey, setShowOpenAIKey] = createSignal(false)
  const [showDeletedTurnsModal, setShowDeletedTurnsModal] = createSignal(false)
  const [showDeletedNodesModal, setShowDeletedNodesModal] = createSignal(false)
  const [importError, setImportError] = createSignal('')

  let panelRef: ListDetailPanelRef | undefined

  // Auto-select first section on mount
  onMount(() => {
    panelRef?.select('provider')
  })

  const needsMigrationCount = createMemo(() => messagesStore.getNeedsMigrationCount())
  const standaloneUserCount = createMemo(() => messagesStore.getStandaloneUserMessageCount())
  const missingAnalysisCount = createMemo(() => messagesStore.getMessagesNeedingAnalysis().length)
  const thinkTagsToCleanup = createMemo(
    () =>
      messagesStore.messages.filter((msg) => msg.content?.includes('<think>') && msg.content.includes('</think>'))
        .length,
  )
  const orphanedMessagesCount = createMemo(
    () => messagesStore.messages.filter((msg) => !msg.sceneId).length,
  )

  const handleImportStory = () => {
    const text = importText().trim()
    if (text) {
      try {
        setImportError('')
        props.onImportStory(text)
        setImportText('')
        setShowImportDialog(false)
      } catch (error) {
        setImportError(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
  }

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

  const renderProviderSection = () => (
    <div class={styles.section}>
      <div class={styles.settingRow}>
        <label class={styles.label}>Provider</label>
        <select value={props.provider} onChange={(e) => props.setProvider(e.target.value)} class={styles.select}>
          <option value="ollama">Ollama</option>
          <option value="openrouter">OpenRouter</option>
          <option value="anthropic">Anthropic</option>
          <option value="openai">OpenAI</option>
        </select>
      </div>

      <Show when={props.provider === 'openrouter'}>
        <div class={styles.settingRow}>
          <label class={styles.label}>OpenRouter API Key</label>
          <div class={styles.inputRow}>
            <input
              type={showOpenRouterKey() ? 'text' : 'password'}
              value={props.openrouterApiKey}
              onChange={(e) => props.setOpenrouterApiKey(e.target.value)}
              class={styles.input}
              placeholder="sk-or-..."
            />
            <button
              onClick={() => setShowOpenRouterKey(!showOpenRouterKey())}
              class={styles.showKeyButton}
              title={showOpenRouterKey() ? 'Hide API key' : 'Show API key'}
            >
              {showOpenRouterKey() ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
      </Show>

      <Show when={props.provider === 'anthropic'}>
        <div class={styles.settingRow}>
          <label class={styles.label}>Anthropic API Key</label>
          <div class={styles.inputRow}>
            <input
              type={showAnthropicKey() ? 'text' : 'password'}
              value={props.anthropicApiKey}
              onChange={(e) => props.setAnthropicApiKey(e.target.value)}
              class={styles.input}
              placeholder="sk-ant-..."
            />
            <button
              onClick={() => setShowAnthropicKey(!showAnthropicKey())}
              class={styles.showKeyButton}
              title={showAnthropicKey() ? 'Hide API key' : 'Show API key'}
            >
              {showAnthropicKey() ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
      </Show>

      <Show when={props.provider === 'openai'}>
        <div class={styles.settingRow}>
          <label class={styles.label}>OpenAI API Key</label>
          <div class={styles.inputRow}>
            <input
              type={showOpenAIKey() ? 'text' : 'password'}
              value={props.openaiApiKey}
              onChange={(e) => props.setOpenaiApiKey(e.target.value)}
              class={styles.input}
              placeholder="sk-..."
            />
            <button
              onClick={() => setShowOpenAIKey(!showOpenAIKey())}
              class={styles.showKeyButton}
              title={showOpenAIKey() ? 'Hide API key' : 'Show API key'}
            >
              {showOpenAIKey() ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
      </Show>

      <div class={styles.settingRow}>
        <label class={styles.label}>Model</label>
        <ModelSelector
          model={props.model}
          setModel={props.setModel}
          availableModels={props.availableModels}
          isLoadingModels={props.isLoadingModels}
          onRefreshModels={props.onRefreshModels}
        />
      </div>

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

      <div class={styles.settingRow}>
        <button
          onClick={props.onBulkAnalysis}
          disabled={props.isLoading || !props.model || globalOperationStore.isOperationInProgress() || props.isGenerating}
          class={styles.button}
          title={
            props.isGenerating
              ? 'AI is currently generating content - please wait'
              : globalOperationStore.isOperationInProgress()
                ? 'Another operation is in progress'
                : !props.model
                  ? 'Select a model first'
                  : `Generate scene analysis for ${missingAnalysisCount()} story messages that don't have one yet`
          }
        >
          <BsSearch /> Generate Missing Analysis
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
      <Show when={messagesStore.hasStoryMessages}>
        <div class={styles.settingRow}>
          <button
            onClick={props.onExportStory}
            disabled={props.isLoading || globalOperationStore.isOperationInProgress()}
            class={styles.button}
            title="Copy entire story with all data as JSON to clipboard"
          >
            <BsDownload /> Export as JSON
          </button>
        </div>
      </Show>

      <div class={styles.settingRow}>
        <button
          onClick={() => setShowImportDialog(true)}
          disabled={props.isLoading || globalOperationStore.isOperationInProgress()}
          class={styles.button}
          title="Import story from JSON or text"
        >
          <BsUpload /> Import Story
        </button>
      </div>

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
      case 'provider':
        return renderProviderSection()
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

      <Show when={showImportDialog()}>
        <div class={styles.dialogOverlay}>
          <div class={styles.dialog}>
            <div class={styles.dialogHeader}>
              <h3 class={styles.dialogTitle}>Import Story</h3>
              <button onClick={() => setShowImportDialog(false)} class={styles.dialogCloseButton} title="Close">
                ×
              </button>
            </div>
            <div class={styles.dialogContent}>
              <p class={styles.dialogInfo}>
                Paste either JSON export data (preserves all story data, characters, and settings) or plain text story
                content.
              </p>
              <textarea
                value={importText()}
                onInput={(e) => {
                  setImportText(e.target.value)
                  setImportError('')
                }}
                placeholder="Paste JSON export or story text here..."
                class={styles.textarea}
                rows={10}
              />
              <Show when={importError()}>
                <div class={styles.errorText}>{importError()}</div>
              </Show>
              <div class={styles.dialogActions}>
                <button onClick={handleImportStory} disabled={!importText().trim()} class={styles.primaryButton}>
                  Import Story
                </button>
                <button
                  onClick={() => {
                    setShowImportDialog(false)
                    setImportText('')
                  }}
                  class={styles.secondaryButton}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>

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
      />
    </>
  )
}
