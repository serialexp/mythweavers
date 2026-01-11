import { Button, ButtonGroup, IconButton, Textarea, ToggleButton } from '@mythweavers/ui'
import { BsEye, BsStopFill, BsX } from 'solid-icons/bs'
import { Component, For, Show, createMemo, createSignal } from 'solid-js'
import { currentStoryStore } from '../stores/currentStoryStore'
import { messagesStore } from '../stores/messagesStore'
import { nodeStore } from '../stores/nodeStore'
import { settingsStore } from '../stores/settingsStore'
import { viewModeStore } from '../stores/viewModeStore'
import * as styles from './StoryInput.css'
import { TokenSelector } from './TokenSelector'

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

const PARAGRAPH_OPTIONS = [3, 6, 9, 12, 15, 18, 0] as const
const THINKING_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 1024, label: 'Low' },
  { value: 2048, label: 'Med' },
  { value: 4096, label: 'High' },
] as const

export const StoryInput: Component<StoryInputProps> = (props) => {
  const [paragraphsExpanded, setParagraphsExpanded] = createSignal(false)
  const [thinkingExpanded, setThinkingExpanded] = createSignal(false)

  // Check if a writable node (chapter or scene) is selected
  const selectedNode = createMemo(() => nodeStore.getSelectedNode())
  const isWritableNodeSelected = createMemo(() => {
    const type = selectedNode()?.type
    return type === 'chapter' || type === 'scene'
  })
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      props.onSubmit(false)
    }
  }

  const currentParagraphLabel = () => {
    const count = currentStoryStore.paragraphsPerTurn
    return count === 0 ? '∞' : String(count)
  }

  const currentThinkingLabel = () => {
    const option = THINKING_OPTIONS.find((o) => o.value === settingsStore.thinkingBudget)
    return option?.label ?? 'Off'
  }

  return (
    <Show when={!viewModeStore.isReadMode()}>
      <div class={styles.container}>
        <div class={styles.inputWithClear}>
          <Textarea
            value={messagesStore.input}
            onInput={(e) => messagesStore.setInput(e.currentTarget.value)}
            onKeyDown={handleKeyPress}
            placeholder={isWritableNodeSelected() ? 'Enter your story direction...' : 'Select a chapter or scene first...'}
            disabled={props.isLoading || !isWritableNodeSelected()}
            rows={3}
            style={{ flex: '1', 'min-height': '60px', 'max-height': '200px', resize: 'vertical' }}
          />
          <div class={styles.inputActions}>
            <IconButton
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
              aria-label="Show context that will be sent to AI"
              variant="secondary"
              size="sm"
              disabled={props.isLoading || !isWritableNodeSelected()}
            >
              <BsEye />
            </IconButton>
            <Show when={messagesStore.input}>
              <IconButton onClick={messagesStore.clearInput} aria-label="Clear input" variant="secondary" size="sm">
                <BsX />
              </IconButton>
            </Show>
          </div>
        </div>
        <div class={styles.buttons}>
          <div class={styles.paragraphSelector}>
            <span class={styles.paragraphLabel}>Paragraphs:</span>
            <Show
              when={paragraphsExpanded()}
              fallback={
                <ToggleButton
                  active
                  variant="outline"
                  size="sm"
                  onClick={() => setParagraphsExpanded(true)}
                  title="Click to change paragraph count"
                >
                  {currentParagraphLabel()}
                </ToggleButton>
              }
            >
              <ButtonGroup>
                <For each={[...PARAGRAPH_OPTIONS]}>
                  {(count) => (
                    <ToggleButton
                      active={currentStoryStore.paragraphsPerTurn === count}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        currentStoryStore.setParagraphsPerTurn(count)
                        setParagraphsExpanded(false)
                      }}
                      title={count === 0 ? 'No paragraph limit' : `Generate ${count} paragraphs`}
                    >
                      {count === 0 ? '∞' : count}
                    </ToggleButton>
                  )}
                </For>
              </ButtonGroup>
            </Show>
          </div>
          <div class={styles.thinkingSelector}>
            <span class={styles.paragraphLabel}>Thinking:</span>
            <Show
              when={thinkingExpanded()}
              fallback={
                <ToggleButton
                  active
                  variant="outline"
                  size="sm"
                  onClick={() => setThinkingExpanded(true)}
                  title="Click to change thinking budget"
                >
                  {currentThinkingLabel()}
                </ToggleButton>
              }
            >
              <ButtonGroup>
                <For each={[...THINKING_OPTIONS]}>
                  {(option) => (
                    <ToggleButton
                      active={settingsStore.thinkingBudget === option.value}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        settingsStore.setThinkingBudget(option.value)
                        setThinkingExpanded(false)
                      }}
                      title={option.value === 0 ? 'No extended thinking' : `Thinking budget: ${option.value} tokens`}
                    >
                      {option.label}
                    </ToggleButton>
                  )}
                </For>
              </ButtonGroup>
            </Show>
          </div>
          <Show when={props.isLoading || props.isAnalyzing}>
            <Button variant="danger" size="sm" onClick={props.onAbort}>
              <BsStopFill /> Stop
            </Button>
          </Show>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => props.onSubmit(true)}
            disabled={!messagesStore.input.trim() || props.isLoading || props.isAnalyzing || !isWritableNodeSelected()}
          >
            Query
          </Button>
          <TokenSelector
            onSubmit={(maxTokens) => props.onAutoOrManualSubmit(false, maxTokens)}
            disabled={
              (!messagesStore.input.trim() && !settingsStore.autoGenerate) ||
              props.isLoading ||
              props.isAnalyzing ||
              !isWritableNodeSelected()
            }
            isLoading={props.isLoading}
            isAnalyzing={props.isAnalyzing}
          />
        </div>
      </div>
    </Show>
  )
}
