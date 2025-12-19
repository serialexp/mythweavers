import { useAi } from '../../../lib/use-ai'

import { storyState } from '../../../lib/stores/story'

import { addNotification } from '../../../lib/stores/notifications'
import { setLoadingStates, setStoryRefinement } from '../store'

export const refineStoryConcept = async () => {
  setLoadingStates({ story_refine: true })
  try {
    const refinedSummary = await useAi('snowflake_refine_story', storyState.story?.oneliner ?? '')

    setStoryRefinement(refinedSummary.trim())
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      title: 'Failed to refine story concept',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    })
  } finally {
    setLoadingStates({ story_refine: false })
  }
}
