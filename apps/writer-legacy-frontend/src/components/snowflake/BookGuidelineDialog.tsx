import { Show } from 'solid-js'
import { storyState } from '../../lib/stores/story'
import { treeState } from '../../lib/stores/tree'
import { AutoResizeTextarea } from '../AutoResizeTextarea'
import {
  acceptGeneratedBook,
  bookGuideline,
  generateBooks,
  generatedBookContent,
  isGenerating,
  setBookGuideline,
  setGeneratedBookContent,
  setShowBookGuidelineDialog,
  setTotalBookCount,
  showBookGuidelineDialog,
  totalBookCount,
} from './actions/generateBooks'

export const BookGuidelineDialog = () => {
  const currentBookNumber = () => (treeState.structure?.length ?? 0) + 1

  return (
    <Show when={showBookGuidelineDialog()}>
      <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div class="bg-base-100 p-4 rounded-lg w-[800px] max-w-[90vw] max-h-[90vh] overflow-y-auto">
          <h3 class="font-bold text-lg mb-4">
            Book {currentBookNumber()}
            <Show when={totalBookCount()}> of {totalBookCount()}</Show>
          </h3>

          <div class="form-control mb-4">
            <label class="label">
              <span class="label-text">Total number of books in series:</span>
            </label>
            <input
              type="number"
              class="input input-bordered w-full"
              value={totalBookCount()}
              min={currentBookNumber()}
              onChange={(e) => setTotalBookCount(Number.parseInt(e.currentTarget.value) || 0)}
              placeholder="Enter total number of books..."
            />
          </div>

          <div class="form-control mb-4">
            <label class="label">
              <span class="label-text">Guidelines for this book:</span>
            </label>
            <AutoResizeTextarea
              class="textarea textarea-bordered w-full"
              value={bookGuideline()}
              placeholder="Enter any specific requirements or guidelines for this book (optional)..."
              onInput={(e) => {
                if (e.currentTarget) {
                  setBookGuideline(e.currentTarget.value)
                  setGeneratedBookContent(null)
                }
              }}
            />
          </div>

          <div class="flex justify-end gap-2 mb-4">
            <button
              type="button"
              class="btn btn-ghost"
              onClick={() => {
                setShowBookGuidelineDialog(false)
              }}
            >
              Close
            </button>
            <Show
              when={generatedBookContent()}
              fallback={
                <button
                  type="button"
                  class="btn btn-primary"
                  onClick={() =>
                    generateBooks(storyState.story?.oneliner ?? '', 1, currentBookNumber() - 1, bookGuideline(), true)
                  }
                  disabled={isGenerating()}
                >
                  {isGenerating() ? <span class="loading loading-spinner loading-xs" /> : 'Generate'}
                </button>
              }
            >
              <button type="button" class="btn btn-primary" onClick={acceptGeneratedBook}>
                Accept & Create Book
              </button>
            </Show>
          </div>

          <Show when={generatedBookContent()}>
            <div class="border rounded-lg p-4 bg-base-200">
              <h4 class="font-bold mb-2">Generated Content:</h4>
              <pre class="whitespace-pre-wrap">{generatedBookContent()}</pre>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  )
}
