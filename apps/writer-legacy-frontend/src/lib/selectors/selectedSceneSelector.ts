import { createSelector } from 'reselect'
import type { Scene } from '../../../../shared/src/schema.ts'
import type { RootState } from '../store'

export const selectedSceneSelector = createSelector(
  [
    (state: RootState) => state.base.currentId,
    (state: RootState) => state.base.selectedEntity,
    (state: RootState) => state.story.scene,
  ],
  (currentId, type, scenes): Scene | undefined => {
    if (type !== 'scene' || !currentId) {
      return undefined
    }
    return scenes[currentId]
  },
)
