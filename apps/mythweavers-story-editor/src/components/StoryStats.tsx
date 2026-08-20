import { Component, Show, createMemo } from 'solid-js'
import { useAnimatedNumber } from '../hooks/useAnimatedNumber'
import { currentStoryStore } from '../stores/currentStoryStore'
import { effectiveSettings } from '../stores/effectiveSettingsStore'
import { messagesStore } from '../stores/messagesStore'
import { nodeStore } from '../stores/nodeStore'
import { settingsStore } from '../stores/settingsStore'
import { GlobalScriptEditor } from './GlobalScriptEditor'
import { LlmCacheDots } from './LlmCacheDots'
import * as styles from './StoryStats.css'

export const StoryStats: Component = () => {
  const stats = createMemo(() => {
    const model = effectiveSettings.model
    const provider = effectiveSettings.provider as 'ollama' | 'openrouter' | 'anthropic' | 'openai' | undefined
    const charsPerToken = settingsStore.charsPerToken
    const loadedStats = messagesStore.getStats(charsPerToken, model, provider)
    if (currentStoryStore.storageMode !== 'server') return loadedStats

    const wordCount = nodeStore.totalWordCount
    // The legacy estimate is character-based. For lazy server stories, use a
    // conservative average English word length plus one separator per word so
    // the header remains whole-story scoped without loading its prose.
    const estimatedCharacters = wordCount * 6
    return {
      wordCount,
      charCount: estimatedCharacters,
      estimatedTokens: Math.ceil(estimatedCharacters / charsPerToken),
    }
  })

  const displayWordCount = useAnimatedNumber(() => stats().wordCount)
  const displayTokenCount = useAnimatedNumber(() => stats().estimatedTokens)

  const isClaudeModel = createMemo(() => {
    const model = effectiveSettings.model
    const provider = effectiveSettings.provider
    return provider === 'anthropic' || model?.toLowerCase().includes('claude')
  })

  return (
    <Show
      when={
        messagesStore.hasStoryMessages || (currentStoryStore.storageMode === 'server' && nodeStore.totalWordCount > 0)
      }
    >
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
