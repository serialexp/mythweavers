import { For, Show, createMemo, createSignal, onCleanup } from 'solid-js'
import { generationStore } from '../stores/generationStore'
import * as styles from './GenerationProgress.css'

const TAIL_PARAGRAPHS = 2

/**
 * Rendered in place of the editor while a message is being generated.
 *
 * The editor only ever receives complete content, so during generation we show
 * progress (word count / elapsed time) plus the tail of the raw streamed text.
 */
export function GenerationProgress() {
  const [now, setNow] = createSignal(Date.now())
  const timer = setInterval(() => setNow(Date.now()), 500)
  onCleanup(() => clearInterval(timer))

  const elapsedSeconds = createMemo(() => {
    const startedAt = generationStore.state.startedAt
    if (!startedAt) return 0
    return Math.max(0, Math.floor((now() - startedAt) / 1000))
  })

  const elapsedLabel = createMemo(() => {
    const seconds = elapsedSeconds()
    if (seconds < 60) return `${seconds}s`
    return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`
  })

  const wordCount = () => generationStore.state.wordCount

  const tail = createMemo(() =>
    generationStore.state.text
      .split(/\n\n+/)
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => paragraph.length > 0)
      .slice(-TAIL_PARAGRAPHS),
  )

  return (
    <div class={styles.container}>
      <div class={styles.header}>
        <span class={styles.dot} />
        <span class={styles.label}>
          {generationStore.state.phase === 'refining' ? 'Refining clichés…' : 'Generating…'}
        </span>
        <span class={styles.stats}>
          <span>
            {wordCount()} {wordCount() === 1 ? 'word' : 'words'}
          </span>
          <span>·</span>
          <span>{elapsedLabel()}</span>
        </span>
      </div>
      <Show when={tail().length > 0}>
        <div class={styles.tail}>
          <For each={tail()}>{(paragraph) => <p class={styles.tailParagraph}>{paragraph}</p>}</For>
        </div>
      </Show>
    </div>
  )
}
