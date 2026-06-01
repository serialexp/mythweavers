// Arc -> N chapters. The model returns one chapter paragraph per line.

import { currentStoryStore } from '../../../stores/currentStoryStore'
import { errorStore } from '../../../stores/errorStore'
import { nodeStore } from '../../../stores/nodeStore'
import type { Node } from '../../../types/core'
import { runSnowflakePrompt } from '../ai'
import { SNOWFLAKE_EXPAND_ARC } from '../prompts'
import { snowflakeStore } from '../store'
import {
  childrenOf,
  deriveTitle,
  fallbackTitle,
  parseLineSummaries,
  siblingIndex,
  siblingsOf,
  summaryOf,
} from './helpers'

export async function expandArc(arc: Node, chapterCount: number): Promise<void> {
  if (summaryOf(arc).trim().length === 0) {
    errorStore.addError('Write a one-liner for this arc before expanding it into chapters.', 'warning')
    return
  }

  snowflakeStore.setLoading(arc.id, true)
  try {
    const siblings = siblingsOf(arc)
    const index = siblingIndex(arc)

    const previousArcs = siblings
      .slice(0, index)
      .map((a, i) => {
        const chapters = childrenOf(a.id)
          .filter((n) => n.type === 'chapter')
          .map((c) => `- ${summaryOf(c)}`)
          .join('\n')
        return `Arc ${i + 1}: ${summaryOf(a)}${chapters ? `\nChapters:\n${chapters}` : ''}`
      })
      .join('\n\n')
    const nextArc = siblings[index + 1]

    const instruction = [
      `<story_context>\n${currentStoryStore.summary ?? ''}\n</story_context>`,
      `<previous_arcs>\n${previousArcs}\n</previous_arcs>`,
      `<current_arc>\n${summaryOf(arc)}\n</current_arc>`,
      `<next_arc>\n${nextArc ? summaryOf(nextArc) : ''}\n</next_arc>`,
      `<instructions>\nGenerate ${chapterCount} chapters for this arc, one per line.\n</instructions>`,
    ].join('\n\n')

    const raw = await runSnowflakePrompt({
      system: SNOWFLAKE_EXPAND_ARC,
      instruction,
      callType: 'outline:expand',
    })

    const chapters = parseLineSummaries(raw)
    if (chapters.length === 0) {
      errorStore.addError('The model returned no chapters. Try again.', 'error')
      return
    }

    const existing = childrenOf(arc.id).filter((n) => n.type === 'chapter').length
    chapters.forEach((summary, i) => {
      const chapter = nodeStore.addNode(arc.id, 'chapter', deriveTitle(summary, fallbackTitle('chapter', existing + i)))
      nodeStore.updateNode(chapter.id, { summary })
    })
  } catch (error) {
    console.error('[snowflake] expandArc failed:', error)
    errorStore.addError(`Failed to expand arc: ${error instanceof Error ? error.message : String(error)}`, 'error')
  } finally {
    snowflakeStore.setLoading(arc.id, false)
  }
}
