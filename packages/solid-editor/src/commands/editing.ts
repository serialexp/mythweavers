/**
 * Editing commands for solidjs-editor
 *
 * Commands for structural editing: splitting blocks, joining blocks, etc.
 */

import type { CommandContext } from '../keymap'
import type { EditorState, Transaction } from '../state'
import { TextSelection } from '../state/selection'
import { canJoin, canSplit } from '../transform'

/**
 * Command type - same as keymap Command
 */
export type Command = (state: EditorState, dispatch?: (tr: Transaction) => void, view?: CommandContext) => boolean

/**
 * Find the default block type for a position after `index` children
 * in the node at the given depth of `$pos`.
 */
function defaultBlockAt($pos: ResolvedPos, depth: number): import('../model').NodeType | null {
  const parent = $pos.node(depth)
  const indexAfter = $pos.indexAfter(depth)
  const match = parent.contentMatchAt(indexAfter)
  return match.defaultType()
}

/**
 * Split the parent block at the cursor position.
 *
 * When splitting at the end of a textblock (e.g. a heading), the new block
 * is created as the parent's default block type (typically a paragraph)
 * rather than duplicating the current block type.
 *
 * If there's a selection, it deletes the selection first, then splits.
 */
export const splitBlock: Command = (state, dispatch) => {
  const { $from, $to } = state.selection

  // Handle non-empty selection - delete first, then split
  if (!state.selection.empty) {
    if (dispatch) {
      const tr = state.tr()
      tr.deleteSelection()

      // Get the new position after deletion
      const mappedPos = tr.mapping.map($from.pos)
      const $pos = tr.doc.resolve(mappedPos)

      // Only split if we're in a textblock
      if ($pos.parent.isTextblock && canSplit(tr.doc, mappedPos)) {
        const atEnd = $pos.parentOffset === $pos.parent.content.size
        const deflt = atEnd ? defaultBlockAt($pos, $pos.depth - 1) : undefined
        const typeAfter = deflt && deflt !== $pos.parent.type ? deflt : undefined
        tr.split(mappedPos, 1, typeAfter ? [{ type: typeAfter }] : undefined)
      }

      dispatch(tr)
    }
    return true
  }

  // Empty selection - check if we're in a textblock
  if (!$from.parent.isTextblock) return false

  // Check if split is valid at this position
  if (!canSplit(state.doc, $from.pos)) return false

  if (dispatch) {
    const tr = state.tr()

    // When at the end of a non-paragraph textblock (like a heading),
    // create the parent's default block type (paragraph) instead of
    // duplicating the heading.
    const atEnd = $from.parentOffset === $from.parent.content.size
    const deflt = atEnd ? defaultBlockAt($from, $from.depth - 1) : undefined
    const typeAfter = deflt && deflt !== $from.parent.type ? deflt : undefined
    tr.split($from.pos, 1, typeAfter ? [{ type: typeAfter }] : undefined)

    // Position cursor at start of new block
    // After split at depth 1, the position shifts by 2 (closing + opening tags)
    const newPos = $from.pos + 2
    const sel = TextSelection.create(tr.doc, newPos)
    tr.setSelection(sel)

    dispatch(tr)
  }

  return true
}

/**
 * A variant of splitBlock that preserves the marks at the cursor.
 */
export const splitBlockKeepMarks: Command = (state, dispatch) => {
  return splitBlock(
    state,
    dispatch &&
      ((tr) => {
        const marks = state.storedMarks || (state.selection.$to.parentOffset && state.selection.$from.marks())
        if (marks) tr.ensureMarks(marks)
        dispatch(tr)
      }),
  )
}

/**
 * When at the start of a textblock, join with the previous block.
 * This is what happens when you press backspace at the start of a paragraph.
 */
export const joinBackward: Command = (state, dispatch) => {
  const sel = state.selection as TextSelection
  const { $cursor } = sel

  // Need a cursor (empty selection)
  if (!$cursor) return false

  // Must be at the start of the textblock
  if ($cursor.parentOffset > 0) return false

  // Find the join point (boundary before this block)
  const $cut = findCutBefore($cursor)
  if (!$cut) return false

  // Check if we can join at this position
  const before = $cut.nodeBefore
  const after = $cut.nodeAfter

  if (!before || !after) return false

  // If both are textblocks with compatible content, join them
  if (before.isTextblock && after.isTextblock) {
    if (canJoin(state.doc, $cut.pos)) {
      if (dispatch) {
        const tr = state.tr()
        tr.join($cut.pos)

        // Position cursor at the join point (end of previous content)
        const joinPos = $cut.pos - 1
        const sel = TextSelection.create(tr.doc, joinPos)
        tr.setSelection(sel)

        dispatch(tr)
      }
      return true
    }
  }

  // If the current block is empty, try to delete it
  if ($cursor.parent.content.size === 0) {
    if (dispatch) {
      const tr = state.tr()
      // Delete the empty paragraph
      const from = $cursor.before()
      const to = $cursor.after()
      tr.delete(from, to)

      // Position cursor at end of previous block
      const newPos = Math.max(0, from - 1)
      const $newPos = tr.doc.resolve(newPos)
      const sel = TextSelection.near($newPos, -1) || TextSelection.create(tr.doc, newPos)
      tr.setSelection(sel)

      dispatch(tr)
    }
    return true
  }

  return false
}

