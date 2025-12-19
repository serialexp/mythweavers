import { PlotPoint } from '@writer/shared'
import shortUUID from 'short-uuid'
import { createStore } from 'solid-js/store'

const plotpointsDefault = { plotPoints: {} }
export const [plotpoints, setPlotpoints] = createStore<{
  plotPoints: Record<string, PlotPoint>
}>(plotpointsDefault)

export const resetPlotpoints = () => {
  setPlotpoints('plotPoints', {})
}

export const updatePlotpoint = (id: string, changes: Partial<PlotPoint>) => {
  for (const key in changes) {
    setPlotpoints('plotPoints', id, key as keyof PlotPoint, changes[key as keyof PlotPoint])
  }
}

export const deletePlotpoint = (id: string) => {
  // @ts-expect-error: yes, this is a valid operation
  setPlotpoints('plotPoints', id, undefined)
}

export const createPlotpoint = () => {
  const id = shortUUID.generate()
  setPlotpoints('plotPoints', (curr) => {
    return {
      ...curr,
      [id]: {
        id,
        title: '',
        summary: '',
      },
    }
  })
}
