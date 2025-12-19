import { createEffect, createSignal } from 'solid-js'
import { AutoSaveFile, listAutosaves } from '../lib/persistence/list-autosaves'
import { currentScene } from '../lib/stores/retrieval/current-scene'
import { updateSceneData } from '../lib/stores/scenes'
import { storyState } from '../lib/stores/story'

const Entry = (props: { v: AutoSaveFile }) => {
  const [isOpen, setIsOpen] = createSignal(false)
  const v = props.v

  return (
    <>
      <tr>
        <td class="px-4 py-2">{v.savedDate.toLocaleString()}</td>
        <td class="px-4 py-2">{v.name}</td>
        <td class="px-4 py-2">{v.words}</td>
        <td class="px-4 py-2">
          <div class="flex space-x-2">
            <button
              type="button"
              class="text-xs bg-blue-500 text-white px-2 py-1 rounded"
              onClick={() => {
                updateSceneData(currentScene()?.id ?? '', v.object)
              }}
            >
              Restore
            </button>
            <button
              type="button"
              class="text-xs bg-gray-500 text-white px-2 py-1 rounded"
              onClick={() => {
                setIsOpen(!isOpen())
              }}
            >
              {isOpen() ? 'Close' : 'Open'}
            </button>
          </div>
        </td>
      </tr>
      {isOpen() ? (
        <tr>
          <td colSpan={4} class="px-4 py-2">
            <pre>{JSON.stringify(v.object, null, 2)}</pre>
          </td>
        </tr>
      ) : null}
    </>
  )
}

export const SceneHistoryPanel = () => {
  const [historicalVersions, setHistoricalVersions] = createSignal<AutoSaveFile[]>([])

  createEffect(() => {
    if (storyState.openPath && currentScene()?.id) {
      setHistoricalVersions([])
      const id = currentScene()?.id
      if (id) {
        listAutosaves(storyState.openPath, 'scene', id).then((result) => {
          setHistoricalVersions(result)
        })
      }
    }
  })

  return currentScene()?.id ? (
    <div class="flex-1 p-4 h-full overflow-auto">
      <div class="space-y-2">
        <table class="min-w-full">
          <thead>
            <tr>
              <th class="px-4 py-2">Date</th>
              <th class="px-4 py-2">Name</th>
              <th class="px-4 py-2">Words</th>
              <th class="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {historicalVersions()?.map((v) => {
              return <Entry v={v} />
            })}
          </tbody>
        </table>
      </div>
    </div>
  ) : null
}
