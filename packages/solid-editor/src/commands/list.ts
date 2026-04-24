/**
 * List commands for solidjs-editor
 *
 * Commands for working with ordered and unordered lists:
 * - wrapInList: wrap selection in a list (or change list type)
 * - liftListItem: outdent a list item
 * - sinkListItem: indent a list item
 * - splitListItem: split a list item on Enter (or lift if empty)
 */

import { Fragment, type Node, NodeRange, type NodeType, type ResolvedPos, Slice } from '../model'
import type { Attrs } from '../model/types'
import type { EditorState, Transaction } from '../state'
import { TextSelection } from '../state/selection'
import { ReplaceAroundStep } from '../transform/replace_around_step'
import { canJoin, canSplit, findWrapping, liftTarget } from '../transform/structure'
import type { Command } from './editing'

// ============================================================================
// wrapInList
// ============================================================================

/**
 * Returns a command that wraps the selection in a list of the given type.
 *
 * If the cursor is already inside a list of the same type, returns false.
 * If inside a list of a different type, changes the list type.
 * Otherwise, wraps the selected block(s) in a new list.
 */
export function wrapInList(listType: NodeType, attrs?: Attrs | null): Command {
  return (state: EditorState, dispatch?: (tr: Transaction) => void): boolean => {
    const { $from, $to } = state.selection
    const range = $from.blockRange($to)
    if (!range) return false

    // Check if we're already inside a list
    const existingList = findListAncestor($from, listType)
    if (existingList) {
      // Already in a list of the same type
      if (existingList.node.type === listType) return false
      // Different list type — change it
      if (dispatch) {
        const tr = state.tr()
        tr.setNodeMarkup(existingList.pos, listType, attrs ?? null)
        dispatch(tr)
      }
      return true
    }

    // Find valid wrapping
    const wrappers = findWrapping(range, listType, attrs)
    if (!wrappers) return false

    if (dispatch) {
      const tr = state.tr()
      tr.wrap(range, wrappers)
      dispatch(tr)
    }
    return true
  }
}

// ============================================================================
// liftListItem
// ============================================================================

/**
 * Returns a command that lifts the selected list item out of its list.
 *
 * If the list item is nested (inside a sub-list within another list_item),
 * lifts it to the outer list level.
 *
 * If the list item is at the top level (list is a direct child of doc or
 * a non-list block), unwraps the list_item's content entirely by lifting
 * through both the list_item and the list wrappers.
 */
export function liftListItem(itemType: NodeType): Command {
  return (state: EditorState, dispatch?: (tr: Transaction) => void): boolean => {
    const { $from, $to } = state.selection

    // Find the nearest list_item ancestor
    const itemInfo = findAncestor($from, itemType)
    if (!itemInfo) return false

    const { depth: itemDepth } = itemInfo
    const listDepth = itemDepth - 1
    if (listDepth < 0) return false

    // Check if this is a nested list (list is inside another list_item)
    const isNested = listDepth > 0 && $from.node(listDepth - 1).type === itemType

    if (isNested) {
      // Nested case: lift the list_item to the outer list.
      // Use blockRange with a predicate matching the inner list.
      const range = $from.blockRange(
        $to,
        (node) => node.childCount > 0 && node.firstChild!.type === itemType,
      )
      if (!range) return false

      const target = liftTarget(range)
      if (target == null) return false

      if (dispatch) {
        const tr = state.tr()
        tr.lift(range, target)
        dispatch(tr)
      }
      return true
    }

    // Top-level case: lift the list_item's content (paragraphs/blocks)
    // out of both the list_item and the list wrappers.
    //
    // Get a range covering the content inside the list_item itself.
    // blockRange() without predicate finds the deepest common block,
    // which for a cursor inside a paragraph in a list_item is the list_item.
    const $liStart = state.doc.resolve($from.start(itemDepth))
    const $liEnd = state.doc.resolve($to.end(itemDepth))
    const innerRange = $liStart.blockRange($liEnd)
    if (!innerRange) return false

    const target = liftTarget(innerRange)
    if (target == null) return false

    if (dispatch) {
      const tr = state.tr()
      tr.lift(innerRange, target)
      dispatch(tr)
    }
    return true
  }
}

// ============================================================================
// sinkListItem
// ============================================================================

/**
 * Returns a command that sinks (indents) the selected list item into
 * the previous sibling item, nesting it in a sub-list.
 *
 * The current list item must have a preceding sibling. The item is
 * wrapped in a new sub-list of the same type as the parent list and
 * placed at the end of the previous sibling's content. If the previous
 * sibling already ends with a sub-list of the same type, the new
 * sub-list is joined with it.
 */
