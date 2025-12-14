import { Component, For, Show, createMemo } from "solid-js";
import { llmActivityStore } from "../stores/llmActivityStore";
import type { TokenUsage } from "../types/core";
import styles from "./LlmActivityPanel.module.css";

const formatTimestamp = (timestamp: number) => {
  const date = new Date(timestamp);
  const time = date.toLocaleTimeString();
  const day = date.toLocaleDateString();
  return `${day} ${time}`;
};

const formatTokens = (usage?: TokenUsage) => {
  if (!usage) {
    return "unknown";
  }
  const input =
    (usage.input_normal ?? 0) +
    (usage.input_cache_read ?? 0) +
    (usage.input_cache_write ?? 0);
  const output = usage.output_normal ?? 0;
  return `in ${input} / out ${output}`;
};

const formatDuration = (durationMs?: number) => {
  if (durationMs === undefined) {
    return "—";
  }
  if (durationMs < 1000) {
    return `${durationMs.toFixed(0)} ms`;
  }
  return `${(durationMs / 1000).toFixed(2)} s`;
};

export const LlmActivityPanel: Component = () => {
  const entries = createMemo(() =>
    [...llmActivityStore.entries].sort((a, b) => b.timestamp - a.timestamp),
  );

  return (
    <div class={styles.container}>
      <div class={styles.headerRow}>
        <div>
          <strong>LLM Activity</strong>
          <span class={styles.entryCount}>{entries().length} call(s)</span>
        </div>
        <button
          class={styles.clearButton}
          onClick={() => llmActivityStore.clear()}
          disabled={entries().length === 0}
        >
          Clear Log
        </button>
      </div>

      <Show
        when={entries().length > 0}
        fallback={<div class={styles.emptyState}>No LLM calls logged yet.</div>}
      >
        <div class={styles.entryList}>
          <For each={entries()}>
            {(entry) => (
              <details class={styles.entry} open={false}>
                <summary class={styles.entrySummary}>
                  <div class={styles.entrySummaryMain}>
                    <span class={styles.entryType}>{entry.type}</span>
                    <span class={styles.entryModel}>
                      {entry.model ?? "unknown model"}
                      {entry.provider ? ` · ${entry.provider}` : ""}
                    </span>
                  </div>
                  <div class={styles.entrySummaryMeta}>
                    <span>{formatTimestamp(entry.timestamp)}</span>
                    <span>{formatTokens(entry.usage)}</span>
                    <span>{formatDuration(entry.durationMs)}</span>
                    <Show
                      when={
                        entry.requestMessages.filter((msg) => msg.cache_control)
                          .length > 0
                      }
                    >
                      <span>
                        cached inputs:{" "}
                        {
                          entry.requestMessages.filter(
                            (msg) => msg.cache_control,
                          ).length
                        }
                      </span>
                    </Show>
                    <Show when={entry.error}>
                      <span class={styles.entryErrorBadge}>error</span>
                    </Show>
                  </div>
                </summary>

                <div class={styles.section}>
                  <div class={styles.sectionTitle}>Input Messages</div>
                  <For each={entry.requestMessages}>
                    {(message, index) => (
                      <div class={styles.messageBlock}>
                        <div class={styles.messageMeta}>
                          #{index() + 1} · {message.role}
                          <Show when={message.cache_control}>
                            {(cache) => (
                              <span class={styles.cacheBadge}>
                                cache: {cache().type}
                                {cache().ttl ? ` · ${cache().ttl}` : ""}
                              </span>
                            )}
                          </Show>
                        </div>
                        <pre class={styles.messageContent}>
                          {message.content}
                        </pre>
                      </div>
                    )}
                  </For>
                </div>

                <div class={styles.section}>
                  <div class={styles.sectionTitle}>Output</div>
                  <pre class={styles.responseContent}>
                    {entry.response || "<empty response>"}
                  </pre>
                </div>

                <Show when={entry.usage}>
                  {(usage) => (
                    <div class={styles.section}>
                      <div class={styles.sectionTitle}>Token Usage</div>
                      <div class={styles.usageGrid}>
                        <div>
                          <span class={styles.usageLabel}>Input</span>
                          <span class={styles.usageValue}>
                            {usage().input_normal ?? 0}
                          </span>
                        </div>
                        <div>
                          <span class={styles.usageLabel}>Cache Read</span>
                          <span class={styles.usageValue}>
                            {usage().input_cache_read ?? 0}
                          </span>
                        </div>
                        <div>
                          <span class={styles.usageLabel}>Cache Write</span>
                          <span class={styles.usageValue}>
                            {usage().input_cache_write ?? 0}
                          </span>
                        </div>
                        <div>
                          <span class={styles.usageLabel}>Output</span>
                          <span class={styles.usageValue}>
                            {usage().output_normal ?? 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </Show>

                <Show when={entry.rawUsage?.cache_creation}>
                  {(cache) => (
                    <div class={styles.section}>
                      <div class={styles.sectionSubtitle}>Cache Breakdown</div>
                      <div class={styles.cacheGrid}>
                        <For each={Object.entries(cache())}>
                          {([ttl, value]) => (
                            <div class={styles.cacheRow}>
                              <span class={styles.cacheLabel}>{ttl}</span>
                              <span class={styles.cacheValue}>{value ?? 0}</span>
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  )}
                </Show>

                <Show when={entry.error}>
                  <div class={`${styles.section} ${styles.errorSection}`}>
                    <div class={styles.sectionTitle}>Error</div>
                    <pre class={styles.errorContent}>{entry.error}</pre>
                  </div>
                </Show>
              </details>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};
