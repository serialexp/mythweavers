import { createSelector } from 'reselect'
import type { RootState } from '../store'

export const plotpointSelector = createSelector([(state: RootState) => state.story.plotPoints], (plotpoints) => {
  return plotpoints
})
