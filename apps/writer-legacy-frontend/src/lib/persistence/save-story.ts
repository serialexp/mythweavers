import type { SavePayload } from '@writer/shared'
import { saveSchema } from '@writer/shared'
import { unwrap } from 'solid-js/store'
import { booksStore } from '../stores/books'
import { addNotification } from '../stores/notifications'
import { scenesState } from '../stores/scenes'
import { storyState } from '../stores/story'
import { treeState } from '../stores/tree'
import { setLastSaveAt, uiState } from '../stores/ui'
import { saveProject } from './save-project'
import { stateToStory } from './state-to-story'

export const saveStory = async (withAutosave = false, forceFullSave = false) => {
  if (!storyState.story || !storyState.openPath) {
    addNotification({
      title: 'No story or open path',
      message: 'You must have an open path to be able to auto save a story.',
      type: 'error',
    })
    return
  }

  try {
    // Use the stateToStory function to get the base story data
    const storyData = stateToStory()

    // Add the additional fields needed for saving
    const savePayload: SavePayload = {
      ...storyData,
      newAutosave: withAutosave,
      changesSince: forceFullSave ? undefined : (unwrap(uiState).lastSaveAt ?? unwrap(storyState).expectedLastModified),
      expectedLastModified: unwrap(storyState).expectedLastModified,
    }

    const persisted = saveSchema.parse(savePayload)

    if (
      Object.keys(treeState.structure).length > 0 &&
      Object.keys(scenesState.scenes).length === 0 &&
      Object.keys(booksStore.books).length === 0
    ) {
      addNotification({
        title: 'No scenes or books',
        message: 'Maybe something went wrong, tree has items, but books and scenes do not.',
        type: 'error',
      })
      return
    }

    const openPath = storyState.openPath
    if (!openPath) {
      return
    }

    await saveProject(openPath, persisted)

    setLastSaveAt(Date.now())
  } catch (error) {
    console.error('Error saving story:', error)
    addNotification({
      title: 'Save failed',
      message: error instanceof Error ? error.message : 'An unknown error occurred',
      type: 'error',
    })
  }
}
