import { Component, Show, createMemo, createSignal } from 'solid-js'
import { Model } from '../types/core'
import { STORY_SETTINGS, CONTEXT_SIZE_STEP } from '../constants'
import { BsListTask, BsArrowUpSquare, BsDownload, BsUpload, BsSearch, BsTrash, BsClipboard, BsLink45deg } from 'solid-icons/bs'
import { messagesStore } from '../stores/messagesStore'
import { globalOperationStore } from '../stores/globalOperationStore'
import { currentStoryStore } from '../stores/currentStoryStore'
import { nodeStore } from '../stores/nodeStore'
import { ModelSelector } from './ModelSelector'
import { DeletedTurnsModal } from './DeletedTurnsModal'

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
  useSmartContext: boolean
  setUseSmartContext: (value: boolean) => void
  autoGenerate: boolean
  setAutoGenerate: (value: boolean) => void
  person: string
  setPerson: (value: string) => void
  tense: string
  setTense: (value: string) => void
  paragraphsPerTurn: number
  setParagraphsPerTurn: (value: number) => void
}

export const Settings: Component<SettingsProps> = (props) => {
  const [showImportDialog, setShowImportDialog] = createSignal(false)
  const [importText, setImportText] = createSignal('')
  const [showOpenRouterKey, setShowOpenRouterKey] = createSignal(false)
  const [showAnthropicKey, setShowAnthropicKey] = createSignal(false)
  const [showOpenAIKey, setShowOpenAIKey] = createSignal(false)
  const [showDeletedTurnsModal, setShowDeletedTurnsModal] = createSignal(false)
  
  const needsMigrationCount = createMemo(() => messagesStore.getNeedsMigrationCount())
  const standaloneUserCount = createMemo(() => messagesStore.getStandaloneUserMessageCount())
  const missingAnalysisCount = createMemo(() => messagesStore.getMessagesNeedingAnalysis().length)
  const thinkTagsToCleanup = createMemo(() =>
    messagesStore.messages.filter(msg =>
      msg.content && msg.content.includes('<think>') && msg.content.includes('</think>')
    ).length
  )
  const orphanedMessagesCount = createMemo(() =>
    messagesStore.messages.filter(msg => !msg.nodeId && !msg.chapterId).length
  )

  const [importError, setImportError] = createSignal('')

  const handleImportStory = () => {
    const text = importText().trim()
    if (text) {
      try {
        // Clear any previous error
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
    const chapterNodes = nodeStore.nodesArray.filter(n => n.type === 'chapter').sort((a, b) => a.order - b.order)
    const targetNode = nodeStore.selectedNodeId || (chapterNodes.length > 0 ? chapterNodes[chapterNodes.length - 1].id : null)

    if (targetNode) {
      messagesStore.attachOrphanedMessagesToNode(targetNode)
      alert(`Attached ${orphanedMessagesCount()} orphaned messages to node`)
    } else {
      alert('No target node found to attach orphaned messages. Please create or select a chapter first.')
    }
  }

  // Chapters are now nodes - this function is obsolete
  const copyChapterSummaries = async () => {
    // const chapters = chaptersStore.state.chapters
    // if (chapters.length === 0) {
    //   alert('No chapters found to copy')
    //   return
    // }
    //
    // // Sort chapters by order
    // const sortedChapters = [...chapters].sort((a, b) => a.order - b.order)
    //
    // // Build markdown content
    // let markdown = '# Story Chapters\n\n'
    //
    // for (const chapter of sortedChapters) {
    //   markdown += `## ${chapter.title}\n\n`
    //   if (chapter.summary) {
    //     markdown += `${chapter.summary}\n\n`
    //   } else {
    //     markdown += `*No summary available*\n\n`
    //   }
    // }
    //
    // try {
    //   await navigator.clipboard.writeText(markdown)
    //   alert(`Copied ${chapters.length} chapter${chapters.length !== 1 ? 's' : ''} to clipboard`)
    // } catch (error) {
    //   console.error('Failed to copy to clipboard:', error)
    //   alert('Failed to copy to clipboard. Please try again.')
    // }
    alert('Chapter summaries are now managed through the node system')
  }

  return (
    <>
      <div class="story-setting">
        <div class="setting-row">
          <label class="setting-label">Provider:</label>
          <select
            value={props.provider}
            onChange={(e) => props.setProvider(e.target.value)}
            class="setting-dropdown"
          >
            <option value="ollama">Ollama</option>
            <option value="openrouter">OpenRouter</option>
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>
        <Show when={props.provider === 'openrouter'}>
          <div class="setting-row">
            <label class="setting-label">OpenRouter API Key:</label>
            <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
              <input
                type={showOpenRouterKey() ? "text" : "password"}
                value={props.openrouterApiKey}
                onChange={(e) => props.setOpenrouterApiKey(e.target.value)}
                class="setting-input"
                placeholder="sk-or-..."
                style="flex: 1;"
              />
              <button
                onClick={() => setShowOpenRouterKey(!showOpenRouterKey())}
                class="show-key-button"
                title={showOpenRouterKey() ? "Hide API key" : "Show API key"}
                style="padding: 4px 8px; cursor: pointer;"
              >
                {showOpenRouterKey() ? "Hide" : "Show"}
              </button>
            </div>
          </div>
        </Show>
        <Show when={props.provider === 'anthropic'}>
          <div class="setting-row">
            <label class="setting-label">Anthropic API Key:</label>
            <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
              <input
                type={showAnthropicKey() ? "text" : "password"}
                value={props.anthropicApiKey}
                onChange={(e) => props.setAnthropicApiKey(e.target.value)}
                class="setting-input"
                placeholder="sk-ant-..."
                style="flex: 1;"
              />
              <button
                onClick={() => setShowAnthropicKey(!showAnthropicKey())}
                class="show-key-button"
                title={showAnthropicKey() ? "Hide API key" : "Show API key"}
                style="padding: 4px 8px; cursor: pointer;"
              >
                {showAnthropicKey() ? "Hide" : "Show"}
              </button>
            </div>
          </div>
        </Show>
        <Show when={props.provider === 'openai'}>
          <div class="setting-row">
            <label class="setting-label">OpenAI API Key:</label>
            <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
              <input
                type={showOpenAIKey() ? "text" : "password"}
                value={props.openaiApiKey}
                onChange={(e) => props.setOpenaiApiKey(e.target.value)}
                class="setting-input"
                placeholder="sk-..."
                style="flex: 1;"
              />
              <button
                onClick={() => setShowOpenAIKey(!showOpenAIKey())}
                class="show-key-button"
                title={showOpenAIKey() ? "Hide API key" : "Show API key"}
                style="padding: 4px 8px; cursor: pointer;"
              >
                {showOpenAIKey() ? "Hide" : "Show"}
              </button>
            </div>
          </div>
        </Show>
        <div class="setting-row">
          <label class="setting-label">Model:</label>
          <ModelSelector
            model={props.model}
            setModel={props.setModel}
            availableModels={props.availableModels}
            isLoadingModels={props.isLoadingModels}
            onRefreshModels={props.onRefreshModels}
          />
        </div>
        <div class="setting-row">
          <label class="setting-label">Story Genre:</label>
          <select
            value={currentStoryStore.storySetting}
            onChange={(e) => currentStoryStore.setStorySetting(e.target.value)}
            class="setting-dropdown"
          >
            {STORY_SETTINGS.map((setting) => (
              <option value={setting.value}>
                {setting.label}
              </option>
            ))}
          </select>
        </div>
        <div class="setting-row">
          <label class="setting-label">Context Size:</label>
          <Show
            when={props.model && props.availableModels.length > 0}
            fallback={<span class="setting-info">Select a model first</span>}
          >
            {(() => {
              const selectedModel = props.availableModels.find(m => m.name === props.model)
              const maxContext = selectedModel?.context_length || 8192
              const contextOptions = []
              for (let i = CONTEXT_SIZE_STEP; i <= maxContext; i += CONTEXT_SIZE_STEP) {
                contextOptions.push(i)
              }
              return (
                <>
                  <Show when={props.provider === 'openrouter' || props.provider === 'anthropic'}>
                    <span class="setting-info">
                      {(maxContext / 1000).toFixed(0)}k tokens (model maximum)
                    </span>
                  </Show>
                  <Show when={props.provider === 'ollama'}>
                    <select
                      value={props.contextSize}
                      onChange={(e) => {
                        const newSize = parseInt(e.target.value)
                        props.setContextSize(newSize)
                        localStorage.setItem('story-context-size', newSize.toString())
                      }}
                      class="setting-dropdown"
                    >
                      {contextOptions.map(size => (
                        <option value={size}>
                          {(size / 1000).toFixed(0)}k tokens
                        </option>
                      ))}
                    </select>
                  </Show>
                </>
              )
            })()}
          </Show>
        </div>
        <div class="setting-row">
          <label class="setting-label">Smart Context:</label>
          <label class="checkbox-container">
            <input
              type="checkbox"
              checked={props.useSmartContext}
              onChange={(e) => props.setUseSmartContext(e.target.checked)}
              class="setting-checkbox"
            />
            <span class="checkbox-label">Use AI-powered relevance-based context selection</span>
          </label>
        </div>
        <div class="setting-row">
          <label class="setting-label">Auto-Generation:</label>
          <label class="checkbox-container">
            <input
              type="checkbox"
              checked={props.autoGenerate}
              onChange={(e) => props.setAutoGenerate(e.target.checked)}
              class="setting-checkbox"
            />
            <span class="checkbox-label">Automatically continue story generation</span>
          </label>
        </div>
        <Show when={props.provider === 'anthropic' || props.provider === 'openrouter'}>
          <div class="setting-row">
            <label class="setting-label">Cache Keep-Alive:</label>
            <label class="checkbox-container">
              <input
                type="checkbox"
                checked={true}
                onChange={(e) => console.log('Cache keep-alive:', e.target.checked)}
                class="setting-checkbox"
              />
              <span class="checkbox-label">Keep cache warm (refreshes every 4.5 minutes)</span>
            </label>
          </div>
        </Show>
        <div class="setting-row">
          <label class="setting-label">Person:</label>
          <select
            value={currentStoryStore.person}
            onChange={(e) => currentStoryStore.setPerson(e.target.value as 'first' | 'second' | 'third')}
            class="setting-dropdown"
          >
            <option value="third">Third Person</option>
            <option value="first">First Person</option>
            <option value="second">Second Person</option>
          </select>
        </div>
        <div class="setting-row">
          <label class="setting-label">Tense:</label>
          <select
            value={currentStoryStore.tense}
            onChange={(e) => currentStoryStore.setTense(e.target.value as 'present' | 'past')}
            class="setting-dropdown"
          >
            <option value="past">Past Tense</option>
            <option value="present">Present Tense</option>
          </select>
        </div>
        <div class="setting-row">
          <label class="setting-label">Paragraphs per Turn:</label>
          <select
            value={props.paragraphsPerTurn}
            onChange={(e) => props.setParagraphsPerTurn(parseInt(e.target.value))}
            class="setting-dropdown"
          >
            <option value="0">No limit</option>
            <option value="1">1 paragraph</option>
            <option value="2">2 paragraphs</option>
            <option value="3">3 paragraphs</option>
            <option value="4">4 paragraphs</option>
            <option value="5">5 paragraphs</option>
            <option value="6">6 paragraphs</option>
          </select>
        </div>
        <div class="setting-row">
          <label class="setting-label">Timeline Granularity:</label>
          <select
            value={currentStoryStore.timelineGranularity || 'hour'}
            onChange={(e) => currentStoryStore.setTimelineGranularity(e.target.value as 'hour' | 'day')}
            class="setting-dropdown"
          >
            <option value="hour">Hour (60 min increments)</option>
            <option value="day">Day (1440 min increments)</option>
          </select>
        </div>
        <div class="setting-row">
          <label class="setting-label">Timeline Start Time:</label>
          <input
            type="number"
            value={currentStoryStore.timelineStartTime ?? ''}
            onChange={(e) => {
              const val = e.target.value.trim()
              currentStoryStore.setTimelineStartTime(val === '' ? null : parseInt(val))
            }}
            class="setting-input"
            placeholder="Minutes from 0 BBY (negative = BBY, positive = ABY)"
            title="Leave empty to auto-calculate from earliest chapter"
          />
        </div>
        <div class="setting-row">
          <label class="setting-label">Timeline End Time:</label>
          <input
            type="number"
            value={currentStoryStore.timelineEndTime ?? ''}
            onChange={(e) => {
              const val = e.target.value.trim()
              currentStoryStore.setTimelineEndTime(val === '' ? null : parseInt(val))
            }}
            class="setting-input"
            placeholder="Minutes from 0 BBY (negative = BBY, positive = ABY)"
            title="Leave empty to auto-calculate from latest chapter"
          />
        </div>
        <div class="setting-row">
          <label class="setting-label">Summaries:</label>
          <button
            onClick={props.onBulkSummarize}
            disabled={props.isLoading || !props.model || globalOperationStore.isOperationInProgress() || props.isGenerating}
            class="bulk-summarize-button"
            title={
              props.isGenerating ? "AI is currently generating content - please wait" :
              globalOperationStore.isOperationInProgress() ? "Another operation is in progress" :
              !props.model ? "Select a model first" :
              "Generate summaries for all story messages that don't have one yet"
            }
          >
            <BsListTask /> Generate Missing Summaries
          </button>
        </div>
        <div class="setting-row">
          <label class="setting-label">Analysis:</label>
          <button
            onClick={props.onBulkAnalysis}
            disabled={props.isLoading || !props.model || globalOperationStore.isOperationInProgress() || props.isGenerating}
            class="bulk-summarize-button"
            title={
              props.isGenerating ? "AI is currently generating content - please wait" :
              globalOperationStore.isOperationInProgress() ? "Another operation is in progress" :
              !props.model ? "Select a model first" :
              `Generate scene analysis for ${missingAnalysisCount()} story messages that don't have one yet`
            }
          >
            <BsSearch /> Generate Missing Analysis
          </button>
        </div>
        <Show when={needsMigrationCount() > 0}>
          <div class="setting-row">
            <label class="setting-label">Migration:</label>
            <button
              onClick={props.onMigrateInstructions}
              disabled={props.isLoading || globalOperationStore.isOperationInProgress()}
              class="bulk-summarize-button"
              title="Copy user instructions to assistant messages for unified story turns"
            >
              <BsArrowUpSquare /> Migrate {needsMigrationCount()} Instructions
            </button>
          </div>
        </Show>
        <Show when={standaloneUserCount() > 0}>
          <div class="setting-row">
            <label class="setting-label">Cleanup:</label>
            <button
              onClick={props.onRemoveUserMessages}
              disabled={props.isLoading || globalOperationStore.isOperationInProgress()}
              class="bulk-summarize-button"
              title="Remove standalone user messages (instructions are now stored in assistant messages)"
            >
              Remove {standaloneUserCount()} User Messages
            </button>
          </div>
        </Show>
        <Show when={thinkTagsToCleanup() > 0}>
          <div class="setting-row">
            <label class="setting-label">Think Tags:</label>
            <button
              onClick={props.onCleanupThinkTags}
              disabled={props.isLoading || globalOperationStore.isOperationInProgress()}
              class="bulk-summarize-button"
              title="Extract think tags from message content and move to separate think property"
            >
              Clean {thinkTagsToCleanup()} Think Tags
            </button>
          </div>
        </Show>
        <Show when={orphanedMessagesCount() > 0}>
          <div class="setting-row">
            <label class="setting-label">Orphaned Messages:</label>
            <button
              onClick={handleAttachOrphanedMessages}
              disabled={props.isLoading || globalOperationStore.isOperationInProgress()}
              class="bulk-summarize-button"
              title="Attach messages without node assignment to the current or last chapter"
            >
              <BsLink45deg /> Attach {orphanedMessagesCount()} Orphaned Messages
            </button>
          </div>
        </Show>
        <Show when={messagesStore.hasStoryMessages}>
          <div class="setting-row">
            <label class="setting-label">Rewrite Messages:</label>
            <button
              onClick={props.onRewriteMessages}
              disabled={props.isLoading || globalOperationStore.isOperationInProgress()}
              class="bulk-summarize-button"
              title="Select and rewrite multiple messages with specific instructions"
            >
              Rewrite Messages
            </button>
          </div>
        </Show>
        <Show when={messagesStore.hasStoryMessages}>
          <div class="setting-row">
            <label class="setting-label">Story Export:</label>
            <button
              onClick={props.onExportStory}
              disabled={props.isLoading || globalOperationStore.isOperationInProgress()}
              class="bulk-summarize-button"
              title="Copy entire story with all data as JSON to clipboard"
            >
              <BsDownload /> Export as JSON
            </button>
          </div>
        </Show>
        {/* Chapter summaries UI removed - chapters are now nodes */}
        <Show when={false}>
          <div class="setting-row">
            <label class="setting-label">Chapter Summaries:</label>
            <button
              onClick={copyChapterSummaries}
              disabled={props.isLoading || globalOperationStore.isOperationInProgress()}
              class="bulk-summarize-button"
              title="Copy all chapter titles and summaries to clipboard in markdown format"
            >
              <BsClipboard /> Copy Chapter Summaries
            </button>
          </div>
          <div class="setting-row">
            <label class="setting-label">Chapter Display:</label>
            <div style="display: flex; gap: 10px;">
              <button
                onClick={() => console.log('Chapters are now nodes')}
                disabled={props.isLoading || globalOperationStore.isOperationInProgress()}
                class="bulk-summarize-button"
                style="flex: 1;"
                title="Collapse all chapters in the story"
              >
                Collapse All
              </button>
              <button
                onClick={() => console.log('Chapters are now nodes')}
                disabled={props.isLoading || globalOperationStore.isOperationInProgress()}
                class="bulk-summarize-button"
                style="flex: 1;"
                title="Expand all chapters in the story"
              >
                Expand All
              </button>
            </div>
          </div>
        </Show>
        <div class="setting-row">
          <label class="setting-label">Story Import:</label>
          <button
            onClick={() => setShowImportDialog(true)}
            disabled={props.isLoading || globalOperationStore.isOperationInProgress()}
            class="bulk-summarize-button"
            title="Import story from JSON or text"
          >
            <BsUpload /> Import Story
          </button>
        </div>
        <Show when={currentStoryStore.storageMode === 'server'}>
          <div class="setting-row">
            <label class="setting-label">Deleted Turns:</label>
            <button
              onClick={() => setShowDeletedTurnsModal(true)}
              disabled={props.isLoading || globalOperationStore.isOperationInProgress()}
              class="bulk-summarize-button"
              title="View and restore recently deleted story turns"
            >
              <BsTrash /> View Deleted Turns
            </button>
          </div>
        </Show>
      </div>
      
      <Show when={showImportDialog()}>
        <div class="import-dialog-overlay">
          <div class="import-dialog">
            <div class="import-dialog-header">
              <h3>Import Story</h3>
              <button
                onClick={() => setShowImportDialog(false)}
                class="close-dialog-button"
                title="Close"
              >
                ×
              </button>
            </div>
            <div class="import-dialog-content">
              <p class="import-dialog-info">
                Paste either JSON export data (preserves all story data, characters, and settings) or plain text story content.
              </p>
              <textarea
                value={importText()}
                onInput={(e) => {
                  setImportText(e.target.value)
                  setImportError('') // Clear error when typing
                }}
                placeholder="Paste JSON export or story text here..."
                class="import-textarea"
                rows={10}
              />
              <Show when={importError()}>
                <div class="import-error">
                  {importError()}
                </div>
              </Show>
              <div class="import-dialog-actions">
                <button
                  onClick={handleImportStory}
                  disabled={!importText().trim()}
                  class="import-button"
                >
                  Import Story
                </button>
                <button
                  onClick={() => {
                    setShowImportDialog(false)
                    setImportText('')
                  }}
                  class="cancel-button"
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
          // Trigger a refresh of the messages store
          messagesStore.refreshMessages()
        }}
      />
    </>
  )
}