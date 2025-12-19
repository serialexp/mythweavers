import { ErrorBoundary, createSignal } from 'solid-js'
import { updateChapter } from '../lib/stores/chapters'
import { currentChapter } from '../lib/stores/retrieval/current-chapter'
import { ChapterPanel } from './ChapterPanel'
import { DateTimePicker } from './DateTimePicker'

export const ChapterTabs = () => {
  const [selectedTab, setSelectedTab] = createSignal('overview')

  // Format the date properly to avoid undefined
  const _formatDate = (dateString: string | undefined) => {
    if (!dateString) return ''
    try {
      return new Date(dateString).toISOString().split('T')[0]
    } catch (_e) {
      return ''
    }
  }

  // Get the current date for the DateTimePicker
  const _getCurrentDate = () => {
    const dateString = currentChapter()?.visibleFrom
    if (!dateString) return new Date()
    try {
      return new Date(dateString)
    } catch (_e) {
      return new Date()
    }
  }

  // Handle date selection from the DateTimePicker
  const _handleDateChange = (date: Date) => {
    const chapterId = currentChapter()?.id
    if (chapterId) {
      updateChapter(chapterId, {
        visibleFrom: date.toISOString(),
      })
    }
  }

  return currentChapter() ? (
    <div class="flex flex-col flex-1 overflow-hidden">
      <div class="tabs tabs-bordered">
        <button
          type="button"
          class={`tab ${selectedTab() === 'overview' ? 'tab-active' : ''}`}
          onClick={() => setSelectedTab('overview')}
        >
          Overview
        </button>
        <button
          type="button"
          class={`tab ${selectedTab() === 'publishing' ? 'tab-active' : ''}`}
          onClick={() => setSelectedTab('publishing')}
        >
          Publishing
        </button>
      </div>
      {selectedTab() === 'overview' && (
        <div class="flex-1 p-0 overflow-hidden">
          <ErrorBoundary fallback={<div>Something went terribly wrong with ChapterPanel</div>}>
            <ChapterPanel />
          </ErrorBoundary>
        </div>
      )}
      {selectedTab() === 'publishing' && (
        <div class="flex-1 p-0 overflow-hidden">
          <div class="flex-1 p-4 h-full overflow-auto">
            <div class="form-control">
              <DateTimePicker
                label="Published At"
                value={currentChapter()?.visibleFrom}
                onChange={(date) => {
                  const chapter = currentChapter()
                  if (chapter) {
                    updateChapter(chapter.id, {
                      ...chapter,
                      visibleFrom: date.toISOString(),
                    })
                  }
                }}
                helpText="This is the date and time the chapter will be visible to readers."
                id={`chapter-${currentChapter()?.id}-publish-date`}
                class="w-full"
              />
              <button
                type="button"
                class="btn btn-sm btn-primary mt-2"
                onClick={() => {
                  const chapter = currentChapter()
                  if (chapter) {
                    updateChapter(chapter.id, {
                      ...chapter,
                      visibleFrom: new Date().toISOString(),
                    })
                  }
                }}
              >
                Set to now
              </button>
            </div>

            {/* Royal Road Publishing Settings */}
            <div class="card bg-base-300 p-4 mb-4 mt-4">
              <h3 class="text-lg font-bold mb-2">Royal Road</h3>
              <div class="form-control">
                <label class="label" for="royalroad-id">
                  Royal Road ID
                </label>
                <input
                  id="royalroad-id"
                  class="input input-bordered"
                  onInput={(e) => {
                    const chapterId = currentChapter()?.id
                    if (chapterId) {
                      const value = e.target.value
                      if (value) {
                        updateChapter(chapterId, {
                          royalRoadId: Number.parseInt(value, 10),
                        })
                      } else {
                        updateChapter(chapterId, {
                          royalRoadId: undefined,
                        })
                      }
                    }
                  }}
                  value={currentChapter()?.royalRoadId?.toString() ?? ''}
                />
                <p class="text-sm text-gray-500">
                  If you've already published this chapter on Royal Road, you can enter the ID here.
                </p>
              </div>

              <div class="mt-4">
                <p class="text-sm text-gray-500">
                  To publish to Royal Road, use the main "Publish" button in the header menu. Your Royal Road
                  credentials are stored locally and only sent to Royal Road during the publishing process.
                </p>
              </div>
            </div>

            {/* Add more publishing platforms here as they are supported */}
          </div>
        </div>
      )}
    </div>
  ) : (
    'No chapter selected'
  )
}
