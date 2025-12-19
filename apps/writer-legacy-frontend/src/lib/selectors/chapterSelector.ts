import { RootState } from '../store'

export const chaptersSelector = (state: RootState) => {
  return state.story.chapter
}
