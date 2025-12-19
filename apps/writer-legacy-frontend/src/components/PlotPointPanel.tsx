import { For } from 'solid-js/web'
import { createPlotpoint, deletePlotpoint, plotpoints, updatePlotpoint } from '../lib/stores/plot-points'
import { getPlotPointStats } from '../lib/stores/retrieval/get-plot-point-stats'
import { setPlotPointViewMode, uiState } from '../lib/stores/ui'
import { NoItems } from './NoItems'
import { PlotPointTable } from './PlotPointTable'

export const PlotPointPanel = () => {
  const stats = () => {
    const allStats = getPlotPointStats()
    return allStats.sort((a, b) => {
      // Put resolved points at the end
      if (a.resolutionScene && !b.resolutionScene) return 1
      if (!a.resolutionScene && b.resolutionScene) return -1

      // For unresolved points, sort by introduction scene (latest first)
      if (!a.resolutionScene && !b.resolutionScene) {
        // Put unintroduced points first
        if (!a.introductionScene && b.introductionScene) return -1
        if (a.introductionScene && !b.introductionScene) return 1
        if (a.introductionSceneNumber && b.introductionSceneNumber) {
          return b.introductionSceneNumber - a.introductionSceneNumber
        }
      }

      // For resolved points, also sort by introduction scene
      if (a.resolutionScene && b.resolutionScene && a.introductionSceneNumber && b.introductionSceneNumber) {
        return b.introductionSceneNumber - a.introductionSceneNumber
      }

      return 0
    })
  }

  return (
    <div class="flex flex-col gap-2 p-2 w-full overflow-hidden">
      <div class="flex justify-between items-center">
        <div class="tabs tabs-boxed">
          <button
            type="button"
            class={`tab ${uiState.plotPointViewMode === 'grid' ? 'tab-active' : ''}`}
            onClick={() => setPlotPointViewMode('grid')}
          >
            Grid View
          </button>
          <button
            type="button"
            class={`tab ${uiState.plotPointViewMode === 'table' ? 'tab-active' : ''}`}
            onClick={() => setPlotPointViewMode('table')}
          >
            Table View
          </button>
        </div>
        <button type="button" class="btn btn-primary" onClick={createPlotpoint}>
          Add plot point
        </button>
      </div>

      {Object.values(plotpoints.plotPoints).length === 0 ? (
        <NoItems itemKind="plot points" />
      ) : uiState.plotPointViewMode === 'grid' ? (
        <div class="flex-1 grid grid-cols-4 gap-2 flex-wrap items-start justify-start overflow-auto">
          <For each={Object.values(plotpoints.plotPoints)}>
            {(plotPoint) => {
              const allStats = stats()
              const resolutionScene = allStats.find((stat) => stat.id === plotPoint.id)?.resolutionScene
              const introductionScene = allStats.find((stat) => stat.id === plotPoint.id)?.introductionScene
              const introductionSceneNumber = allStats.find((stat) => stat.id === plotPoint.id)?.introductionSceneNumber
              const resolutionSceneNumber = allStats.find((stat) => stat.id === plotPoint.id)?.resolutionSceneNumber
              const mentionCount = allStats.find((stat) => stat.id === plotPoint.id)?.mentionCount
              return (
                <div class={`flex rounded-md flex-col gap-2 p-2 ${resolutionScene ? 'bg-slate-300' : 'bg-base-200'}`}>
                  <div class="flex">
                    <input
                      class={`input input-bordered flex-1 ${resolutionScene ? 'text-success' : ''}`}
                      placeholder="title"
                      value={plotpoints.plotPoints[plotPoint.id].title}
                      onInput={(e) =>
                        updatePlotpoint(plotPoint.id, {
                          title: e.currentTarget.value,
                        })
                      }
                    />
                    <button
                      type="button"
                      class="ml-2 btn btn-error btn-sm"
                      onClick={() => {
                        if (confirm('You sure you want to delete this one?')) {
                          deletePlotpoint(plotPoint.id)
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                  <textarea
                    class="textarea textarea-bordered w-full"
                    placeholder="Summary"
                    onInput={(e) =>
                      updatePlotpoint(plotPoint.id, {
                        summary: e.currentTarget.value,
                      })
                    }
                    value={plotpoints.plotPoints[plotPoint.id].summary}
                  />
                  <div class="text-sm flex flex-col gap-1 text-gray-600">
                    {introductionScene ? (
                      <div>
                        Introduced in: Scene {introductionSceneNumber}: {introductionScene}
                      </div>
                    ) : (
                      <div class="text-warning">Not yet introduced</div>
                    )}
                    {resolutionScene ? (
                      <div class="text-success">
                        Resolved in: Scene {resolutionSceneNumber}: {resolutionScene}
                      </div>
                    ) : (
                      <div class="text-info">Not yet resolved</div>
                    )}
                    <div>
                      Mentioned {mentionCount} time{mentionCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              )
            }}
          </For>
        </div>
      ) : (
        <PlotPointTable />
      )}
    </div>
  )
}
