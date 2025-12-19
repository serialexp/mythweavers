import shortUUID from 'short-uuid'
import { currentScene } from '../lib/stores/retrieval/current-scene'
import { createSceneParagraph } from '../lib/stores/scenes'
import { SceneEditor } from './editor/SceneEditor'

export const SceneParagraphsList = () => {
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
      ) : (
        <SceneEditor sceneId={currentScene()?.id ?? ''} />
      )}
    </>
  ) : null
}
