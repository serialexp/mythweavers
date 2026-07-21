// Refine a node to a target detail level (L1 sentence / L2 paragraph / L3
// canonical summary). Each result is stored independently.

import { errorStore } from '../../../stores/errorStore'
import { nodeStore } from '../../../stores/nodeStore'
import type { Node } from '../../../types/core'
import { runSnowflakePrompt } from '../ai'
import type { RefinementLevel } from '../constants'
import { refinePromptForType } from '../prompts'
import { snowflakeStore } from '../store'
import { parentOf, siblingIndex, siblingsOf, summaryAtLevel, summaryFieldForLevel, summaryOf } from './helpers'

const REFINE_OP = 'refine'

/** Build the XML instruction with the context tags relevant to a node type. */
function buildRefineInstruction(node: Node, targetLevel: RefinementLevel): string {
  const tags: string[] = []

  if (node.type === 'book') {
    const siblings = siblingsOf(node)
    const previous = siblings[siblingIndex(node) - 1]
    tags.push(`<previous_book_summary>\n${summaryOf(previous)}\n</previous_book_summary>`)
  } else if (node.type === 'arc') {
    tags.push(`<book_context>\n${summaryOf(parentOf(node))}\n</book_context>`)
  } else if (node.type === 'chapter') {
    const arcNode = parentOf(node)
    tags.push(`<book_context>\n${summaryOf(arcNode ? parentOf(arcNode) : null)}\n</book_context>`)
    tags.push(`<arc_context>\n${summaryOf(arcNode)}\n</arc_context>`)
  } else if (node.type === 'scene') {
    const chapterNode = parentOf(node)
    const arcNode = chapterNode ? parentOf(chapterNode) : null
    tags.push(`<book_context>\n${summaryOf(arcNode ? parentOf(arcNode) : null)}\n</book_context>`)
    tags.push(`<arc_context>\n${summaryOf(arcNode)}\n</arc_context>`)
    tags.push(`<chapter_context>\n${summaryOf(chapterNode)}\n</chapter_context>`)
    const siblings = siblingsOf(node)
    const idx = siblingIndex(node)
    tags.push(`<previous_scene>\n${summaryOf(siblings[idx - 1])}\n</previous_scene>`)
    tags.push(`<next_scene>\n${summaryOf(siblings[idx + 1])}\n</next_scene>`)
  }

  tags.push(`<current_summary>\n${summaryOf(node)}\n</current_summary>`)
  tags.push(`<target_level>\n${targetLevel}\n</target_level>`)
  return tags.join('\n\n')
}

export async function refineSummary(node: Node, targetLevel: RefinementLevel): Promise<void> {
  if (summaryOf(node).trim().length === 0) {
    errorStore.addError('Write a one-liner before refining it.', 'warning')
    return
  }

  const loadingKey = `${node.id}:${REFINE_OP}`
  snowflakeStore.setLoading(loadingKey, true)
  try {
    const refined = await runSnowflakePrompt({
      system: refinePromptForType(node.type),
      instruction: buildRefineInstruction(node, targetLevel),
      callType: 'outline:refine',
    })

    if (refined.trim().length === 0) {
      errorStore.addError('The model returned an empty refinement.', 'error')
      return
    }

    const original = summaryAtLevel(node, targetLevel)
    snowflakeStore.setPreview(node.id, {
      original,
      refined,
      level: targetLevel,
      onAccept: () => {
        nodeStore.updateNode(node.id, { [summaryFieldForLevel(targetLevel)]: refined })
        snowflakeStore.clearPreview(node.id)
      },
      onReject: () => snowflakeStore.clearPreview(node.id),
    })
  } catch (error) {
    console.error('[snowflake] refineSummary failed:', error)
    errorStore.addError(`Failed to refine summary: ${error instanceof Error ? error.message : String(error)}`, 'error')
  } finally {
    snowflakeStore.setLoading(loadingKey, false)
  }
}
