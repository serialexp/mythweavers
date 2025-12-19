import { RootState } from '../store'

export const structureSelector = (state: RootState) => {
  return state.story.structure
}