/**
 * When at the end of a textblock, join with the next block.
 * This is what happens when you press delete at the end of a paragraph.
 */
export const joinForward: Command = (state, dispatch) => {
  const sel = state.selection as TextSelection
  const { $cursor } = sel

  // Need a cursor (empty selection)
  if (!$cursor) return false

  // Must be at the end of the textblock
  if ($cursor.parentOffset < $cursor.parent.content.size) return false

  // Find the join point (boundary after this block)
  const $cut = findCutAfter($cursor)
  if (!$cut) return false

  // Check if we can join at this position
  const before = $cut.nodeBefore
  const after = $cut.nodeAfter

  if (!before || !after) return false

  // If both are textblocks with compatible content, join them
  if (before.isTextblock && after.isTextblock) {
    if (canJoin(state.doc, $cut.pos)) {
      if (dispatch) {
        const tr = state.tr()
        tr.join($cut.pos)
        dispatch(tr)
      }
      return true
    }
  }

  // If the next block is empty, delete it
  if (after.content.size === 0) {
    if (dispatch) {
      const tr = state.tr()
      tr.delete($cut.pos, $cut.pos + after.nodeSize)
      dispatch(tr)
    }
    return true
  }

  return false
}

/**
 * Delete the selection, or the character before the cursor if empty.
 * At block boundary, joins with previous block.
 */
export const deleteBackward: Command = (state, dispatch) => {
  // If selection is not empty, delete it
  if (!state.selection.empty) {
    if (dispatch) {
      dispatch(state.tr().deleteSelection())
    }
    return true
  }

  // Try joining backward first (at block boundary)
  if (joinBackward(state, dispatch)) {
    return true
  }

  // Otherwise, delete one character backward
  const { $from } = state.selection
  if ($from.parentOffset === 0) return false

  if (dispatch) {
    const tr = state.tr()
    tr.delete($from.pos - 1, $from.pos)
    dispatch(tr)
  }
  return true
}

/**
 * Delete the selection, or the character after the cursor if empty.
 * At block boundary, joins with next block.
 */
export const deleteForward: Command = (state, dispatch) => {
  // If selection is not empty, delete it
  if (!state.selection.empty) {
    if (dispatch) {
      dispatch(state.tr().deleteSelection())
    }
    return true
  }

  // Try joining forward first (at block boundary)
  if (joinForward(state, dispatch)) {
    return true
  }

  // Otherwise, delete one character forward
  const { $to } = state.selection
  if ($to.parentOffset >= $to.parent.content.size) return false

  if (dispatch) {
    const tr = state.tr()
    tr.delete($to.pos, $to.pos + 1)
    dispatch(tr)
  }
  return true
}

/**
 * Insert a hard break (<br>) at the cursor position.
 *
 * If the schema has a `hard_break` node type and it's allowed at the cursor
 * position, inserts one. Preserves any stored marks across the break.
 */
export const insertHardBreak: Command = (state, dispatch) => {
  const hbType = state.schema.nodes.hard_break
  if (!hbType) return false

  if (dispatch) {
    const tr = state.tr()
    tr.replaceSelectionWith(hbType.create())
    // Preserve stored marks (or current marks at cursor) so that typing
    // after the break continues with the same formatting.
    const marks = state.storedMarks ?? state.selection.$from.marks()
    tr.setStoredMarks(marks)
    dispatch(tr)
  }
  return true
}

// ============================================================================
// Helper functions
// ============================================================================

import type { ResolvedPos } from '../model'

/**
 * Find the cut point before the given position (the boundary between blocks).
 * Returns the position at the boundary between this block and its predecessor.
 */
function findCutBefore($pos: ResolvedPos): ResolvedPos | null {
  // Check if the immediate parent is isolating
  if ($pos.parent.type.spec.isolating) return null

  // Walk up the tree to find an ancestor with a sibling before
  for (let i = $pos.depth - 1; i >= 0; i--) {
    // Check if there's a sibling before at this depth
    if ($pos.index(i) > 0) {
      // Return the position before the node at depth i + 1
      return $pos.doc.resolve($pos.before(i + 1))
    }
    // If this level is isolating, stop
    if ($pos.node(i).type.spec.isolating) break
  }
  return null
}

/**
 * Find the cut point after the given position (the boundary between blocks).
 * Returns the position at the boundary between this block and its successor.
 */
function findCutAfter($pos: ResolvedPos): ResolvedPos | null {
  // Check if the immediate parent is isolating
  if ($pos.parent.type.spec.isolating) return null

  // Walk up the tree to find an ancestor with a sibling after
  for (let i = $pos.depth - 1; i >= 0; i--) {
    const node = $pos.node(i)
    // Check if there's a sibling after at this depth
    if ($pos.indexAfter(i) < node.childCount) {
      // Return the position after the node at depth i + 1
      return $pos.doc.resolve($pos.after(i + 1))
    }
    // If this level is isolating, stop
    if (node.type.spec.isolating) break
  }
  return null
}
