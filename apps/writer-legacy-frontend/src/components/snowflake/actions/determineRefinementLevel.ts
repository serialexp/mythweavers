import type { Node } from '@writer/shared'
import type { RefinementLevel } from '../constants'

export const determineRefinementLevel = (node: Node): RefinementLevel => {
  // If we have summaries history, use the last level
  if (node.summaries?.length) {
    return node.summaries[node.summaries.length - 1].level as RefinementLevel
  }

  // Otherwise, infer from the current oneliner length
  if (!node.oneliner) return 1 as RefinementLevel

  const text = node.oneliner
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0)

  if (sentences.length <= 1) return 1 as RefinementLevel
  if (sentences.length <= 4) return 2 as RefinementLevel
  return 3 as RefinementLevel
}
