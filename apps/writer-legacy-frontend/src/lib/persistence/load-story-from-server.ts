import type { PersistedStory } from '@writer/shared'
import { addNotification } from '../stores/notifications'
import { storyState } from '../stores/story'
import { setLoadingFromServer, setServerStoryForConfirmation, setShowLoadFromServerConflictDialog } from '../stores/ui'
import { trpc } from '../trpc'
import { loadToState } from './load-to-state'

export const loadStoryFromServer = async () => {
  if (!storyState.story?.id) {
    addNotification({
      title: 'Load failed',
      message: 'No story loaded locally to compare with',
      type: 'error',
    })
    return
  }

  setLoadingFromServer(true)
  try {
    const serverStory = await trpc.downloadStory.mutate({
      storyId: storyState.story.id,
    })

    // Basic conflict check: Compare top-level modifiedTime
    const localModifiedTime = storyState.story.modifiedTime ?? 0
    const serverModifiedTime = serverStory.story.modifiedTime ?? 0

    if (serverModifiedTime > localModifiedTime) {
      // Server version is newer, show confirmation dialog
      setServerStoryForConfirmation(serverStory)
      setShowLoadFromServerConflictDialog(true)
    } else {
      // Server version is older or same, load directly
      await loadToState(serverStory)
      addNotification({
        title: 'Success',
        message: 'Story loaded from server.',
        type: 'success',
      })
    }
  } catch (error: unknown) {
    console.error('Load from server error:', error)
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
    addNotification({
      title: 'Load failed',
      message: `Failed to load story from server: ${errorMessage}`,
      type: 'error',
    })
  } finally {
    setLoadingFromServer(false)
  }
}

// Function to be called when user confirms overwriting
export const forceLoadFromServer = async (serverStory: PersistedStory) => {
  try {
    await loadToState(serverStory)
    addNotification({
      title: 'Success',
      message: 'Story loaded from server, overwriting local changes.',
      type: 'success',
    })
  } catch (error) {
    console.error('Force load from server error:', error)
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
    addNotification({
      title: 'Load failed',
      message: `Failed to apply server story: ${errorMessage}`,
      type: 'error',
    })
  }
}
