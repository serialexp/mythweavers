import { type Accessor, For, type JSX, Show, createSignal } from 'solid-js'
import { IconButton } from '../IconButton'
import * as styles from './ListDetailPanel.css'

export interface ListDetailPanelRef {
  /** Select an item by ID, or 'new' for the new item form */
  select: (id: string | 'new') => void
  /** Clear selection and return to list */
  clearSelection: () => void
  /** Get current selection */
  selectedId: Accessor<string>
}

export interface ListDetailPanelProps<T extends { id: string }> {
  /** Array of items to display in the list */
  items: T[]
  /** Ref callback to expose panel methods */
  ref?: (ref: ListDetailPanelRef) => void
  /** Optional header content above the list (e.g., tabs, filters) */
  listHeader?: JSX.Element
  /** Render function for each list item */
  renderListItem: (item: T, isSelected: boolean) => JSX.Element
  /** Render function for the detail view when an item is selected */
  renderDetail: (item: T) => JSX.Element
  /** Optional render function for the "new item" form */
  renderNewForm?: () => JSX.Element
  /** Title shown in detail header when viewing an item */
  detailTitle?: (item: T) => JSX.Element | string
  /** Title shown in detail header when adding new item */
  newItemTitle?: string
  /** Called when selection changes */
  onSelectionChange?: (id: string | null) => void
  /** Back button icon (defaults to "←") */
  backIcon?: JSX.Element
  /** Empty state message when no item is selected */
  emptyStateMessage?: string
  /** Additional class for the container */
  class?: string
}

export function ListDetailPanel<T extends { id: string }>(props: ListDetailPanelProps<T>): JSX.Element {
  const [selectedId, setSelectedId] = createSignal<string>('')

  const selectedItem = () => {
    const id = selectedId()
    if (!id || id === 'new') return null
    return props.items.find((item) => item.id === id) ?? null
  }

  const select = (id: string | 'new') => {
    setSelectedId(id)
    props.onSelectionChange?.(id || null)
  }

  const clearSelection = () => {
    setSelectedId('')
    props.onSelectionChange?.(null)
  }

  // Expose ref methods
  props.ref?.({
    select,
    clearSelection,
    selectedId,
  })

  return (
    <div class={`${styles.container} ${props.class ?? ''}`}>
      {/* List Column */}
      <div class={selectedId() ? `${styles.listColumn} ${styles.listColumnHidden}` : styles.listColumn}>
        <Show when={props.listHeader}>
          <div class={styles.listHeader}>{props.listHeader}</div>
        </Show>
        <div class={styles.listContent}>
          <For each={props.items}>
            {(item) => (
              <button
                class={selectedId() === item.id ? `${styles.listItem} ${styles.listItemSelected}` : styles.listItem}
                onClick={() => select(item.id)}
              >
                {props.renderListItem(item, selectedId() === item.id)}
              </button>
            )}
          </For>
        </div>
      </div>

      {/* Detail Column - always visible on desktop */}
      <div class={selectedId() ? `${styles.detailColumn} ${styles.detailColumnVisible}` : styles.detailColumn}>
        {/* Empty state when nothing selected */}
        <Show when={!selectedId()}>
          <div class={styles.emptyState}>
            <p>{props.emptyStateMessage ?? 'Select an item to view details'}</p>
          </div>
        </Show>

        {/* New Item Form */}
        <Show when={selectedId() === 'new' && props.renderNewForm}>
          <div class={styles.detailHeader}>
            <div class={styles.backButton}>
              <IconButton onClick={clearSelection} aria-label="Back to list" variant="ghost" size="sm">
                {props.backIcon ?? '←'}
              </IconButton>
            </div>
            <h3 class={styles.detailTitle}>{props.newItemTitle ?? 'Add New'}</h3>
          </div>
          <div class={styles.detailContent}>{props.renderNewForm!()}</div>
        </Show>

        {/* Selected Item Detail */}
        <Show when={selectedItem()}>
          {(item) => (
            <>
              <div class={styles.detailHeader}>
                <div class={styles.backButton}>
                  <IconButton onClick={clearSelection} aria-label="Back to list" variant="ghost" size="sm">
                    {props.backIcon ?? '←'}
                  </IconButton>
                </div>
                <h3 class={styles.detailTitle}>
                  {typeof props.detailTitle === 'function' ? props.detailTitle(item()) : 'Details'}
                </h3>
              </div>
              <div class={styles.detailContent}>{props.renderDetail(item())}</div>
            </>
          )}
        </Show>
      </div>
    </div>
  )
}

// Re-export styles for consumers who need custom styling
export { styles as listDetailPanelStyles }
