import { Alert, Badge, Button, Card, CardBody, Grid, Stack } from '@mythweavers/ui'
import { Component, For, Show, createMemo } from 'solid-js'
import { llmActivityStore } from '../stores/llmActivityStore'
import type { TokenUsage } from '../types/core'

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
    <Stack gap="md" style={{ height: '100%' }}>
      <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between', gap: '0.75rem' }}>
        <div>
          <strong>LLM Activity</strong>
          <span style={{ 'margin-left': '0.5rem', color: 'var(--text-secondary)', 'font-size': '0.9rem' }}>
            {entries().length} call(s)
          </span>
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

      <Show
        when={entries().length > 0}
        fallback={
          <div
            style={{
              padding: '2rem',
              'text-align': 'center',
              color: 'var(--text-secondary)',
              border: '1px dashed var(--border-color)',
              'border-radius': '8px',
            }}
          >
            No LLM calls logged yet.
          </div>
        }
      >
        <div style={{ flex: '1', 'overflow-y': 'auto', display: 'flex', 'flex-direction': 'column', gap: '0.75rem' }}>
          <For each={entries()}>
            {(entry) => (
              <Card>
                <details>
                  <summary style={{ cursor: 'pointer', padding: '0.75rem' }}>
                    <div style={{ display: 'flex', 'flex-direction': 'column', gap: '0.35rem' }}>
                      <div style={{ display: 'flex', 'align-items': 'center', gap: '0.5rem', 'font-weight': '600' }}>
                        <Badge variant="info" size="sm">
                          {entry.type}
                        </Badge>
                        <span style={{ 'font-size': '0.85rem', color: 'var(--text-secondary)' }}>
                          {entry.model ?? 'unknown model'}
                          {entry.provider ? ` · ${entry.provider}` : ''}
                        </span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          'flex-wrap': 'wrap',
                          gap: '0.75rem',
                          'font-size': '0.8rem',
                          color: 'var(--text-secondary)',
                        }}
                      >
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
                        <div
                          style={{
                            'font-size': '0.85rem',
                            'text-transform': 'uppercase',
                            'letter-spacing': '0.05em',
                            color: 'var(--text-secondary)',
                            'margin-bottom': '0.5rem',
                          }}
                        >
                          Input Messages
                        </div>
                        <Stack gap="sm">
                          <For each={entry.requestMessages}>
                            {(message, index) => (
                              <div
                                style={{
                                  border: '1px solid var(--border-color)',
                                  'border-radius': '6px',
                                  padding: '0.5rem',
                                  background: 'var(--bg-tertiary)',
                                }}
                              >
                                <div
                                  style={{
                                    'font-size': '0.75rem',
                                    color: 'var(--text-secondary)',
                                    'margin-bottom': '0.25rem',
                                    display: 'flex',
                                    'align-items': 'center',
                                    gap: '0.5rem',
                                  }}
                                >
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
                                <pre
                                  style={{
                                    margin: '0',
                                    'font-family': 'var(--mono-font, monospace)',
                                    'font-size': '0.85rem',
                                    'white-space': 'pre-wrap',
                                  }}
                                >
                                  {message.content}
                                </pre>
                              </div>
                            )}
                          </For>
                        </Stack>
                      </div>

                      <div>
                        <div
                          style={{
                            'font-size': '0.85rem',
                            'text-transform': 'uppercase',
                            'letter-spacing': '0.05em',
                            color: 'var(--text-secondary)',
                            'margin-bottom': '0.5rem',
                          }}
                        >
                          Output
                        </div>
                        <pre
                          style={{
                            margin: '0',
                            padding: '0.5rem',
                            border: '1px solid var(--border-color)',
                            'border-radius': '6px',
                            background: 'var(--bg-tertiary)',
                            'font-family': 'var(--mono-font, monospace)',
                            'font-size': '0.85rem',
                            'white-space': 'pre-wrap',
                          }}
                        >
                          {entry.response || '<empty response>'}
                        </pre>
                      </div>

                      <Show when={entry.usage}>
                        {(usage) => (
                          <div>
                            <div
                              style={{
                                'font-size': '0.85rem',
                                'text-transform': 'uppercase',
                                'letter-spacing': '0.05em',
                                color: 'var(--text-secondary)',
                                'margin-bottom': '0.5rem',
                              }}
                            >
                              Token Usage
                            </div>
                            <Grid cols={4} gap="sm">
                              <div>
                                <span
                                  style={{ display: 'block', 'font-size': '0.75rem', color: 'var(--text-secondary)' }}
                                >
                                  Input
                                </span>
                                <span style={{ 'font-weight': '600', 'font-size': '0.95rem' }}>
                                  {usage().input_normal ?? 0}
                                </span>
                              </div>
                              <div>
                                <span
                                  style={{ display: 'block', 'font-size': '0.75rem', color: 'var(--text-secondary)' }}
                                >
                                  Cache Read
                                </span>
                                <span style={{ 'font-weight': '600', 'font-size': '0.95rem' }}>
                                  {usage().input_cache_read ?? 0}
                                </span>
                              </div>
                              <div>
                                <span
                                  style={{ display: 'block', 'font-size': '0.75rem', color: 'var(--text-secondary)' }}
                                >
                                  Cache Write
                                </span>
                                <span style={{ 'font-weight': '600', 'font-size': '0.95rem' }}>
                                  {usage().input_cache_write ?? 0}
                                </span>
                              </div>
                              <div>
                                <span
                                  style={{ display: 'block', 'font-size': '0.75rem', color: 'var(--text-secondary)' }}
                                >
                                  Output
                                </span>
                                <span style={{ 'font-weight': '600', 'font-size': '0.95rem' }}>
                                  {usage().output_normal ?? 0}
                                </span>
                              </div>
                            </Grid>
                          </div>
                        )}
                      </Show>

                      <Show when={entry.rawUsage?.cache_creation}>
                        {(cache) => (
                          <div>
                            <div
                              style={{
                                'font-size': '0.8rem',
                                'text-transform': 'uppercase',
                                'letter-spacing': '0.06em',
                                color: 'var(--text-secondary)',
                                'margin-bottom': '0.5rem',
                              }}
                            >
                              Cache Breakdown
                            </div>
                            <Stack gap="xs">
                              <For each={Object.entries(cache())}>
                                {([ttl, value]) => (
                                  <div
                                    style={{
                                      display: 'flex',
                                      'align-items': 'center',
                                      'justify-content': 'space-between',
                                      padding: '0.25rem 0',
                                      'border-bottom': '1px dashed rgba(148, 163, 184, 0.4)',
                                    }}
                                  >
                                    <span style={{ 'font-size': '0.75rem', color: 'var(--text-secondary)' }}>
                                      {ttl}
                                    </span>
                                    <span style={{ 'font-size': '0.85rem', 'font-weight': '600' }}>{value ?? 0}</span>
                                  </div>
                                )}
                              </For>
                            </Stack>
                          </div>
                        )}
                      </Show>

                      <Show when={entry.error}>
                        <Alert variant="error">
                          <div style={{ 'font-weight': '600', 'margin-bottom': '0.25rem' }}>Error</div>
                          <pre
                            style={{
                              margin: '0',
                              'font-family': 'var(--mono-font, monospace)',
                              'font-size': '0.85rem',
                              'white-space': 'pre-wrap',
                            }}
                          >
                            {entry.error}
                          </pre>
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
