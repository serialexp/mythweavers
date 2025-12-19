import { plotpoints } from '../plot-points'
import { scenesState } from '../scenes'
import { getItemsInOrder } from '../tree'

export type PlotPointStats = {
  id: string
  title: string
  introductionScene?: string
  introductionSceneNumber?: number
  resolutionScene?: string
  resolutionSceneNumber?: number
  mentionCount: number
}

export const getPlotPointStats = () => {
  const stats = new Map<string, PlotPointStats>(
    Object.entries(plotpoints.plotPoints).map(([id, point]) => [
      id,
      {
        id,
        title: point.title,
        mentionCount: 0,
      },
    ]),
  )

  const treeScenes = getItemsInOrder('scene')
  const scenes = treeScenes.map((scene, index) => ({
    ...scenesState.scenes[scene.id],
    sceneNumber: index + 1,
  }))

  for (const scene of scenes) {
    for (const paragraph of scene.paragraphs) {
      if (paragraph.plot_point_actions) {
        for (const action of paragraph.plot_point_actions) {
          const stat = stats.get(action.plot_point_id)
          if (!stat) continue

          // Track first introduction
          if (action.action === 'introduce' && !stat.introductionScene) {
            stat.introductionScene = scene.title
            stat.introductionSceneNumber = scene.sceneNumber
          }

          // Track resolution
          if (action.action === 'resolved') {
            stat.resolutionScene = scene.title
            stat.resolutionSceneNumber = scene.sceneNumber
          }

          // Count mentions (including introductions and resolutions)
          stat.mentionCount++
        }
      }
    }
  }

  return Array.from(stats.values())
}
