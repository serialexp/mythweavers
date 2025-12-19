import { For, Show } from 'solid-js'
import { createArc } from '../../lib/stores/arcs'
import { createBook } from '../../lib/stores/books'
import { createChapter } from '../../lib/stores/chapters'
import { addNotification } from '../../lib/stores/notifications'
import { createScene } from '../../lib/stores/scenes'
import { setStoryProperty, storyState } from '../../lib/stores/story'
import { treeState } from '../../lib/stores/tree'
import { AutoResizeTextarea } from '../AutoResizeTextarea'
import { BookGuidelineDialog } from './BookGuidelineDialog'
import { RefinementPreview } from './RefinementPreview'
import { SnowflakeItem } from './SnowflakeItem'
import { generateBooks, setShowBookGuidelineDialog } from './actions/generateBooks'
import { refineStoryConcept } from './actions/refineStoryConcept'
import { BOOK_COUNT_OPTIONS } from './constants'
import { loadingStates, setStoryRefinement, storyRefinement } from './store'

export const SnowflakeView = () => {
  return (
    <div class="p-4">
      <BookGuidelineDialog />
      <div class="">
        {/* Story Level Summary */}
        <div class="mb-8">
          <div class="font-bold text-xl mb-2 flex justify-between items-center">
            <span>Story</span>
            <div class="flex gap-2">
              <Show when={storyState.story?.oneliner}>
                <button
                  type="button"
                  class="btn btn-ghost btn-xs"
                  onClick={refineStoryConcept}
                  title="Refine story concept"
                >
                  {loadingStates.story_refine ? <span class="loading loading-spinner loading-xs" /> : '✨'}
                </button>
                <button
                  type="button"
                  class="btn btn-ghost btn-xs"
                  onClick={() => setShowBookGuidelineDialog(true)}
                  disabled={loadingStates.story_expand}
                >
                  {loadingStates.story_expand ? (
                    <span class="loading loading-spinner loading-xs" />
                  ) : (
                    'Generate Next Book'
                  )}
                </button>
                <div class="dropdown dropdown-end">
                  <button type="button" class="btn btn-ghost btn-xs" tabIndex={0}>
                    Generate Books ↓
                  </button>
                  <ul class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
                    <For each={BOOK_COUNT_OPTIONS}>
                      {(count) => (
                        <li>
                          <button
                            type="button"
                            onClick={() =>
                              generateBooks(
                                storyState.story?.oneliner ?? '',
                                count,
                                (treeState.structure?.length ?? 0) + 1,
                                undefined,
                              )
                            }
                            disabled={loadingStates.story_expand}
                          >
                            {loadingStates.story_expand ? (
                              <span class="loading loading-spinner loading-xs" />
                            ) : (
                              `Generate ${count} Books`
                            )}
                          </button>
                        </li>
                      )}
                    </For>
                  </ul>
                </div>
              </Show>
            </div>
          </div>
          <div class="space-y-4">
            <AutoResizeTextarea
              class="textarea textarea-bordered w-full"
              value={storyState.story?.oneliner ?? ''}
              placeholder="Enter the overarching story concept that spans all books..."
              onInput={(e) => {
                if (e.currentTarget instanceof HTMLTextAreaElement) {
                  setStoryProperty('oneliner', e.currentTarget.value)
                }
              }}
            />
            <Show when={storyRefinement()}>
              <RefinementPreview
                original={storyState.story?.oneliner ?? ''}
                refined={storyRefinement() ?? ''}
                onAccept={() => {
                  setStoryProperty('oneliner', storyRefinement() ?? '')
                  setStoryRefinement(null)
                  addNotification({
                    type: 'success',
                    title: 'Refinement Accepted',
                    message: 'Story concept has been updated.',
                  })
                }}
                onReject={() => {
                  setStoryRefinement(null)
                  addNotification({
                    type: 'info',
                    title: 'Refinement Rejected',
                    message: 'Keeping original story concept.',
                  })
                }}
              />
            </Show>
          </div>
        </div>

        {/* Books Section */}
        <div class="font-bold text-xl flex justify-between items-center">
          <span>Books</span>
          <button type="button" class="btn btn-ghost btn-sm mb-2" onClick={() => createBook()}>
            +
          </button>
        </div>
        <For each={treeState.structure}>
          {(book) => (
            <div class="px-2 pl-4 flex flex-col gap-2 mt-4 bg-slate-100 rounded-lg shadow">
              <SnowflakeItem node={book} />
              <Show when={book.isOpen && book.children?.length}>
                <div class="px-2 pl-4 flex flex-col gap-2">
                  <For each={book.children}>
                    {(arc) => (
                      <div class="flex flex-col gap-2 bg-slate-200 rounded-lg shadow">
                        <SnowflakeItem node={arc} />
                        <Show when={arc.isOpen && arc.children?.length}>
                          <div class="px-2 pl-4 flex flex-col gap-2">
                            <For each={arc.children}>
                              {(chapter) => (
                                <div class="flex flex-col gap-2 bg-slate-300 rounded-lg shadow">
                                  <SnowflakeItem node={chapter} />
                                  <Show when={chapter.isOpen && chapter.children?.length}>
                                    <div class="px-2 pl-4 flex flex-col gap-2 rounded-lg shadow">
                                      <For each={chapter.children}>
                                        {(scene) => (
                                          <div class="bg-slate-400 rounded-lg shadow">
                                            <SnowflakeItem node={scene} />
                                          </div>
                                        )}
                                      </For>
                                      <button
                                        type="button"
                                        class="btn btn-ghost btn-xs self-start mb-2"
                                        onClick={() => createScene(chapter.id)}
                                      >
                                        + Add Scene
                                      </button>
                                    </div>
                                  </Show>
                                </div>
                              )}
                            </For>
                            <button
                              type="button"
                              class="btn btn-ghost btn-xs self-start mb-2"
                              onClick={() => createChapter(arc.id)}
                            >
                              + Add Chapter
                            </button>
                          </div>
                        </Show>
                      </div>
                    )}
                  </For>
                  <button type="button" class="btn btn-ghost btn-xs self-start mb-2" onClick={() => createArc(book.id)}>
                    + Add Arc
                  </button>
                </div>
              </Show>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}
