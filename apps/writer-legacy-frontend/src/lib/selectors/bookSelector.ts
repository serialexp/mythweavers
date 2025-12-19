import { RootState } from '../store'

export const bookSelector = (state: RootState) => {
  return state.story.book
}
