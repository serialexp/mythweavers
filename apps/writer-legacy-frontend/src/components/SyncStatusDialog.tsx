import type { Difference, EntityType } from '@writer/shared'
import { For, Show, createMemo } from 'solid-js'
import { arcsStore } from '../lib/stores/arcs'
import { booksStore } from '../lib/stores/books'
import { chaptersState } from '../lib/stores/chapters'
import { scenesState } from '../lib/stores/scenes'
import { storyState } from '../lib/stores/story'
import { setShowSyncStatusDialog, uiState } from '../lib/stores/ui'

// Helper to format timestamp (optional)
const formatTimestamp = (timestamp?: number): string => {
  if (!timestamp) return 'N/A'
  return new Date(timestamp).toLocaleString()
}

// Helper to get entity name/title from local stores
const getEntityName = (id: string, type: EntityType): string | undefined => {
  const story = storyState.story // Access the nested story object
  if (!story) return undefined

  switch (type) {
    case 'Book':
      return booksStore.books?.[id]?.title
    case 'Arc':
      return arcsStore.arcs?.[id]?.title
    case 'Chapter':
      return chaptersState.chapters?.[id]?.title
    case 'Scene':
      return scenesState.scenes?.[id]?.title
    case 'Paragraph':
      return undefined // Paragraphs don't have names
    default:
      return undefined
  }
}

const DifferenceList = (props: { title: string; items: Difference[] }) => (
  <Show when={props.items.length > 0}>
    <h4 class="font-semibold mt-3 mb-1">
      {props.title} ({props.items.length}):
    </h4>
    <ul class="list-disc list-inside text-sm max-h-40 overflow-y-auto bg-base-200 p-2 rounded">
      <For each={props.items}>
        {(item) => {
          const name = createMemo(() => getEntityName(item.id, item.type))
          return (
            <li>
              {item.type} - {name() ? `${name()} (${item.id})` : item.id}
              <span class="text-xs text-gray-500 ml-2">
                (Local: {formatTimestamp(item.localTimestamp)}, Server: {formatTimestamp(item.serverTimestamp)})
              </span>
            </li>
          )
        }}
      </For>
    </ul>
  </Show>
)

export const SyncStatusDialog = () => {
  const handleClose = () => {
    setShowSyncStatusDialog(false)
  }

  const differences = () => uiState.syncState

  return (
    <Show when={uiState.showSyncStatusDialog && differences()}>
      <div class="modal modal-open">
        <div class="modal-box w-11/12 max-w-2xl">
          <h3 class="font-bold text-lg">Sync Status Details</h3>

          <p class="py-2 text-sm">Comparison of local items and server items based on modification times.</p>

          <DifferenceList title="New Locally (Not on Server)" items={differences()?.localNew ?? []} />
          <DifferenceList title="New on Server (Not Local)" items={differences()?.serverNew ?? []} />
          <DifferenceList title="Modified Locally (Newer than Server)" items={differences()?.modifiedLocal ?? []} />
          <DifferenceList title="Modified on Server (Newer than Local)" items={differences()?.modifiedServer ?? []} />
          <DifferenceList title="In Sync" items={differences()?.inSync ?? []} />

          <div class="modal-action">
            <button type="button" class="btn" onClick={handleClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </Show>
  )
}
