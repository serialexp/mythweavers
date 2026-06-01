// Bottom-up: summarize a node from its children's one-liners. Previews the
// result; on accept overwrites the node's summary.

import { errorStore } from '../../../stores/errorStore'
import { nodeStore } from '../../../stores/nodeStore'
import type { Node } from '../../../types/core'
import { runSnowflakePrompt } from '../ai'
import { LEVEL_DESCRIPTIONS } from '../constants'
import { SNOWFLAKE_PARENT } from '../prompts'
import { snowflakeStore } from '../store'
import { childrenOf, determineRefinementLevel, summaryOf } from './helpers'

const SUMMARIZE_OP = 'summarize'

export async function generateParentSummary(node: Node): Promise<void> {
  const children = childrenOf(node.id).filter((c) => summaryOf(c).trim().length > 0)
  if (children.length === 0) {
    errorStore.addError('This node has no child summaries to summarize from.', 'warning')
    return
  }

  const loadingKey = `${node.id}:${SUMMARIZE_OP}`
  snowflakeStore.setLoading(loadingKey, true)
  try {
    const level = determineRefinementLevel(summaryOf(node))
    const childSummaries = children.map((c) => summaryOf(c)).join('\n')
    const instruction = [
      `<child_summaries>\n${childSummaries}\n</child_summaries>`,
      `<current_level>\nLevel ${level} summary requested:\n${LEVEL_DESCRIPTIONS[level]}\n</current_level>`,
    ].join('\n\n')

    const refined = await runSnowflakePrompt({
      system: SNOWFLAKE_PARENT,
      instruction,
      callType: 'outline:summarize',
    })

    if (refined.trim().length === 0) {
      errorStore.addError('The model returned an empty summary.', 'error')
      return
    }

    snowflakeStore.setPreview(node.id, {
      original: summaryOf(node),
      refined,
      level,
      onAccept: () => {
        nodeStore.updateNode(node.id, { summary: refined })
        snowflakeStore.clearPreview(node.id)
      },
      onReject: () => snowflakeStore.clearPreview(node.id),
    })
  } catch (error) {
    console.error('[snowflake] generateParentSummary failed:', error)
    errorStore.addError(`Failed to summarize: ${error instanceof Error ? error.message : String(error)}`, 'error')
  } finally {
    snowflakeStore.setLoading(loadingKey, false)
  }
}
