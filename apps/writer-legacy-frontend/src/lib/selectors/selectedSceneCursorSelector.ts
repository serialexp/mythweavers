import { createSelector } from 'reselect'
import type { Scene } from '../../../../shared/src/schema.ts'
import type { RootState } from '../store'

export const selectedSceneCursorSelector = createSelector(
  [
    (state: RootState) => state.base.currentId,
    (state: RootState) => state.base.selectedEntity,
    (state: RootState) => state.story.scene,
  ],
  (currentId, type, scenes): Pick<Scene, 'selectedParagraph' | 'cursor' | 'id'> | undefined => {
    if (type !== 'scene' || !currentId) {
      return undefined
    }
    return {
      id: scenes[currentId].id,
      selectedParagraph: scenes[currentId].selectedParagraph,
      cursor: scenes[currentId].cursor,
    }
  },
)
