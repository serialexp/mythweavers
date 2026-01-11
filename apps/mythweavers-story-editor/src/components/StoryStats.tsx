import { Component, For, Show, createMemo } from 'solid-js'
import { llmActivityStore } from '../stores/llmActivityStore'
import { messagesStore } from '../stores/messagesStore'
import { settingsStore } from '../stores/settingsStore'
import { GlobalScriptEditor } from './GlobalScriptEditor'
import * as styles from './StoryStats.css'

/**
 * Calculate cache ratio for an LLM activity entry.
 * Returns a value between 0 (no cache) and 1 (fully cached).
 */
function getCacheRatio(usage?: { input_normal: number; input_cache_read: number; input_cache_write: number }) {
  if (!usage) return null
  const totalInput = usage.input_normal + usage.input_cache_read + usage.input_cache_write
  if (totalInput === 0) return null
  return usage.input_cache_read / totalInput
}

/**
 * Get color for cache ratio: red (0) -> yellow (0.5) -> green (1)
 */
function getCacheColor(ratio: number): string {
  if (ratio < 0.3) return 'var(--danger-color, #dc3545)'
  if (ratio > 0.7) return 'var(--success-color, #28a745)'
  return 'var(--warning-color, #ffc107)'
}

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

  // Get last 5 LLM requests with cache info
  const recentCacheStats = createMemo(() => {
    const entries = llmActivityStore.entries
    return entries
      .slice(-5)
      .map((entry) => ({
        id: entry.id,
        ratio: getCacheRatio(entry.usage),
        type: entry.type,
      }))
      .reverse() // Most recent first
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
        <Show when={recentCacheStats().length > 0}>
          <span
            class={styles.cacheDots}
            title="Recent LLM requests: green=cached, yellow=partial, red=uncached"
            onClick={() => llmActivityStore.show()}
          >
            <For each={recentCacheStats()}>
              {(stat) => (
                <span
                  class={styles.cacheDot}
                  style={{
                    background: stat.ratio !== null ? getCacheColor(stat.ratio) : 'var(--text-muted, #666)',
                  }}
                  title={
                    stat.ratio !== null
                      ? `${stat.type}: ${Math.round(stat.ratio * 100)}% cached`
                      : `${stat.type}: no cache info`
                  }
                />
              )}
            </For>
          </span>
        </Show>
        <GlobalScriptEditor compact={true} />
      </div>
    </Show>
  )
}
