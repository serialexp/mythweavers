import type { DifferenceResult } from '@writer/shared'
import { addNotification } from '../stores/notifications'
import { storyState } from '../stores/story'
import { setLastKnownServerUpdate, setSyncState } from '../stores/ui'
import { trpc } from '../trpc'
import { stateToStory } from './state-to-story'
import { prepareDifferenceInput } from './sync-utils'

/**
 * Checks for sync status between local and server versions of a story
 * @returns Promise<DifferenceResult | null> - The sync check result or null if there was an error or user is not signed in
 */
export const checkSyncStatus = async (): Promise<DifferenceResult | null> => {
  if (!storyState.story?.id || !trpc.checkStoryDifferences) {
    console.log('User not signed in or story ID missing, skipping difference check.')
    setSyncState(null)
    return null
  }

  const storyToCheck = storyState.story
  console.log('Checking story differences...')

  if (!storyToCheck || typeof storyToCheck !== 'object') {
    console.error('Cannot check differences: Invalid local story state.')
    setSyncState(null)
    return null
  }

  try {
    const { clientNodes, clientParagraphs } = prepareDifferenceInput(stateToStory().story)

    const result: DifferenceResult = await trpc.checkStoryDifferences.mutate({
      storyId: storyToCheck.id,
      clientNodes,
      clientParagraphs,
    })

    console.log('Difference check result:', result)
    setLastKnownServerUpdate(result.lastUpdate ?? null)
    setSyncState(result)

    return result
  } catch (error) {
    console.error('Failed to check story differences:', error)
    addNotification({
      title: 'Sync Check Failed',
      message: 'Could not compare local story with server version.',
      type: 'warning',
    })
    setSyncState(null)
    return null
  }
}

/**
 * Determines if there are conflicts between local and server versions
 * based on the difference result
 * @param diffResult The difference result from checkSyncStatus
 * @returns boolean - true if conflicts exist
 */
export const hasConflicts = (diffResult: DifferenceResult | null): boolean => {
  if (!diffResult) return false

  const hasLocalServerDiff = diffResult.localNew.length > 0 || diffResult.modifiedLocal.length > 0
  const hasServerDiff = diffResult.serverNew.length > 0 || diffResult.modifiedServer.length > 0

  return hasLocalServerDiff && hasServerDiff
}
