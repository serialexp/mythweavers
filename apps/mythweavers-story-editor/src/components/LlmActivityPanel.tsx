import { Alert, Badge, Button, Card, CardBody, Grid, Stack } from '@mythweavers/ui'
import { Component, For, Show, createMemo } from 'solid-js'
import { llmActivityStore } from '../stores/llmActivityStore'
import type { TokenUsage } from '../types/core'
import * as styles from './LlmActivityPanel.css'

const formatTimestamp = (timestamp: number) => {
  const date = new Date(timestamp)
  const time = date.toLocaleTimeString()
  const day = date.toLocaleDateString()
  return `${day} ${time}`
}

const formatTokens = (usage?: TokenUsage) => {
  if (!usage) {
    return 'unknown'
  }
  const input = (usage.input_normal ?? 0) + (usage.input_cache_read ?? 0) + (usage.input_cache_write ?? 0)
  const output = usage.output_normal ?? 0
  return `in ${input} / out ${output}`
}

const formatDuration = (durationMs?: number) => {
  if (durationMs === undefined) {
    return '—'
  }
  if (durationMs < 1000) {
    return `${durationMs.toFixed(0)} ms`
  }
  return `${(durationMs / 1000).toFixed(2)} s`
}

export const LlmActivityPanel: Component = () => {
  const entries = createMemo(() => [...llmActivityStore.entries].sort((a, b) => b.timestamp - a.timestamp))

  return (
    <Stack gap="md" class={styles.container}>
      <div class={styles.header}>
        <div>
          <strong>LLM Activity</strong>
          <span class={styles.callCount}>{entries().length} call(s)</span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => llmActivityStore.clear()}
          disabled={entries().length === 0}
        >
          Clear Log
        </Button>
      </div>

      <Show when={entries().length > 0} fallback={<div class={styles.emptyState}>No LLM calls logged yet.</div>}>
        <div class={styles.entriesList}>
          <For each={entries()}>
            {(entry) => (
              <Card>
                <details>
                  <summary class={styles.summary}>
                    <div class={styles.summaryContent}>
                      <div class={styles.summaryHeader}>
                        <Badge variant="info" size="sm">
                          {entry.type}
                        </Badge>
                        <span class={styles.summaryModel}>
                          {entry.model ?? 'unknown model'}
                          {entry.provider ? ` · ${entry.provider}` : ''}
                        </span>
                      </div>
                      <div class={styles.summaryMeta}>
                        <span>{formatTimestamp(entry.timestamp)}</span>
                        <span>{formatTokens(entry.usage)}</span>
                        <span>{formatDuration(entry.durationMs)}</span>
                        <Show when={entry.requestMessages.filter((msg) => msg.cache_control).length > 0}>
                          <span>cached inputs: {entry.requestMessages.filter((msg) => msg.cache_control).length}</span>
                        </Show>
                        <Show when={entry.error}>
                          <Badge variant="error">error</Badge>
                        </Show>
                      </div>
                    </div>
                  </summary>

                  <CardBody>
                    <Stack gap="md">
                      <div>
                        <div class={styles.sectionLabel}>Input Messages</div>
                        <Stack gap="sm">
                          <For each={entry.requestMessages}>
                            {(message, index) => (
                              <div class={styles.messageBox}>
                                <div class={styles.messageHeader}>
                                  #{index() + 1} · {message.role}
                                  <Show when={message.cache_control}>
                                    {(cache) => (
                                      <Badge variant="info" size="sm">
                                        cache: {cache().type}
                                        {cache().ttl ? ` · ${cache().ttl}` : ''}
                                      </Badge>
                                    )}
                                  </Show>
                                </div>
                                <pre class={styles.preformatted}>{message.content}</pre>
                              </div>
                            )}
                          </For>
                        </Stack>
                      </div>

                      <div>
                        <div class={styles.sectionLabel}>Output</div>
                        <pre class={styles.outputBox}>{entry.response || '<empty response>'}</pre>
                      </div>

                      <Show when={entry.usage}>
                        {(usage) => (
                          <div>
                            <div class={styles.sectionLabel}>Token Usage</div>
                            <Grid cols={4} gap="sm">
                              <div>
                                <span class={styles.statLabel}>Input</span>
                                <span class={styles.statValue}>{usage().input_normal ?? 0}</span>
                              </div>
                              <div>
                                <span class={styles.statLabel}>Cache Read</span>
                                <span class={styles.statValue}>{usage().input_cache_read ?? 0}</span>
                              </div>
                              <div>
                                <span class={styles.statLabel}>Cache Write</span>
                                <span class={styles.statValue}>{usage().input_cache_write ?? 0}</span>
                              </div>
                              <div>
                                <span class={styles.statLabel}>Output</span>
                                <span class={styles.statValue}>{usage().output_normal ?? 0}</span>
                              </div>
                            </Grid>
                          </div>
                        )}
                      </Show>

                      <Show when={entry.rawUsage?.cache_creation}>
                        {(cache) => (
                          <div>
                            <div class={styles.sectionLabel}>Cache Breakdown</div>
                            <Stack gap="xs">
                              <For each={Object.entries(cache())}>
                                {([ttl, value]) => (
                                  <div class={styles.cacheRow}>
                                    <span class={styles.cacheTtl}>{ttl}</span>
                                    <span class={styles.cacheValue}>{value ?? 0}</span>
                                  </div>
                                )}
                              </For>
                            </Stack>
                          </div>
                        )}
                      </Show>

                      <Show when={entry.error}>
                        <Alert variant="error">
                          <div class={styles.errorTitle}>Error</div>
                          <pre class={styles.preformatted}>{entry.error}</pre>
                        </Alert>
                      </Show>
                    </Stack>
                  </CardBody>
                </details>
              </Card>
            )}
          </For>
        </div>
      </Show>
    </Stack>
  )
}
