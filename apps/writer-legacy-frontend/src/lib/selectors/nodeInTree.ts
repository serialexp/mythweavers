import { createSelector } from 'reselect'
import type { Node } from '../../../../shared/src/schema.ts'
import { findNodeInStructure } from '../slices/story'
import type { RootState } from '../store'

export const nodeInTree = createSelector(
  [(state: RootState) => state.base.currentId, (state: RootState) => state.story.structure],
  (currentId, structure): Node | undefined => {
    return currentId ? findNodeInStructure(structure, currentId) : undefined
  },
)
