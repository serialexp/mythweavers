import { useNavigate } from '@solidjs/router'
import { For } from 'solid-js'
import { plotpoints } from '../lib/stores/plot-points'
import { scenesState, updateSceneSelectedParagraph } from '../lib/stores/scenes'
import { getItemsInOrder } from '../lib/stores/tree'
import { setCurrentId } from '../lib/stores/ui'

const actionColors = {
  introduce: 'bg-info',
  mentioned: 'bg-primary text-white',
  'partially resolved': 'bg-warning',
  resolved: 'bg-success',
}

const actionLetters = {
  introduce: 'I',
  mentioned: 'M',
  'partially resolved': 'P',
  resolved: 'R',
}

export const PlotPointTable = () => {
  const navigate = useNavigate()

  const scenes = () => {
    const treeScenes = getItemsInOrder('scene')
    return treeScenes.map((scene, index) => ({
      ...scenesState.scenes[scene.id],
      sceneNumber: index + 1,
    }))
  }

  const plotPointsArray = () => Object.values(plotpoints.plotPoints)

  const getPlotPointBoundaries = () => {
    const boundaries = new Map<string, { introScene?: number; resolveScene?: number }>()

    for (const scene of scenes()) {
      for (const paragraph of scene.paragraphs) {
        for (const action of paragraph.plot_point_actions ?? []) {
          const current = boundaries.get(action.plot_point_id) || {}

          if (
            action.action === 'introduce' &&
            (current.introScene === undefined || scene.sceneNumber < current.introScene)
          ) {
            current.introScene = scene.sceneNumber
          }
          if (
            action.action === 'resolved' &&
            (current.resolveScene === undefined || scene.sceneNumber < current.resolveScene)
          ) {
            current.resolveScene = scene.sceneNumber
          }

          boundaries.set(action.plot_point_id, current)
        }
      }
    }

    return boundaries
  }

  const getPlotPointActionInScene = (sceneId: string, plotPointId: string) => {
    const scene = scenesState.scenes[sceneId]
    if (!scene) return null

    for (const paragraph of scene.paragraphs) {
      const action = paragraph.plot_point_actions?.find((a) => a.plot_point_id === plotPointId)
      if (action) return { action, paragraphId: paragraph.id }
    }
    return null
  }

  const navigateToAction = (sceneId: string, paragraphId: string) => {
    setCurrentId(sceneId)
    updateSceneSelectedParagraph(sceneId, paragraphId)
    navigate('/write')
  }

  return (
    <div class="overflow-x-auto w-full">
      <table class="table table-xs table-fixed">
        <colgroup>
          <col class="w-24" />
          <For each={plotPointsArray()}>{() => <col class="w-[20px]" />}</For>
        </colgroup>
        <thead>
          <tr>
            <th class="sticky left-0 top-0 bg-base-100 z-20 p-0 w-24 min-w-[6rem] max-w-[6rem]">Scene</th>
            <For each={plotPointsArray()}>
              {(plotPoint) => (
                <th class="sticky top-0 border-l border-slate-200 bg-base-100 z-10 w-[20px] shadow-md min-w-[20px] max-w-[20px] h-[90px] overflow-visible p-0 relative">
                  <div class="transform -rotate-90 whitespace-normal text-center origin-center">{plotPoint.title}</div>
                </th>
              )}
            </For>
          </tr>
        </thead>
        <tbody>
          <For each={scenes()}>
            {(scene) => {
              const boundaries = getPlotPointBoundaries()
              return (
                <tr>
                  <td class="sticky left-0 bg-base-100 z-10 whitespace-nowrap p-0 text-xs w-24 min-w-[6rem] max-w-[6rem]">
                    {scene.sceneNumber}: {scene.title}
                  </td>
                  <For each={plotPointsArray()}>
                    {(plotPoint) => {
                      const result = getPlotPointActionInScene(scene.id, plotPoint.id)
                      const bounds = boundaries.get(plotPoint.id)
                      const isActive =
                        bounds?.introScene !== undefined &&
                        scene.sceneNumber >= bounds.introScene &&
                        (!bounds.resolveScene || scene.sceneNumber <= bounds.resolveScene)
                      const showLine = isActive && !result

                      return (
                        <td class="text-center border-l border-slate-200 p-0 text-xs w-[20px] min-w-[20px] max-w-[20px] h-[20px] relative">
                          {showLine && <div class="absolute top-0 left-1/2 w-[2px] h-full bg-slate-400" />}
                          {result && (
                            <div
                              class={`${
                                actionColors[result.action.action as keyof typeof actionColors]
                              } w-4 h-4 rounded-full flex items-center justify-center mx-auto text-[10px] font-bold cursor-pointer hover:opacity-80`}
                              onClick={() => navigateToAction(scene.id, result.paragraphId)}
                            >
                              {actionLetters[result.action.action as keyof typeof actionLetters]}
                            </div>
                          )}
                        </td>
                      )
                    }}
                  </For>
                </tr>
              )
            }}
          </For>
        </tbody>
      </table>
    </div>
  )
}
