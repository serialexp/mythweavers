import { Component, Show, createMemo } from 'solid-js'
import { useAnimatedNumber } from '../hooks/useAnimatedNumber'
import { messagesStore } from '../stores/messagesStore'
import { effectiveSettings } from '../stores/effectiveSettingsStore'
import { settingsStore } from '../stores/settingsStore'
import { GlobalScriptEditor } from './GlobalScriptEditor'
import { LlmCacheDots } from './LlmCacheDots'
import * as styles from './StoryStats.css'

export const StoryStats: Component = () => {
  const stats = createMemo(() => {
    const model = effectiveSettings.model
    const provider = effectiveSettings.provider as 'ollama' | 'openrouter' | 'anthropic' | 'openai' | undefined
    const charsPerToken = settingsStore.charsPerToken
    return messagesStore.getStats(charsPerToken, model, provider)
  })

  const displayWordCount = useAnimatedNumber(() => stats().wordCount)
  const displayTokenCount = useAnimatedNumber(() => stats().estimatedTokens)

  const isClaudeModel = createMemo(() => {
    const model = effectiveSettings.model
    const provider = effectiveSettings.provider
    return provider === 'anthropic' || model?.toLowerCase().includes('claude')
  })

  return (
    <Show when={messagesStore.hasStoryMessages}>
      <div class={styles.container}>
        <span>
          {displayWordCount()} words • ~{displayTokenCount()} tokens
          <Show when={isClaudeModel()}>
            <span class={styles.cachedNote} title="Anthropic models cache full content">
              &nbsp;(cached)
            </span>
          </Show>
        </span>
        <LlmCacheDots />
        <GlobalScriptEditor compact={true} />
      </div>
    </Show>
  )
}
