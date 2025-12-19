import { Button, IconButton, Textarea } from '@mythweavers/ui'
import { BsEye, BsStopFill, BsX } from 'solid-icons/bs'
import { Component, JSX, Show, createMemo } from 'solid-js'
import { messagesStore } from '../stores/messagesStore'
import { nodeStore } from '../stores/nodeStore'
import { settingsStore } from '../stores/settingsStore'
import { viewModeStore } from '../stores/viewModeStore'
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

export const StoryInput: Component<StoryInputProps> = (props) => {
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

  // Inline styles for component-specific layout
  const inputContainerStyle: JSX.CSSProperties = {
    display: 'flex',
    'flex-direction': 'column',
    gap: '10px',
    padding: '20px',
    background: 'var(--bg-secondary)',
    'border-top': '1px solid var(--border-color)',
  }

  const inputWithClearStyle: JSX.CSSProperties = {
    position: 'relative',
    display: 'flex',
    'align-items': 'flex-start',
    gap: '10px',
  }

  const inputActionsStyle: JSX.CSSProperties = {
    display: 'flex',
    'flex-direction': 'column',
    gap: '5px',
  }

  const buttonsStyle: JSX.CSSProperties = {
    display: 'flex',
    gap: '10px',
    'justify-content': 'flex-end',
    'flex-wrap': 'wrap',
    'align-items': 'center',
  }

  const paragraphSelectorStyle: JSX.CSSProperties = {
    'margin-right': 'auto',
    display: 'flex',
    'align-items': 'center',
    gap: '6px',
    padding: '4px 8px',
    background: 'var(--bg-tertiary)',
    'border-radius': '5px',
    border: '1px solid var(--border-color)',
  }

  const paragraphLabelStyle: JSX.CSSProperties = {
    'font-size': '13px',
    color: 'var(--text-secondary)',
    'margin-right': '4px',
  }

  const paragraphButtonStyle = (isActive: boolean): JSX.CSSProperties => ({
    padding: '4px 10px',
    background: isActive ? 'var(--primary-color)' : 'var(--bg-primary)',
    border: `1px solid ${isActive ? 'var(--primary-color)' : 'var(--border-color)'}`,
    'border-radius': '4px',
    color: isActive ? 'white' : 'var(--text-secondary)',
    'font-size': '13px',
    'font-weight': '500',
    cursor: 'pointer',
    'min-width': '28px',
  })

  return (
    <Show when={!viewModeStore.isReadMode()}>
      <div style={inputContainerStyle}>
        <div style={inputWithClearStyle}>
          <Textarea
            value={messagesStore.input}
            onInput={(e) => messagesStore.setInput(e.currentTarget.value)}
            onKeyDown={handleKeyPress}
            placeholder={isWritableNodeSelected() ? 'Enter your story direction...' : 'Select a chapter or scene first...'}
            disabled={props.isLoading || !isWritableNodeSelected()}
            rows={3}
            style={{ flex: '1', 'min-height': '60px', 'max-height': '200px', resize: 'vertical' }}
          />
          <div style={inputActionsStyle}>
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
        <div style={buttonsStyle}>
          <div style={paragraphSelectorStyle}>
            <span style={paragraphLabelStyle}>Paragraphs:</span>
            {[1, 2, 3, 4, 5, 6, 0].map((count) => (
              <button
                style={paragraphButtonStyle(settingsStore.paragraphsPerTurn === count)}
                onClick={() => settingsStore.setParagraphsPerTurn(count)}
                title={count === 0 ? 'No paragraph limit' : `Generate ${count} paragraph${count !== 1 ? 's' : ''}`}
              >
                {count === 0 ? '∞' : count}
              </button>
            ))}
          </div>
          <div style={{ ...paragraphSelectorStyle, 'margin-right': '0' }}>
            <span style={paragraphLabelStyle}>Thinking:</span>
            {[
              { value: 0, label: 'Off' },
              { value: 1024, label: 'Low' },
              { value: 2048, label: 'Med' },
              { value: 4096, label: 'High' },
            ].map((option) => (
              <button
                style={paragraphButtonStyle(settingsStore.thinkingBudget === option.value)}
                onClick={() => settingsStore.setThinkingBudget(option.value)}
                title={option.value === 0 ? 'No extended thinking' : `Thinking budget: ${option.value} tokens`}
              >
                {option.label}
              </button>
            ))}
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
