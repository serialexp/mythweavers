// Chapter -> scenes. The model returns one scene paragraph per line. Neighbour
// scene context falls back to scene summaries (no prose generation in scope).

import { errorStore } from '../../../stores/errorStore'
import { nodeStore } from '../../../stores/nodeStore'
import type { Node } from '../../../types/core'
import { runSnowflakePrompt } from '../ai'
import { SNOWFLAKE_EXPAND_CHAPTER } from '../prompts'
import { snowflakeStore } from '../store'
import {
  childrenOf,
  deriveTitle,
  fallbackTitle,
  parentOf,
  parseLineSummaries,
  siblingIndex,
  siblingsOf,
  summaryOf,
} from './helpers'

export async function expandChapter(chapter: Node): Promise<void> {
  if (summaryOf(chapter).trim().length === 0) {
    errorStore.addError('Write a one-liner for this chapter before expanding it into scenes.', 'warning')
    return
  }

  snowflakeStore.setLoading(chapter.id, true)
  try {
    const arc = parentOf(chapter)
    const book = arc ? parentOf(arc) : null

    const siblings = siblingsOf(chapter)
    const index = siblingIndex(chapter)
    const previousChapter = siblings[index - 1]
    const nextChapter = siblings[index + 1]

    const lastSceneOf = (ch: Node | undefined): string => {
      if (!ch) return ''
      const scenes = childrenOf(ch.id).filter((n) => n.type === 'scene')
      return scenes.length > 0 ? summaryOf(scenes[scenes.length - 1]) : ''
    }
    const firstSceneOf = (ch: Node | undefined): string => {
      if (!ch) return ''
      const scenes = childrenOf(ch.id).filter((n) => n.type === 'scene')
      return scenes.length > 0 ? summaryOf(scenes[0]) : ''
    }

    const instruction = [
      `<story_context>\nBook: ${summaryOf(book)}\nArc: ${summaryOf(arc)}\n</story_context>`,
      `<previous_chapter>\n${summaryOf(previousChapter)}\n</previous_chapter>`,
      `<current_chapter>\n${summaryOf(chapter)}\n</current_chapter>`,
      `<next_chapter>\n${summaryOf(nextChapter)}\n</next_chapter>`,
      `<previous_scene>\n${lastSceneOf(previousChapter)}\n</previous_scene>`,
      `<next_scene>\n${firstSceneOf(nextChapter)}\n</next_scene>`,
      `<instructions>\nGenerate a sequence of scenes that tell this chapter's story, one per line.\n</instructions>`,
    ].join('\n\n')

    const raw = await runSnowflakePrompt({
      system: SNOWFLAKE_EXPAND_CHAPTER,
      instruction,
      callType: 'outline:expand',
    })

    const scenes = parseLineSummaries(raw)
    if (scenes.length === 0) {
      errorStore.addError('The model returned no scenes. Try again.', 'error')
      return
    }

    const existing = childrenOf(chapter.id).filter((n) => n.type === 'scene').length
    scenes.forEach((summary, i) => {
      const scene = nodeStore.addNode(chapter.id, 'scene', deriveTitle(summary, fallbackTitle('scene', existing + i)))
      nodeStore.updateNode(scene.id, { summary })
    })
  } catch (error) {
    console.error('[snowflake] expandChapter failed:', error)
    errorStore.addError(`Failed to expand chapter: ${error instanceof Error ? error.message : String(error)}`, 'error')
  } finally {
    snowflakeStore.setLoading(chapter.id, false)
  }
}
