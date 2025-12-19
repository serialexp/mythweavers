import { Component, Show, createMemo } from 'solid-js'
import { messagesStore } from '../stores/messagesStore'
import { settingsStore } from '../stores/settingsStore'
import { GlobalScriptEditor } from './GlobalScriptEditor'

export const StoryStats: Component = () => {
  const stats = createMemo(() => {
    const model = settingsStore.model
    const provider = settingsStore.provider as 'ollama' | 'openrouter' | 'anthropic' | 'openai' | undefined
    const charsPerToken = settingsStore.charsPerToken
    return messagesStore.getStats(charsPerToken, model, provider)
  })

  const isClaudeModel = createMemo(() => {
    const model = settingsStore.model
    const provider = settingsStore.provider
    return provider === 'anthropic' || model?.toLowerCase().includes('claude')
  })

  return (
    <Show when={messagesStore.hasStoryMessages}>
      <div
        style={{
          padding: '0.5rem 1rem',
          background: 'var(--bg-secondary)',
          'border-bottom': '1px solid var(--border-color)',
          'font-size': '0.85rem',
          color: 'var(--text-secondary)',
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'center',
          gap: '0.5rem',
          position: 'relative',
          transition: 'all 0.3s ease',
          overflow: 'hidden',
        }}
      >
        <span>
          {stats().wordCount} words • ~{stats().estimatedTokens} tokens
          <Show when={isClaudeModel()}>
            <span style={{ opacity: '0.7', 'font-style': 'italic' }} title="Anthropic models cache full content">
              &nbsp;(cached)
            </span>
          </Show>
        </span>
        <GlobalScriptEditor compact={true} />
      </div>
    </Show>
  )
}
