import { Component, Show, createMemo } from 'solid-js'
import { BsEye, BsX, BsStopFill } from 'solid-icons/bs'
import { messagesStore } from '../stores/messagesStore'
import { settingsStore } from '../stores/settingsStore'
import { nodeStore } from '../stores/nodeStore'
import { viewModeStore } from '../stores/viewModeStore'
import { TokenSelector } from './TokenSelector'
import { RegenerateButton } from './RegenerateButton'
import styles from './StoryInput.module.css'

interface StoryInputProps {
  isLoading: boolean
  isAnalyzing: boolean
  isGenerating: boolean
  onSubmit: (isQuery: boolean, maxTokens?: number) => void
  onAutoOrManualSubmit: (isQuery: boolean, maxTokens?: number) => void
  onRegenerate: (maxTokens?: number) => void
  onAbort: () => void
  onShowContextPreview: () => void
}

export const StoryInput: Component<StoryInputProps> = (props) => {
  // Check if a chapter node is selected
  const selectedNode = createMemo(() => nodeStore.getSelectedNode())
  const isChapterSelected = createMemo(() => selectedNode()?.type === 'chapter')
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      props.onSubmit(false)
    }
  }

  return (
    <Show when={!viewModeStore.isReadMode()}>
      <div class={styles.inputContainer}>
      <div class={styles.inputWithClear}>
        <textarea
          value={messagesStore.input}
          onInput={(e) => messagesStore.setInput(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={isChapterSelected() ? "Enter your story direction..." : "Select a chapter node first..."}
          class={styles.messageInput}
          disabled={props.isLoading || !isChapterSelected()}
          rows={3}
        />
        <div class={styles.inputActions}>
          <button
            onClick={(e) => {
              console.log('[StoryInput] Context preview button clicked')
              e.preventDefault()
              e.stopPropagation()
              console.log('[StoryInput] Calling onShowContextPreview')
              try {
                props.onShowContextPreview()
                console.log('[StoryInput] onShowContextPreview called successfully')
              } catch (error) {
                console.error('[StoryInput] Error calling onShowContextPreview:', error)
              }
            }}
            class={styles.contextPreviewButton}
            title="Show context that will be sent to AI"
            type="button"
            disabled={props.isLoading || !isChapterSelected()}
          >
            <BsEye />
          </button>
          <Show when={messagesStore.input}>
            <button
              onClick={messagesStore.clearInput}
              class={styles.clearInputButton}
              title="Clear input"
              type="button"
            >
              <BsX />
            </button>
          </Show>
        </div>
      </div>
      <div class={styles.buttons}>
        <div class={styles.paragraphSelector}>
          <span class={styles.paragraphLabel}>Paragraphs:</span>
          {[1, 2, 3, 4, 5, 6, 0].map(count => (
            <button
              class={`${styles.paragraphButton} ${settingsStore.paragraphsPerTurn === count ? styles.paragraphButtonActive : ''}`}
              onClick={() => settingsStore.setParagraphsPerTurn(count)}
              title={count === 0 ? 'No paragraph limit' : `Generate ${count} paragraph${count !== 1 ? 's' : ''}`}
            >
              {count === 0 ? '∞' : count}
            </button>
          ))}
        </div>
        <div class={styles.paragraphSelector}>
          <span class={styles.paragraphLabel}>Thinking:</span>
          {[
            { value: 0, label: 'Off' },
            { value: 1024, label: 'Low' },
            { value: 2048, label: 'Med' },
            { value: 4096, label: 'High' }
          ].map(option => (
            <button
              class={`${styles.paragraphButton} ${settingsStore.thinkingBudget === option.value ? styles.paragraphButtonActive : ''}`}
              onClick={() => settingsStore.setThinkingBudget(option.value)}
              title={option.value === 0 ? 'No extended thinking' : `Thinking budget: ${option.value} tokens`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <Show when={messagesStore.canRegenerate()}>
          <RegenerateButton
            onRegenerate={props.onRegenerate}
            disabled={props.isLoading || props.isAnalyzing || !isChapterSelected()}
          />
        </Show>
        <Show when={props.isLoading || props.isAnalyzing}>
          <button
            onClick={props.onAbort}
            class={styles.abortButton}
            title="Stop the current generation"
          >
            <BsStopFill /> Stop
          </button>
        </Show>
        <button
          onClick={() => props.onSubmit(true)}
          disabled={!messagesStore.input.trim() || props.isLoading || props.isAnalyzing || !isChapterSelected()}
          class={styles.queryButton}
          title="Ask a question about the story without continuing it"
        >
          Query
        </button>
        <TokenSelector
          onSubmit={(maxTokens) => props.onAutoOrManualSubmit(false, maxTokens)}
          disabled={(!messagesStore.input.trim() && !settingsStore.autoGenerate) || props.isLoading || props.isAnalyzing || !isChapterSelected()}
          isLoading={props.isLoading}
          isAnalyzing={props.isAnalyzing}
        />
      </div>
    </div>
    </Show>
  )
}