import { FiX } from 'solid-icons/fi'
import { For, Show, createEffect, createSignal } from 'solid-js'
import { type AiCallLog, setShowAiLogPopup, uiState } from '../lib/stores/ui'

export const AiLogPopup = () => {
  const [selectedLog, setSelectedLog] = createSignal<AiCallLog | null>(null)

  createEffect(() => {
    // If the popup is closed, reset the selected log
    if (!uiState.showAiLogPopup) {
      setSelectedLog(null)
    }
  })

  const handleSelectLog = (log: AiCallLog) => {
    setSelectedLog(log)
  }

  return (
    <Show when={uiState.showAiLogPopup}>
      <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div class="bg-base-100 rounded-lg shadow-xl w-full h-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
          <div class="flex justify-between items-center p-4 border-b border-base-300">
            <h2 class="text-xl font-semibold">AI Call History</h2>
            <button type="button" class="btn btn-sm btn-circle btn-ghost" onClick={() => setShowAiLogPopup(false)}>
              <FiX size={20} />
            </button>
          </div>

          <div class="flex flex-1 overflow-hidden">
            {/* Sidebar */}
            <div class="w-1/3 min-w-[200px] max-w-[300px] border-r border-base-300 overflow-y-auto p-2 space-y-1">
              <For each={uiState.aiCallHistory}>
                {(log, _index) => (
                  <button
                    type="button"
                    class="w-full text-left p-2 rounded hover:bg-base-200 focus:outline-none focus:bg-primary focus:text-primary-content"
                    classList={{
                      'bg-base-300 text-primary': selectedLog() === log,
                    }}
                    onClick={() => handleSelectLog(log)}
                  >
                    <div class="text-xs opacity-70">
                      {new Date(log.timestamp).toLocaleString()} - {log.provider} ({log.model})
                    </div>
                    <div class="font-medium truncate">{log.kind}</div>
                  </button>
                )}
              </For>
              <Show when={uiState.aiCallHistory.length === 0}>
                <p class="text-sm text-base-content opacity-70 p-2">No AI calls logged yet.</p>
              </Show>
            </div>

            {/* Main Content */}
            <div class="flex-1 p-4 flex flex-col overflow-hidden">
              <Show
                when={selectedLog()}
                fallback={
                  <p class="text-center text-base-content opacity-70 flex-1 flex items-center justify-center">
                    Select a log entry from the sidebar to view details.
                  </p>
                }
              >
                {(log) => (
                  <div class="flex flex-col flex-1 space-y-4 overflow-hidden">
                    <Show when={log().systemPrompt}>
                      <div class="flex flex-col min-h-0 flex-1">
                        <h3 class="text-lg font-semibold mb-1">System Prompt</h3>
                        <div class="bg-base-200 p-3 rounded overflow-y-auto flex-1">
                          <pre class="text-sm whitespace-pre-wrap break-all">{log().systemPrompt}</pre>
                        </div>
                      </div>
                    </Show>
                    <div class="flex flex-col min-h-0 flex-1">
                      <h3 class="text-lg font-semibold mb-1">
                        Input ({log().inputText.length} chars, {Math.round(log().inputText.length / 3.5)} tokens, $
                        {Math.round((log().inputText.length / 3.5 / 1_000_000) * 3 * 10000) / 10000})
                      </h3>
                      <div class="bg-base-200 p-3 rounded overflow-y-auto flex-1">
                        <pre class="text-sm whitespace-pre-wrap break-all">{log().inputText}</pre>
                      </div>
                    </div>
                    <div class="flex flex-col min-h-0 flex-1">
                      <h3 class="text-lg font-semibold mb-1">
                        Output ({log().outputText.length} chars, {Math.round(log().outputText.length / 3.5)} tokens, $
                        {Math.round((log().outputText.length / 3.5 / 1_000_000) * 3 * 10000) / 10000})
                      </h3>
                      <div class="bg-base-200 p-3 rounded overflow-y-auto flex-1">
                        <pre class="text-sm whitespace-pre-wrap break-all">{log().outputText}</pre>
                      </div>
                    </div>
                  </div>
                )}
              </Show>
            </div>
          </div>
        </div>
      </div>
    </Show>
  )
}
