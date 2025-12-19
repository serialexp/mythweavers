import { createSelector } from 'reselect'
import { RootState } from '../store'

export const scenesSelector = createSelector(
  (state: RootState) => {
    return state.story.scene
  },
  (scenes) => {
    return scenes
  },
)
