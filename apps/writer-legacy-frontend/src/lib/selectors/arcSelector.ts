import { RootState } from '../store'

export const arcSelector = (state: RootState) => {
  return state.story.arc
}
