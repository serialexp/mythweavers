import { RootState } from '../store'

export const selectedImagePathSelector = (state: RootState) => {
  return state.base.imagePath
}
