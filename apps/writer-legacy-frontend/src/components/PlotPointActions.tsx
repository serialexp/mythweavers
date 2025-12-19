import type { PlotpointAction } from '@writer/shared'
import { For, createSignal } from 'solid-js'
import { plotpoints } from '../lib/stores/plot-points'
import { currentScene } from '../lib/stores/retrieval/current-scene'
import { getResolvedPlotPointsAtParagraph } from '../lib/stores/retrieval/get-plot-points-at-paragraph'
import { addPlotpointActionToSceneParagraph } from '../lib/stores/scenes'

type PlotPointActionType = PlotpointAction['action']

const actionOptions: { value: PlotPointActionType; label: string; class: string }[] = [
  { value: 'introduce', label: 'Introduce', class: 'btn-info' },
  { value: 'mentioned', label: 'Mention', class: 'btn-primary' },
  { value: 'partially resolved', label: 'Partial', class: 'btn-warning' },
  { value: 'resolved', label: 'Resolve', class: 'btn-success' },
]

interface PlotPointActionsProps {
  onClose?: () => void
}

export const PlotpointActions = (props: PlotPointActionsProps) => {
  const [plotPoint, setPlotPoint] = createSignal<string>('')

  const availablePlotPoints = () => {
    const scene = currentScene()
    if (!scene?.selectedParagraph) return []

    // Get resolved plot points at this paragraph
    const resolvedIds = getResolvedPlotPointsAtParagraph(scene.selectedParagraph)

    // Filter out resolved plot points
    return Object.values(plotpoints.plotPoints).filter((point) => !resolvedIds.has(point.id))
  }

  const handleAction = (action: PlotpointAction['action']) => {
    const scene = currentScene()
    if (!scene?.id || !scene.selectedParagraph || !plotPoint()) return

    addPlotpointActionToSceneParagraph(scene.id, scene.selectedParagraph, {
      plot_point_id: plotPoint(),
      action,
    })
    setPlotPoint('')
    props.onClose?.()
  }

  return (
    <div class="flex flex-col gap-2 mt-2">
      <div class="flex items-center gap-2">
        <div class="min-w-[6em]">Plot Points</div>
        <select
          class="select select-bordered flex-1"
          value={plotPoint()}
          onChange={(e) => {
            setPlotPoint(e.currentTarget.value)
          }}
        >
          <option value="">-- select --</option>
          <For each={availablePlotPoints()}>
            {(point) => {
              return <option value={point.id}>{point.title}</option>
            }}
          </For>
        </select>
      </div>
      {plotPoint() && (
        <div class="flex flex-wrap gap-2 ml-[6em]">
          <For each={actionOptions}>
            {(opt) => (
              <button type="button" class={`btn btn-sm ${opt.class}`} onClick={() => handleAction(opt.value)}>
                {opt.label}
              </button>
            )}
          </For>
        </div>
      )}
    </div>
  )
}
