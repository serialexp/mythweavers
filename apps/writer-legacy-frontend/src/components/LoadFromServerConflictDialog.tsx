import { Show } from 'solid-js'
import { forceLoadFromServer } from '../lib/persistence/load-story-from-server'
import { setShowLoadFromServerConflictDialog, uiState } from '../lib/stores/ui'

export const LoadFromServerConflictDialog = () => {
  const handleConfirm = () => {
    const serverStory = uiState.serverStoryDataForConfirmation
    if (serverStory) {
      forceLoadFromServer(serverStory)
    }
    setShowLoadFromServerConflictDialog(false)
  }

  const handleCancel = () => {
    setShowLoadFromServerConflictDialog(false)
  }

  return (
    <Show when={uiState.showLoadFromServerConflictDialog}>
      <div class="modal modal-open">
        <div class="modal-box">
          <h3 class="font-bold text-lg">Load Conflict</h3>
          <p class="py-4">
            The version of the story on the server is newer than your local version. Loading from the server will
            overwrite your local changes since the last publish.
          </p>
          <p class="py-2 text-sm text-gray-500">(Note: More granular conflict resolution is not yet implemented.)</p>
          <div class="modal-action">
            <button type="button" class="btn btn-error" onClick={handleConfirm}>
              Load & Overwrite Local
            </button>
            <button type="button" class="btn" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Show>
  )
}
