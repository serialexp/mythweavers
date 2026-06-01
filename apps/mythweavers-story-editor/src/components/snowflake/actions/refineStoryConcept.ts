// Expand the story-level concept into a richer multi-book description.
// Previews the result; on accept writes back to the story summary.

import { currentStoryStore } from '../../../stores/currentStoryStore'
import { errorStore } from '../../../stores/errorStore'
import { runSnowflakePrompt } from '../ai'
import { SNOWFLAKE_REFINE_STORY } from '../prompts'
import { snowflakeStore } from '../store'

const STORY_KEY = 'story'

export async function refineStoryConcept(): Promise<void> {
  const concept = (currentStoryStore.summary ?? '').trim()
  if (concept.length === 0) {
    errorStore.addError('Write a story concept before refining it.', 'warning')
    return
  }

  const loadingKey = `${STORY_KEY}:refine`
  snowflakeStore.setLoading(loadingKey, true)
  try {
    const refined = await runSnowflakePrompt({
      system: SNOWFLAKE_REFINE_STORY,
      instruction: concept,
      callType: 'outline:refine',
    })

    if (refined.trim().length === 0) {
      errorStore.addError('The model returned an empty refinement.', 'error')
      return
    }

    snowflakeStore.setPreview(STORY_KEY, {
      original: concept,
      refined,
      onAccept: () => {
        currentStoryStore.setSummary(refined)
        snowflakeStore.clearPreview(STORY_KEY)
      },
      onReject: () => snowflakeStore.clearPreview(STORY_KEY),
    })
  } catch (error) {
    console.error('[snowflake] refineStoryConcept failed:', error)
    errorStore.addError(`Failed to refine concept: ${error instanceof Error ? error.message : String(error)}`, 'error')
  } finally {
    snowflakeStore.setLoading(loadingKey, false)
  }
}
