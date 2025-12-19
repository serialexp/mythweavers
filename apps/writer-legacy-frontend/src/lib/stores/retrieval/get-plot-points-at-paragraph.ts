import type { PlotpointAction } from '@writer/shared'
import { plotpoints } from '../plot-points'
import { scenesState } from '../scenes'
import { getItemsInOrder } from '../tree'

export type PlotPointState = {
  id: string
  title: string
  lastAction: PlotpointAction['action'] | 'unintroduced'
  lastMentionParagraphId?: string
  lastMentionSceneTitle?: string
  paragraphsAgo?: number
  everIntroduced?: boolean
}

const MENTION_THRESHOLD = 150 // Show plot points after 100 paragraphs without activity
const PARTIAL_THRESHOLD = 300 // Show partially resolved plot points after 200 paragraphs

export const getPlotPointsAtParagraph = (paragraphId: string) => {
  // Initialize with all plot points as unintroduced
  const plotPointStates = new Map<string, PlotPointState>(
    Object.entries(plotpoints.plotPoints).map(([id, point]) => [
      id,
      {
        id,
        title: point.title,
        lastAction: 'unintroduced',
        everIntroduced: false,
      },
    ]),
  )

  // First pass: check if plot points are ever introduced in the story
  const treeScenes = getItemsInOrder('scene')
  const scenes = treeScenes.map((scene) => scenesState.scenes[scene.id])

  for (const scene of scenes) {
    for (const paragraph of scene.paragraphs) {
      if (paragraph.plot_point_actions) {
        for (const action of paragraph.plot_point_actions) {
          if (action.action === 'introduce') {
            const state = plotPointStates.get(action.plot_point_id)
            if (state) {
              state.everIntroduced = true
            }
          }
        }
      }
    }
  }

  // Second pass: track the most recent mentions
  let paragraphCount = 0
  for (const scene of scenes) {
    for (const paragraph of scene.paragraphs) {
      paragraphCount++

      if (paragraph.plot_point_actions) {
        for (const action of paragraph.plot_point_actions) {
          const plotPoint = plotpoints.plotPoints[action.plot_point_id]
          if (!plotPoint) continue

          const state = plotPointStates.get(action.plot_point_id)
          if (!state) continue

          // Only update the action if it's been introduced or if this is an introduction
          const newAction = state.everIntroduced || action.action === 'introduce' ? action.action : 'unintroduced'

          plotPointStates.set(action.plot_point_id, {
            id: action.plot_point_id,
            title: plotPoint.title,
            lastAction: newAction,
            lastMentionParagraphId: paragraph.id,
            lastMentionSceneTitle: scene.title,
            paragraphsAgo: paragraphCount,
            everIntroduced: state.everIntroduced,
          })
        }
      }
      if (paragraph.id === paragraphId) {
        // Calculate paragraphsAgo for all plot points relative to current paragraph
        const states = Array.from(plotPointStates.values())
        for (const state of states) {
          if (state.paragraphsAgo) {
            state.paragraphsAgo = paragraphCount - state.paragraphsAgo
          }
        }
        // Filter to return both unintroduced and unresolved plot points that haven't been mentioned recently
        return states.filter((state) => {
          // Only show truly unintroduced plot points (never introduced anywhere in the story)
          if (state.lastAction === 'unintroduced' && !state.everIntroduced) return true

          // Don't show resolved plot points
          if (state.lastAction === 'resolved') return false

          // Don't show plot points that were just introduced or mentioned
          if (!state.paragraphsAgo || state.paragraphsAgo < MENTION_THRESHOLD) return false

          // For partially resolved plot points, use a higher threshold
          if (state.lastAction === 'partially resolved' && state.paragraphsAgo < PARTIAL_THRESHOLD) return false

          return true
        })
      }
    }
  }

  return Array.from(plotPointStates.values()).filter((state) => {
    if (state.lastAction === 'unintroduced' && !state.everIntroduced) return true
    if (state.lastAction === 'resolved') return false
    if (!state.paragraphsAgo || state.paragraphsAgo < MENTION_THRESHOLD) return false
    if (state.lastAction === 'partially resolved' && state.paragraphsAgo < PARTIAL_THRESHOLD) return false
    return true
  })
}

export const getResolvedPlotPointsAtParagraph = (paragraphId: string) => {
  const resolvedPlotPoints = new Set<string>()

  const treeScenes = getItemsInOrder('scene')
  const scenes = treeScenes.map((scene) => scenesState.scenes[scene.id])

  for (const scene of scenes) {
    for (const paragraph of scene.paragraphs) {
      if (paragraph.plot_point_actions) {
        for (const action of paragraph.plot_point_actions) {
          if (action.action === 'resolved') {
            resolvedPlotPoints.add(action.plot_point_id)
          }
        }
      }
      if (paragraph.id === paragraphId) {
        return resolvedPlotPoints
      }
    }
  }

  return resolvedPlotPoints
}
