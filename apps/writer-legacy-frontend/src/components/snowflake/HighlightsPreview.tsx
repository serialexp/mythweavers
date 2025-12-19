import type { Arc, Node } from '@writer/shared'
import { TbRefresh, TbTrash } from 'solid-icons/tb'
import { For, Show } from 'solid-js'
import { updateArc } from '../../lib/stores/arcs'
import { extractArcHighlights } from './actions/extractArcHighlights'

type Props = {
  arc?: Arc
  node: Node
  onClose: () => void
}

export const HighlightsPreview = (props: Props) => {
  const categories = ['character', 'plot', 'setting', 'theme'] as const

  const removeHighlight = (highlightText: string) => {
    const newHighlights = props.arc?.highlights?.filter((h) => h.text !== highlightText) ?? []
    if (props.arc) {
      updateArc(props.arc.id, {
        highlights: newHighlights,
      })
    }
  }

  return (
    <div class="modal modal-open">
      <div class="modal-box max-w-3xl">
        <h3 class="font-bold text-lg mb-4 flex items-center justify-between">
          <div>
            Key Highlights
            <div class="text-sm font-normal opacity-75">
              Elements that may be important for future chapters and scenes
            </div>
          </div>
          <button class="btn btn-sm" onClick={() => extractArcHighlights(props.node)}>
            <TbRefresh />
            Re-extract
          </button>
        </h3>

        <Show
          when={props.arc?.highlights?.length}
          fallback={<div class="text-center py-8 opacity-75">No highlights extracted yet</div>}
        >
          <div class="space-y-4">
            <For each={categories}>
              {(category) => {
                const highlights = props.arc?.highlights?.filter((h) => h.category === category)
                return (
                  <Show when={highlights?.length}>
                    <div>
                      <h4 class="font-semibold capitalize mb-2">{category}</h4>
                      <div class="space-y-2">
                        <For each={highlights}>
                          {(highlight) => (
                            <div class="bg-base-200 p-3 rounded-lg flex gap-3">
                              <div class="flex-1">
                                <div class="font-medium">{highlight.text}</div>
                                <div class="text-sm opacity-75 mt-1">{highlight.importance}</div>
                              </div>
                              <button
                                class="btn btn-ghost btn-sm text-error"
                                onClick={() => removeHighlight(highlight.text)}
                                title="Delete highlight"
                              >
                                <TbTrash />
                              </button>
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  </Show>
                )
              }}
            </For>
          </div>
        </Show>

        <div class="modal-action">
          <button class="btn" onClick={props.onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
