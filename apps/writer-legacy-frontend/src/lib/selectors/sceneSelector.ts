import { createSelector } from 'reselect'
import type { Scene } from '../../../../shared/src/schema.ts'
import type { RootState } from '../store'

export const sceneSelector = createSelector(
  [(state: RootState) => state.story.scene, (_state: RootState, sceneId: string) => sceneId],
  (scenes, sceneId): Scene | undefined => {
    return scenes[sceneId]
  },
)
