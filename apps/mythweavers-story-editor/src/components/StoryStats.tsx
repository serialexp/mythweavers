import { Component, Show, createMemo } from 'solid-js'
import { messagesStore } from '../stores/messagesStore'
import { settingsStore } from '../stores/settingsStore'
import { GlobalScriptEditor } from './GlobalScriptEditor'
import * as styles from './StoryStats.css'

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
      <div class={styles.container}>
        <span>
          {stats().wordCount} words • ~{stats().estimatedTokens} tokens
          <Show when={isClaudeModel()}>
            <span class={styles.cachedNote} title="Anthropic models cache full content">
              &nbsp;(cached)
            </span>
          </Show>
        </span>
        <GlobalScriptEditor compact={true} />
      </div>
    </Show>
  )
}
