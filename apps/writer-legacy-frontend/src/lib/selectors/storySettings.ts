import { RootState } from '../store'

export const storySettingsSelector = (state: RootState) => {
  return state.story.settings
}
