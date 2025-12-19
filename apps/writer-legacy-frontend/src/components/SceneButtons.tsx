import { Show } from 'solid-js'
import { currentScene } from '../lib/stores/retrieval/current-scene'
import { updateSceneParagraphData } from '../lib/stores/scenes'

export const SceneButtons = () => {
  const scene = currentScene()

  return (
    <Show when={scene}>
      <div class="flex flex-row items-center bg-gray-300 gap-2">
        <span class="min-w-[6em]">Actions</span>
        <button
          type="button"
          class="btn btn-secondary btn-xs"
          onClick={() => {
            if (!scene) return
            for (const p of scene.paragraphs) {
              updateSceneParagraphData(scene.id, p.id, {
                extra: p.text,
                text: '',
              })
            }
          }}
        >
          Shift to extra
        </button>
        <button
          type="button"
          class="btn btn-secondary btn-xs"
          onClick={() => {
            if (!scene) return
            for (const p of scene.paragraphs) {
              updateSceneParagraphData(scene.id, p.id, {
                state: 'ai',
              })
            }
          }}
        >
          All AI
        </button>
        <button
          type="button"
          class="btn btn-secondary btn-xs"
          onClick={() => {
            if (!scene) return
            for (const p of scene.paragraphs) {
              updateSceneParagraphData(scene.id, p.id, {
                state: 'draft',
              })
            }
          }}
        >
          All Draft
        </button>
      </div>
    </Show>
  )
}
