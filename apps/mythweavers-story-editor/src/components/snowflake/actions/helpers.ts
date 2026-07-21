// Tree-walking helpers shared across the snowflake actions. All read from
// nodeStore; none mutate. Snowflake summary levels are stored independently;
// `summary` is always the canonical, most complete version.
//
// Pure text/parsing helpers live in ./parse (no store imports) and are
// re-exported here for convenience.

import { nodeStore } from '../../../stores/nodeStore'
import type { Node } from '../../../types/core'
import type { RefinementLevel } from '../constants'

export {
  cleanArcLine,
  deriveTitle,
  determineRefinementLevel,
  fallbackTitle,
  parseDelimitedSummaries,
  parseGeneratedBooks,
  parseLineSummaries,
} from './parse'

/** Direct children of a node (or root books when parentId is null), ordered. */
export function childrenOf(parentId: string | null): Node[] {
  return nodeStore.nodesArray
    .filter((n) => (parentId === null ? !n.parentId : n.parentId === parentId))
    .sort((a, b) => a.order - b.order)
}

/** Root-level books, ordered. */
export function rootBooks(): Node[] {
  return childrenOf(null).filter((n) => n.type === 'book')
}

/** The parent node of a node, or null at the root. */
export function parentOf(node: Node): Node | null {
  return node.parentId ? nodeStore.getNode(node.parentId) : null
}

/** Ordered siblings of a node (including the node itself), of the same type. */
export function siblingsOf(node: Node): Node[] {
  return childrenOf(node.parentId ?? null).filter((n) => n.type === node.type)
}

/** Index of a node among its ordered siblings, or -1. */
export function siblingIndex(node: Node): number {
  return siblingsOf(node).findIndex((n) => n.id === node.id)
}

export type NodeSummaryField = 'sentenceSummary' | 'paragraphSummary' | 'summary'

export function summaryFieldForLevel(level: RefinementLevel): NodeSummaryField {
  if (level === 1) return 'sentenceSummary'
  if (level === 2) return 'paragraphSummary'
  return 'summary'
}

export function summaryAtLevel(node: Node | null | undefined, level: RefinementLevel): string {
  return node?.[summaryFieldForLevel(level)] ?? ''
}

export function highestSummaryLevel(node: Node | null | undefined): RefinementLevel | null {
  if (node?.summary?.trim()) return 3
  if (node?.paragraphSummary?.trim()) return 2
  if (node?.sentenceSummary?.trim()) return 1
  return null
}

/** Canonical summary, falling back to an earlier Snowflake level while incomplete. */
export function summaryOf(node: Node | null | undefined): string {
  return node?.summary ?? node?.paragraphSummary ?? node?.sentenceSummary ?? ''
}
