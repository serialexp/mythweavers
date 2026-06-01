import { Dropdown, DropdownItem } from '@mythweavers/ui'
import { Component, For, Show, createSignal, onCleanup } from 'solid-js'
import { PhArrowLeftIcon, PhBookIcon, PhPencilSimpleIcon, PhPlusCircleIcon } from 'solidjs-phosphor'
import { currentStoryStore } from '../../stores/currentStoryStore'
import { nodeStore } from '../../stores/nodeStore'
import { AutoResizeTextarea } from './AutoResizeTextarea'
import { RefinementPreview } from './RefinementPreview'
import * as styles from './Snowflake.css'
import { SnowflakeItem } from './SnowflakeItem'
import { generateBooks } from './actions/generateBooks'
import { rootBooks } from './actions/helpers'
import { refineStoryConcept } from './actions/refineStoryConcept'
import { BOOK_COUNT_OPTIONS } from './constants'
import { snowflakeStore } from './store'

/**
 * The snowflake outliner: a top-down planning surface over the same node tree
 * the navigator shows. Edits go through nodeStore / currentStoryStore, so they
 * persist via saveService and stay in sync with the rest of the editor.
 */
interface SnowflakeViewProps {
  /** Navigate back to the editor; when set, a back button is shown. */
  onBack?: () => void
}

export const SnowflakeView: Component<SnowflakeViewProps> = (props) => {
  const books = () => rootBooks()
  const conceptBusy = () => snowflakeStore.isLoading('story') || snowflakeStore.isLoading('story:refine')

  // Story-concept editor with the same debounced-draft pattern as SnowflakeInput.
  let timer: ReturnType<typeof setTimeout> | undefined
  const [draft, setDraft] = createSignal<string | null>(null)
  onCleanup(() => {
    if (timer) clearTimeout(timer)
  })
  const handleConceptInput = (next: string) => {
    setDraft(next)
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      currentStoryStore.setSummary(next)
      setDraft(null)
    }, 400)
  }

  return (
    <div class={styles.page}>
      <div class={styles.toolbar}>
        <span class={styles.toolbarTitle}>Snowflake outline</span>
        <Show when={props.onBack}>
          <button class={styles.actionButton} onClick={() => props.onBack?.()}>
            <PhArrowLeftIcon />
            Back to editor
          </button>
        </Show>
      </div>
      <div class={styles.scrollArea}>
        <div class={styles.content}>
          <section class={styles.conceptBlock}>
            <span class={styles.sectionLabel}>Story concept</span>
            <AutoResizeTextarea
              class={styles.textarea}
              value={draft() ?? currentStoryStore.summary ?? ''}
              onValueInput={handleConceptInput}
              placeholder="Describe your story in a sentence or two — then expand it into books."
            />
            <div class={styles.conceptControls}>
              <button class={styles.actionButton} disabled={conceptBusy()} onClick={() => void refineStoryConcept()}>
                <PhPencilSimpleIcon />
                Refine concept
              </button>
              <Dropdown
                trigger={
                  <button class={styles.actionButton} disabled={conceptBusy()}>
                    <PhBookIcon />
                    Generate books
                  </button>
                }
              >
                <For each={BOOK_COUNT_OPTIONS}>
                  {(count) => (
                    <DropdownItem onClick={() => void generateBooks(currentStoryStore.summary ?? '', count)}>
                      {`${count} books`}
                    </DropdownItem>
                  )}
                </For>
              </Dropdown>
              <button class={styles.actionButton} onClick={() => nodeStore.addNode(null, 'book')}>
                <PhPlusCircleIcon />
                Add book
              </button>
            </div>
            <RefinementPreview previewKey="story" />
          </section>

          <Show
            when={books().length > 0}
            fallback={
              <div class={styles.emptyState}>No books yet. Generate them from your concept, or add one manually.</div>
            }
          >
            <For each={books()}>{(book) => <SnowflakeItem node={book} />}</For>
          </Show>
        </div>
      </div>
    </div>
  )
}
