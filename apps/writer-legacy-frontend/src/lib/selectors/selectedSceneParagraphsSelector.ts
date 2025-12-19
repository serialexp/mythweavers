import { createSelector } from 'reselect'
import type { RootState } from '../store'

export const selectedSceneParagraphsSelector = createSelector(
  [
    (state: RootState) => state.base.currentId,
    (state: RootState) => state.base.selectedEntity,
    (state: RootState) => state.story.scene,
  ],
  (currentId, type, scenes) => {
    if (type !== 'scene' || !currentId) {
      return undefined
    }
    const scene = scenes[currentId]
    return {
      id: scene.id,
      paragraphs: scene.paragraphs,
    }
  },
)
