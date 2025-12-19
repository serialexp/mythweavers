import shortUUID from 'short-uuid'
import { For } from 'solid-js'
import { currentScene } from '../lib/stores/retrieval/current-scene'
import { createSceneParagraph } from '../lib/stores/scenes'
import { Paragraph } from './Paragraph'

export const ParagraphsList = () => {
  return currentScene() ? (
    <>
      {currentScene()?.paragraphs.length === 0 ? (
        <button
          type="button"
          class="btn btn-primary"
          onClick={() => {
            createSceneParagraph(currentScene()?.id ?? '', {
              id: shortUUID.generate(),
              text: '',
              state: 'draft',
              comments: [],
            })
          }}
        >
          Create paragraph
        </button>
      ) : null}
      <For each={currentScene()?.paragraphs}>
        {(p) => {
          const thisScene = currentScene()
          if (thisScene) {
            return <Paragraph sceneId={thisScene.id} paragraph={p} />
          }
        }}
      </For>
    </>
  ) : null
}
