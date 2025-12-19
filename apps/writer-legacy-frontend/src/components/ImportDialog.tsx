import { FiX } from 'solid-icons/fi'
import { For, Show } from 'solid-js'
import { setImportDialogOpen, uiState } from '../lib/stores/ui'

export const ImportDialog = () => {
  return (
    <Show when={uiState.importDialog.open}>
      <div class="modal modal-open">
        <div class="modal-box relative">
          <button
            class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
            onClick={() => setImportDialogOpen(false)}
            type="button"
            aria-label="Close"
          >
            <FiX size={20} />
          </button>

          <h3 class="font-bold text-lg mb-4">Importing chapters</h3>
          <Show when={uiState.importDialog.chapters && uiState.importDialog.chapters.length > 0}>
            <div class="max-h-60 overflow-y-auto mb-4 pr-2">
              <table class="table table-compact w-full">
                <tbody>
                  <For each={uiState.importDialog.chapters}>
                    {(chapter) => (
                      <tr>
                        <td class="py-1">{chapter.title}</td>
                        <td class="text-right w-10 py-1">
                          {chapter.imported ? (
                            <span class="text-success">✅</span>
                          ) : uiState.importDialog.running ? (
                            <span class="loading loading-spinner loading-xs" />
                          ) : (
                            <span class="text-error">❌</span>
                          )}
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>

          <div class="modal-action mt-4">
            <Show when={uiState.importDialog.complete}>
              <button class="btn btn-primary" type="button" onClick={() => setImportDialogOpen(false)}>
                Close
              </button>
            </Show>
            <Show
              when={
                !uiState.importDialog.running &&
                !uiState.importDialog.complete &&
                uiState.importDialog.chapters.length > 0
              }
            >
              <button class="btn" type="button" onClick={() => setImportDialogOpen(false)}>
                Close (Failed/Cancelled)
              </button>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  )
}
