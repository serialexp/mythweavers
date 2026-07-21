import { Dropdown, DropdownItem } from '@mythweavers/ui'
import { Component, For, Show, createSignal, onCleanup } from 'solid-js'
import { PhArrowLeftIcon, PhBookIcon, PhPencilSimpleIcon, PhPlusCircleIcon } from 'solidjs-phosphor'
import { saveService } from '../../services/saveService'
import { currentStoryStore } from '../../stores/currentStoryStore'
import { nodeStore } from '../../stores/nodeStore'
import { SplitSceneModal } from '../SplitSceneModal'
import { AutoResizeTextarea } from './AutoResizeTextarea'
import { RefinementPreview } from './RefinementPreview'
import * as styles from './Snowflake.css'
import { SnowflakeItem } from './SnowflakeItem'
import { generateBooks } from './actions/generateBooks'
import { rootBooks } from './actions/helpers'
import { refineStoryConcept } from './actions/refineStoryConcept'
import { BOOK_COUNT_OPTIONS, LEVEL_DESCRIPTIONS, type RefinementLevel } from './constants'
import { snowflakeStore } from './store'

const DETAIL_LEVELS: RefinementLevel[] = [1, 2, 3]

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

  // Scene-split modal state. The modal reads everything else from the global
  // stores, so all we track here is which scene is being split.
  const [splitTargetId, setSplitTargetId] = createSignal<string | null>(null)
  const handleSplitScene = (nodeId: string) => setSplitTargetId(nodeId)

  // Story-concept editor with the same debounced-draft pattern as SnowflakeInput.
  let timer: ReturnType<typeof setTimeout> | undefined
  const [draft, setDraft] = createSignal<string | null>(null)
  onCleanup(() => {
    if (timer) clearTimeout(timer)
    const next = draft()
    if (next !== null) {
      currentStoryStore.setSummary(next)
      void saveService.flushPendingSaves()
    }
  })
  const handleConceptInput = (next: string) => {
    setDraft(next)
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      currentStoryStore.setSummary(next)
      setDraft(null)
    }, 400)
  }

  return (
    <div class={styles.page}>
      <div class={styles.toolbar}>
        <div class={styles.toolbarLeft}>
          <span class={styles.toolbarTitle}>Snowflake outline</span>
          <div class={styles.levelControl} role="group" aria-label="Summary detail level">
            <For each={DETAIL_LEVELS}>
              {(level) => (
                <button
                  type="button"
                  class={level === snowflakeStore.displayLevel ? styles.levelButtonActive : styles.levelButton}
                  onClick={() => snowflakeStore.setDisplayLevel(level)}
                  title={LEVEL_DESCRIPTIONS[level]}
                  aria-pressed={level === snowflakeStore.displayLevel}
                >
                  {`L${level}`}
                </button>
              )}
            </For>
          </div>
        </div>
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
            <For each={books()}>{(book) => <SnowflakeItem node={book} onSplitScene={handleSplitScene} />}</For>
          </Show>
        </div>
      </div>

      <SplitSceneModal
        isOpen={splitTargetId() !== null}
        onClose={() => setSplitTargetId(null)}
        targetNodeId={splitTargetId()}
      />
    </div>
  )
}
