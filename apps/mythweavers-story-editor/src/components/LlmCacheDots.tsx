import { type Component, For, Show, createMemo } from 'solid-js'
import { llmActivityStore } from '../stores/llmActivityStore'
import type { TokenUsage } from '../types/core'
import * as styles from './LlmCacheDots.css'

function getCacheRatio(usage?: TokenUsage): number | null {
  if (!usage) return null
  const totalInput = (usage.input_normal ?? 0) + (usage.input_cache_read ?? 0) + (usage.input_cache_write ?? 0)
  if (totalInput === 0) return null
  return (usage.input_cache_read ?? 0) / totalInput
}

function getCacheColor(ratio: number): string {
  if (ratio < 0.3) return 'var(--danger-color, #dc3545)'
  if (ratio > 0.7) return 'var(--success-color, #28a745)'
  return 'var(--warning-color, #ffc107)'
}

/**
 * Displays the last 5 LLM calls as colored dots indicating cache hit ratio.
 * Clicking opens the LLM activity panel.
 */
export const LlmCacheDots: Component = () => {
  const recentCacheStats = createMemo(() => {
    const entries = llmActivityStore.entries
    return entries
      .slice(-5)
      .map((entry) => ({
        id: entry.id,
        ratio: getCacheRatio(entry.usage),
        type: entry.type,
      }))
      .reverse()
  })

  return (
    <Show when={recentCacheStats().length > 0}>
      <span
        class={styles.cacheDots}
        title="Recent LLM requests: green=cached, yellow=partial, red=uncached"
        onClick={() => llmActivityStore.toggle()}
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
  )
}
