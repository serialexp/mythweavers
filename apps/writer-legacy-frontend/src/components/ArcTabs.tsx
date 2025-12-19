import { Show, createSignal } from 'solid-js'
import { updateArc } from '../lib/stores/arcs'
import { currentArc } from '../lib/stores/retrieval/current-arc'
import { sortedObjects } from '../lib/stores/retrieval/sorted-objects'
import { updateNode } from '../lib/stores/tree'
import { useAi } from '../lib/use-ai'
import { NodeTypeButtons } from './NodeTypeButtons'
import { FormField } from './styled/FormField'

export const ArcTabs = () => {
  const [openTab, setOpenTab] = createSignal('overview')

  return (
    <div class="flex flex-col flex-1 overflow-hidden">
      <div class="tabs tabs-bordered">
        <button
          type="button"
          class={`tab ${openTab() === 'overview' ? 'tab-active' : ''}`}
          onClick={() => setOpenTab('overview')}
        >
          Overview
        </button>
      </div>

      {openTab() === 'overview' && (
        <div class="flex flex-1 flex-col overflow-y-auto p-4 gap-2">
          <FormField label="Title">
            <input
              class="input input-bordered"
              placeholder="title"
              onInput={(e) => {
                const id = currentArc()?.id
                if (id) {
                  updateArc(id, { title: e.target.value })
                }
              }}
              value={currentArc()?.title}
            />
          </FormField>
          <FormField label="Summary">
            <textarea
              class="textarea textarea-bordered mt-2"
              onInput={(e) => {
                const id = currentArc()?.id
                if (id) {
                  updateArc(id, { summary: e.target.value })
                  updateNode(id, { oneliner: e.target.value })
                }
              }}
              placeholder="summary"
              style={{ height: '300px' }}
              value={currentArc()?.summary}
            />
          </FormField>
          <FormField label="Start date">
            <input
              class="input input-bordered mt-2"
              onInput={(e) => {
                const id = currentArc()?.id
                if (id) {
                  updateArc(id, { start_date: e.target.value })
                }
              }}
              placeholder="start date"
              value={currentArc()?.start_date}
            />
          </FormField>
          <Show when={currentArc()?.id}>{(id) => <NodeTypeButtons nodeId={id()} />}</Show>
          {currentArc()?.extra && (
            <FormField label="Extra">
              <textarea
                class="textarea textarea-bordered"
                value={currentArc()?.extra}
                style={{ height: '300px' }}
                onInput={(e) => {
                  const id = currentArc()?.id
                  if (id) {
                    updateArc(id, { extra: e.target.value })
                  }
                }}
              />
            </FormField>
          )}
          <button
            type="button"
            class="btn btn-primary"
            onClick={() => {
              const allArcText = sortedObjects(currentArc()?.id)
                .filter((i) => i.type === 'paragraph')
                .map((i) => i.plainText)
                .join('\n\n')
              useAi('critiqueStoryline', allArcText, true).then((res) => {
                updateArc(currentArc()?.id, {
                  extra: res,
                })
              })
            }}
          >
            [AI] Critique storyline
          </button>
        </div>
      )}
    </div>
  )
}