export function sinkListItem(itemType: NodeType): Command {
  return (state: EditorState, dispatch?: (tr: Transaction) => void): boolean => {
    const { $from, $to } = state.selection

    // Find the range around the list item(s) to sink
    const range = $from.blockRange($to, (node) => node.childCount > 0 && node.firstChild!.type === itemType)
    if (!range) return false

    // Must not be the first item in the list
    if (range.startIndex === 0) return false

    // The parent is the list node (bullet_list or ordered_list)
    const listType = range.parent.type

    if (dispatch) {
      const tr = state.tr()

      // We'll use a ReplaceAroundStep to atomically move the list item(s)
      // inside the previous sibling, wrapped in a new sub-list.
      //
      // Before:
      //   list
      //     list_item (prev)    ← ends at range.start
      //       paragraph "A"
      //     list_item (current) ← range.start to range.end
      //       paragraph "B"
      //
      // After:
      //   list
      //     list_item (prev)
      //       paragraph "A"
      //       sub_list           ← new
      //         list_item        ← moved
      //           paragraph "B"

      // Build the slice: a list_item containing an empty sub-list
      // openStart=1 means the list_item is "open" (continues the prev item)
      // openEnd=0 means everything is fully closed
      const sliceContent = Fragment.from(itemType.create(null, listType.create()))
      const slice = new Slice(sliceContent, 1, 0)

      // from: just before the prev item's closing tag (end of its content)
      // to: after the last selected item
      // gap: the selected item(s) themselves
      const from = range.start - 1 // inside prev item, at end of its content
      const to = range.end
      const gapFrom = range.start
      const gapTo = range.end

      // insert=1: gap content goes at depth 1 in the slice (inside the sub-list)
      tr.step(new ReplaceAroundStep(from, to, gapFrom, gapTo, slice, 1, true))

      // Check if we should join with an existing sub-list in the previous item.
      // After the step, the prev item may have two adjacent sub-lists of
      // the same type that can be merged. Find them by scanning the prev
      // item's children.
      const mappedStart = tr.mapping.map(range.start)
      const $mapped = tr.doc.resolve(mappedStart)
      // Walk up to find the list_item that now contains the new sub-list
      for (let d = $mapped.depth; d > 0; d--) {
        const node = $mapped.node(d)
        if (node.type === itemType) {
          // Scan children for adjacent lists of the same type
          let offset = $mapped.start(d)
          for (let i = 0; i < node.childCount - 1; i++) {
            offset += node.child(i).nodeSize
            if (node.child(i).type === listType && node.child(i + 1).type === listType) {
              if (canJoin(tr.doc, offset)) {
                tr.join(offset)
              }
              break
            }
          }
          break
        }
      }

      dispatch(tr)
    }
    return true
  }
}

// ============================================================================
// splitListItem
// ============================================================================

/**
 * Returns a command that splits a list item at the cursor position.
 *
 * When the cursor is inside a list item:
 * - If the item contains only an empty paragraph, lifts the item out
 *   (like pressing Enter on an empty bullet).
 * - Otherwise, splits the list item at the cursor, creating a new
 *   list item below with the content after the cursor.
 */
export function splitListItem(itemType: NodeType): Command {
  return (state: EditorState, dispatch?: (tr: Transaction) => void): boolean => {
    const { $from, $to } = state.selection

    // Find the innermost list_item ancestor
    const itemInfo = findAncestor($from, itemType)
    if (!itemInfo) return false

    const { depth: itemDepth } = itemInfo
    const itemNode = $from.node(itemDepth)

    // If the list item has only one child (a paragraph) and it's empty,
    // lift the item out instead of splitting
    if (
      itemNode.childCount === 1 &&
      itemNode.child(0).content.size === 0
    ) {
      return liftListItem(itemType)(state, dispatch)
    }

    // Non-empty selection: delete first, then re-check
    if (!state.selection.empty) {
      if (dispatch) {
        const tr = state.tr()
        tr.deleteSelection()
        dispatch(tr)
      }
      return true
    }

    // Compute split depth: how many levels between cursor and list_item
    // For cursor in paragraph inside list_item, this is typically 2
    // (split both the paragraph and the list_item)
    const splitDepth = $from.depth - itemDepth + 1

    // Build typesAfter: preserve the node types at each level
    // but the innermost nodes should use their defaults
    const typesAfter: { type: NodeType; attrs?: Attrs | null }[] = []
    for (let d = 0; d < splitDepth; d++) {
      const nodeAtLevel = $from.node(itemDepth + d)
      if (d === 0) {
        // The new list_item
        typesAfter.push({ type: itemType })
      } else {
        // Inner nodes (paragraph, etc.) — use the default type for this position
        // At the end of a textblock, use the parent's default type
        const atEnd = $from.parentOffset === $from.parent.content.size
        if (atEnd && d === splitDepth - 1) {
          // At the end of the textblock, use the parent list_item's default child type
          const defaultType = itemType.contentMatch?.defaultType()
          if (defaultType) {
            typesAfter.push({ type: defaultType })
          } else {
            typesAfter.push({ type: nodeAtLevel.type, attrs: nodeAtLevel.attrs })
          }
        } else {
          typesAfter.push({ type: nodeAtLevel.type, attrs: nodeAtLevel.attrs })
        }
      }
    }

    if (!canSplit(state.doc, $from.pos, splitDepth, typesAfter)) {
      return false
    }

    if (dispatch) {
      const tr = state.tr()
      tr.split($from.pos, splitDepth, typesAfter)

      // Set cursor at start of the new list item's first textblock
      const newPos = $from.pos + splitDepth * 2
      const sel = TextSelection.create(tr.doc, newPos)
      tr.setSelection(sel)

      dispatch(tr)
    }
    return true
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Find the innermost ancestor of the given type.
 */
function findAncestor(
  $pos: ResolvedPos,
  type: NodeType,
): { depth: number; node: Node } | null {
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).type === type) {
      return { depth: d, node: $pos.node(d) }
    }
  }
  return null
}

/**
 * Find the nearest list ancestor (any list type), returning the list node,
 * its position, and whether it matches the target type.
 */
function findListAncestor(
  $pos: ResolvedPos,
  targetListType: NodeType,
): { node: Node; pos: number; depth: number } | null {
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d)
    // A "list" node is one whose children are all of the same item type
    // and it belongs to the block group. We check by seeing if the node's
    // type has a spec with content matching list_item+
    if (node.type === targetListType || isListNode(node)) {
      return { node, pos: $pos.before(d), depth: d }
    }
  }
  return null
}

/**
 * Check if a node is a list node (contains list_item children).
 */
function isListNode(node: Node): boolean {
  return node.childCount > 0 && node.child(0).type.name === 'list_item'
}
