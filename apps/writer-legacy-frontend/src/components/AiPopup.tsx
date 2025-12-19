import markdownit from 'markdown-it'
import { createSignal } from 'solid-js'
import { settingsState } from '../lib/stores/settings.ts'
import { addAiResponse, setAiOpenTab, setAiPopupOpen, setAiPrompt, uiState } from '../lib/stores/ui.ts'
import { useAi } from '../lib/use-ai.ts'
import { FormField } from './styled/FormField.tsx'
const md = markdownit()

export const AiPopup = () => {
  const [loading, setLoading] = createSignal(false)

  return (
    <div class={`modal ${uiState.aiPopupOpen ? 'modal-open' : ''}`}>
      <div class="modal-backdrop" onClick={() => setAiPopupOpen(false)} />
      <div class="modal-box flex flex-col gap-2 overflow-hidden">
        <h3 class="font-bold text-lg">
          Quick Question to {settingsState.aiSource} {settingsState.aiModel}
        </h3>
        <FormField label="Prompt">
          <textarea
            class="textarea textarea-bordered w-full"
            value={uiState.aiPrompt ?? ''}
            onInput={(e) => setAiPrompt(e.currentTarget.value)}
          />
        </FormField>
        <div class="flex justify-end">
          <button
            type="button"
            class="btn btn-primary"
            onClick={() => {
              setLoading(true)
              useAi('free', uiState.aiPrompt ?? '', false)
                .then((res) => {
                  if (res) {
                    addAiResponse(res)
                    setAiOpenTab(0)
                  }
                })
                .finally(() => {
                  setLoading(false)
                })
            }}
          >
            {loading() ? <span class="loading loading-spinner" /> : 'Send'}
          </button>
        </div>
        <div class="flex gap-4 min-h-8 items-center overflow-hidden">
          <div class="text-sm">Response history</div>
          <div class="flex-1 tabs tabs-bordered">
            {uiState.aiResponseHistory?.map((_response, index) => (
              <button
                type="button"
                class={`tab ${uiState.aiOpenTab === index ? 'tab-active' : ''}`}
                onClick={() => setAiOpenTab(index)}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>
        {uiState.aiResponseHistory?.[uiState.aiOpenTab ?? 0] && (
          <div
            class="mt-4 flex-1 bg-base-200 p-4 rounded-lg space-y-2 overflow-y-auto"
            innerHTML={md.render(uiState.aiResponseHistory?.[uiState.aiOpenTab ?? 0] ?? '')}
          />
        )}
      </div>
    </div>
  )
}
