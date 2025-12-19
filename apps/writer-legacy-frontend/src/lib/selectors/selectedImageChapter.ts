import { RootState } from '../store'

export const selectedImageChapterSelector = (state: RootState) => {
  return state.base.selectedImageChapter
}
