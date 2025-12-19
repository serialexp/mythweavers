import type { SceneParagraph } from '@writer/shared'
import { FiAlertCircle, FiBookmark, FiBox, FiTrash } from 'solid-icons/fi'
import { For, createSignal } from 'solid-js'
import { plotpoints } from '../lib/stores/plot-points'
import { currentScene } from '../lib/stores/retrieval/current-scene'
import { getPlotPointsAtParagraph } from '../lib/stores/retrieval/get-plot-points-at-paragraph'
import {
  removeInventoryFromSceneParagraph,
  removePlotpointFromSceneParagraph,
  scenesState,
  updateSceneSelectedParagraph,
} from '../lib/stores/scenes'
import { getItemsInOrder } from '../lib/stores/tree'
import { setCurrentId } from '../lib/stores/ui'

export const ParagraphDetails = (props: {
  sceneId: string
  paragraph: SceneParagraph
}) => {
  const unresolvedPlotPoints = () => getPlotPointsAtParagraph(props.paragraph.id)
  const isSelected = () => currentScene()?.selectedParagraph === props.paragraph.id
  const [isExpanded, setIsExpanded] = createSignal(false)

  const hasAnyActions = () =>
    (props.paragraph.plot_point_actions ?? []).length > 0 || (props.paragraph.inventory_actions ?? []).length > 0
  const hasUnresolvedPlotPointsOrActions = () => unresolvedPlotPoints().length > 0 || hasAnyActions()

  const navigateToLastMention = (paragraphId: string) => {
    // Find the scene containing this paragraph
    const scenes = getItemsInOrder('scene')
    for (const scene of scenes) {
      const sceneData = scenesState.scenes[scene.id]
      if (sceneData.paragraphs.some((p: SceneParagraph) => p.id === paragraphId)) {
        // Select the scene in the tree
        setCurrentId(scene.id)
        // Select the paragraph
        updateSceneSelectedParagraph(scene.id, paragraphId)
        break
      }
    }
  }

  return (
    <div class={`mb-2 ${hasUnresolvedPlotPointsOrActions() ? ' pt-2' : ''}`}>
      <div class="flex flex-row px-4 gap-1 flex-wrap">
        {/* Current paragraph's plot point actions */}
        <For each={props.paragraph.plot_point_actions ?? []}>
          {(link) => {
            const point = plotpoints.plotPoints[link.plot_point_id]
            return (
              <div class="tag flex items-center gap-2 rounded-md text-sm py-1 px-2 bg-blue-200">
                <FiBookmark />
                <span>
                  {point?.title} {link.action}
                </span>
                <button
                  type="button"
                  class="hover:text-error"
                  onClick={() => {
                    if (props.paragraph) {
                      removePlotpointFromSceneParagraph(props.sceneId, props.paragraph.id, link.plot_point_id)
                    }
                  }}
                >
                  <FiTrash />
                </button>
              </div>
            )
          }}
        </For>

        {/* Current paragraph's inventory actions */}
        <For each={props.paragraph.inventory_actions ?? []}>
          {(link) => (
            <div
              class={`tag flex items-center gap-2 rounded-md text-sm py-1 px-2 ${
                link.type === 'add' ? 'bg-success text-success-content' : 'bg-error text-error-content'
              }`}
            >
              <FiBox />
              <span>
                {link.item_name} x{link.item_amount}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (props.paragraph) {
                    removeInventoryFromSceneParagraph(props.sceneId, props.paragraph.id, link.item_name)
                  }
                }}
              >
                <FiTrash />
              </button>
            </div>
          )}
        </For>

        {/* Unresolved plot points (only shown when paragraph is selected) */}
        {isSelected() && (
          <>
            <div class="text-sm font-bold cursor-pointer btn btn-ghost" onClick={() => setIsExpanded(!isExpanded())}>
              {unresolvedPlotPoints().length} Unresolved plot points
            </div>
            {isExpanded() && (
              <For each={unresolvedPlotPoints()}>
                {(point) => (
                  <div
                    class={`tag flex items-center gap-2 rounded-md text-sm py-1 px-2 cursor-pointer hover:opacity-80 ${
                      point.lastAction === 'introduce'
                        ? 'bg-info text-info-content'
                        : point.lastAction === 'mentioned'
                          ? 'bg-primary text-primary-content'
                          : 'bg-warning text-warning-content'
                    }`}
                    onClick={() => point.lastMentionParagraphId && navigateToLastMention(point.lastMentionParagraphId)}
                  >
                    <FiAlertCircle />
                    <div class="flex flex-col">
                      <div class="flex items-center gap-2">
                        <span>
                          {point.title} ({point.lastAction})
                        </span>
                        <button
                          type="button"
                          class="hover:text-error"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (props.paragraph) {
                              removePlotpointFromSceneParagraph(props.sceneId, props.paragraph.id, point.id)
                            }
                          }}
                        >
                          <FiTrash />
                        </button>
                      </div>
                      {point.lastAction !== 'unintroduced' &&
                        point.lastMentionSceneTitle &&
                        point.paragraphsAgo !== undefined && (
                          <div class="text-xs opacity-80">
                            Last seen: {point.lastMentionSceneTitle}, {point.paragraphsAgo} paragraphs ago
                          </div>
                        )}
                    </div>
                  </div>
                )}
              </For>
            )}
          </>
        )}
      </div>
    </div>
  )
}
