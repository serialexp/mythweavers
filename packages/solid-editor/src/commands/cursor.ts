/**
 * Cursor movement commands for solid-editor
 *
 * These commands handle arrow key navigation and related cursor movements.
 * They follow the ProseMirror command signature: (state, dispatch?, view?) => boolean
 */

import type { CommandContext } from '../keymap'
import type { Node as DocNode, ResolvedPos } from '../model'
import type { EditorState, Transaction } from '../state'
import { Selection, TextSelection } from '../state/selection'

// DOM node type constants
const TEXT_NODE = 3
const ELEMENT_NODE = 1

/**
 * Command type - same as keymap Command
 */
export type Command = (state: EditorState, dispatch?: (tr: Transaction) => void, view?: CommandContext) => boolean

/**
 * Move the cursor one position to the left.
 * If there's a selection, collapses to the left side.
 */
export const cursorLeft: Command = (state, dispatch) => {
  const { selection } = state
  const { $head, empty } = selection

  // If there's a selection, collapse to the left edge
  if (!empty) {
    if (dispatch) {
      const sel = TextSelection.create(state.doc, selection.from)
      dispatch(state.tr().setSelection(sel))
    }
    return true
  }

  // Move one position left if possible
  const targetPos = $head.pos - 1
  if (targetPos < 0) return false

  // Find a valid selection at or near the target position
  const $target = state.doc.resolve(targetPos)
  const sel = Selection.findFrom($target, -1, true) || Selection.findFrom($target, 1, true)

  if (sel && dispatch) {
    dispatch(state.tr().setSelection(sel))
  }

  return !!sel
}

/**
 * Move the cursor one position to the right.
 * If there's a selection, collapses to the right side.
 */
export const cursorRight: Command = (state, dispatch) => {
  const { selection } = state
  const { $head, empty } = selection

  // If there's a selection, collapse to the right edge
  if (!empty) {
    if (dispatch) {
      const sel = TextSelection.create(state.doc, selection.to)
      dispatch(state.tr().setSelection(sel))
    }
    return true
  }

  // Move one position right if possible
  const targetPos = $head.pos + 1
  if (targetPos > state.doc.content.size) return false

  // Find a valid selection at or near the target position
  const $target = state.doc.resolve(targetPos)
  const sel = Selection.findFrom($target, 1, true) || Selection.findFrom($target, -1, true)

  if (sel && dispatch) {
    dispatch(state.tr().setSelection(sel))
  }

  return !!sel
}

/**
 * Move the cursor to the start of the current textblock.
 */
export const cursorLineStart: Command = (state, dispatch) => {
  const { $head } = state.selection

  // Find the start of the textblock
  const lineStart = $head.start($head.depth)

  if ($head.pos === lineStart) return false

  if (dispatch) {
    const sel = TextSelection.create(state.doc, lineStart)
    dispatch(state.tr().setSelection(sel))
  }

  return true
}

/**
 * Move the cursor to the end of the current textblock.
 */
export const cursorLineEnd: Command = (state, dispatch) => {
  const { $head } = state.selection

  // Find the end of the textblock
  const lineEnd = $head.end($head.depth)

  if ($head.pos === lineEnd) return false

  if (dispatch) {
    const sel = TextSelection.create(state.doc, lineEnd)
    dispatch(state.tr().setSelection(sel))
  }

  return true
}

/**
 * Move the cursor to the start of the document.
 */
export const cursorDocStart: Command = (state, dispatch) => {
  if (dispatch) {
    const sel = Selection.atStart(state.doc)
    dispatch(state.tr().setSelection(sel))
  }
  return true
}

/**
 * Move the cursor to the end of the document.
 */
export const cursorDocEnd: Command = (state, dispatch) => {
  if (dispatch) {
    const sel = Selection.atEnd(state.doc)
    dispatch(state.tr().setSelection(sel))
  }
  return true
}

/**
 * Extend the selection one position to the left (Shift+Left).
 */
export const selectLeft: Command = (state, dispatch) => {
  const { selection } = state
  const { $anchor, $head } = selection

  const targetPos = $head.pos - 1
  if (targetPos < 0) return false

  if (dispatch) {
    const _$target = state.doc.resolve(targetPos)
    const sel = TextSelection.create(state.doc, $anchor.pos, targetPos)
    dispatch(state.tr().setSelection(sel))
  }

  return true
}

/**
 * Extend the selection one position to the right (Shift+Right).
 */
export const selectRight: Command = (state, dispatch) => {
  const { selection } = state
  const { $anchor, $head } = selection

  const targetPos = $head.pos + 1
  if (targetPos > state.doc.content.size) return false

  if (dispatch) {
    const sel = TextSelection.create(state.doc, $anchor.pos, targetPos)
    dispatch(state.tr().setSelection(sel))
  }

  return true
}

/**
 * Extend the selection to the start of the line (Shift+Home).
 */
export const selectLineStart: Command = (state, dispatch) => {
  const { $anchor, $head } = state.selection
  const lineStart = $head.start($head.depth)

  if (dispatch) {
    const sel = TextSelection.create(state.doc, $anchor.pos, lineStart)
    dispatch(state.tr().setSelection(sel))
  }

  return true
}

/**
 * Extend the selection to the end of the line (Shift+End).
 */
export const selectLineEnd: Command = (state, dispatch) => {
  const { $anchor, $head } = state.selection
  const lineEnd = $head.end($head.depth)

  if (dispatch) {
    const sel = TextSelection.create(state.doc, $anchor.pos, lineEnd)
    dispatch(state.tr().setSelection(sel))
  }

  return true
}

/**
 * Extend the selection to the start of the document (Cmd/Ctrl+Shift+Home).
 */
export const selectDocStart: Command = (state, dispatch) => {
  const { $anchor } = state.selection
  const docStart = Selection.atStart(state.doc)

  if (dispatch) {
    const sel = TextSelection.create(state.doc, $anchor.pos, docStart.from)
    dispatch(state.tr().setSelection(sel))
  }

  return true
}

/**
 * Extend the selection to the end of the document (Cmd/Ctrl+Shift+End).
 */
export const selectDocEnd: Command = (state, dispatch) => {
  const { $anchor } = state.selection
  const docEnd = Selection.atEnd(state.doc)

  if (dispatch) {
    const sel = TextSelection.create(state.doc, $anchor.pos, docEnd.to)
    dispatch(state.tr().setSelection(sel))
  }

  return true
}

/**
 * Select all content (Cmd/Ctrl+A).
 */
export const selectAll: Command = (state, dispatch) => {
  if (dispatch) {
    const sel = TextSelection.create(state.doc, 0, state.doc.content.size)
    dispatch(state.tr().setSelection(sel))
  }
  return true
}

// ============================================================================
// Vertical movement (ArrowUp/ArrowDown) - requires DOM coordinates
// ============================================================================

/**
 * Stored goal column for vertical movement.
 * When moving up/down, we want to maintain the same horizontal position.
 */
let goalColumn: number | null = null

/**
 * Reset the goal column. Call this when selection changes from horizontal movement.
 */
export function resetGoalColumn(): void {
  goalColumn = null
}

/**
 * Move the cursor up one line.
 * Uses DOM coordinates to find the position above.
 */
export const cursorUp: Command = (state, dispatch, view) => {
  if (!view?.dom) return false

  const { selection } = state
  const { $head, empty } = selection

  // If there's a selection, collapse to the start
  if (!empty) {
    if (dispatch) {
      const sel = TextSelection.create(state.doc, selection.from)
      dispatch(state.tr().setSelection(sel))
    }
    resetGoalColumn()
    return true
  }

  // Try to move to previous textblock
  const $target = moveVertically(state.doc, $head, -1, view.dom)

  if (!$target || $target.pos === $head.pos) {
    // Can't move up, try to go to start of document
    if ($head.pos > 0) {
      if (dispatch) {
        const sel = Selection.atStart(state.doc)
        dispatch(state.tr().setSelection(sel))
      }
      return true
    }
    return false
  }

  if (dispatch) {
    const sel = TextSelection.create(state.doc, $target.pos)
    dispatch(state.tr().setSelection(sel))
  }

  return true
}

/**
 * Move the cursor down one line.
 * Uses DOM coordinates to find the position below.
 */
export const cursorDown: Command = (state, dispatch, view) => {
  if (!view?.dom) return false

  const { selection } = state
  const { $head, empty } = selection

  // If there's a selection, collapse to the end
  if (!empty) {
    if (dispatch) {
      const sel = TextSelection.create(state.doc, selection.to)
      dispatch(state.tr().setSelection(sel))
    }
    resetGoalColumn()
    return true
  }

  // Try to move to next textblock
  const $target = moveVertically(state.doc, $head, 1, view.dom)

  if (!$target || $target.pos === $head.pos) {
    // Can't move down, try to go to end of document
    if ($head.pos < state.doc.content.size) {
      if (dispatch) {
        const sel = Selection.atEnd(state.doc)
        dispatch(state.tr().setSelection(sel))
      }
      return true
    }
    return false
  }

  if (dispatch) {
    const sel = TextSelection.create(state.doc, $target.pos)
    dispatch(state.tr().setSelection(sel))
  }

  return true
}

/**
 * Extend selection up one line (Shift+Up).
 */
export const selectUp: Command = (state, dispatch, view) => {
  if (!view?.dom) return false

  const { $anchor, $head } = state.selection
  const $target = moveVertically(state.doc, $head, -1, view.dom)

  if (!$target || $target.pos === $head.pos) {
    // Go to start
    if (dispatch) {
      const sel = TextSelection.create(state.doc, $anchor.pos, 0)
      dispatch(state.tr().setSelection(sel))
    }
    return true
  }

  if (dispatch) {
    const sel = TextSelection.create(state.doc, $anchor.pos, $target.pos)
    dispatch(state.tr().setSelection(sel))
  }

  return true
}

/**
 * Extend selection down one line (Shift+Down).
 */
export const selectDown: Command = (state, dispatch, view) => {
  if (!view?.dom) return false

  const { $anchor, $head } = state.selection
  const $target = moveVertically(state.doc, $head, 1, view.dom)

  if (!$target || $target.pos === $head.pos) {
    // Go to end
    if (dispatch) {
      const sel = TextSelection.create(state.doc, $anchor.pos, state.doc.content.size)
      dispatch(state.tr().setSelection(sel))
    }
    return true
  }

  if (dispatch) {
    const sel = TextSelection.create(state.doc, $anchor.pos, $target.pos)
    dispatch(state.tr().setSelection(sel))
  }

  return true
}

// ============================================================================
// Helper functions for vertical movement
// ============================================================================

/**
 * Move vertically from the given position.
 * Returns the new resolved position, or null if can't move.
 */
function moveVertically(doc: DocNode, $pos: ResolvedPos, dir: -1 | 1, dom: HTMLElement): ResolvedPos | null {
  // Get the DOM position for the current cursor
  const domPos = getDOMPosition(dom, $pos.pos)
  if (!domPos) return null

  // Get the bounding rect for the current position
  const rect = getRectAtDOMPosition(domPos.node, domPos.offset)
  if (!rect) return null

  // Store/use goal column
  if (goalColumn === null) {
    goalColumn = rect.left
  }

  // Calculate target Y coordinate (move up or down by line height)
  const lineHeight = rect.height || 20
  const targetY = dir < 0 ? rect.top - lineHeight / 2 : rect.bottom + lineHeight / 2

  // Find position at the target coordinates
  const targetPos = posAtCoords(dom, goalColumn, targetY, doc)
  if (targetPos === null) return null

  // Make sure we actually moved to a different line
  if (targetPos === $pos.pos) {
    // Try harder - move further in the direction
    const furtherY = dir < 0 ? rect.top - lineHeight * 1.5 : rect.bottom + lineHeight * 1.5
    const furtherPos = posAtCoords(dom, goalColumn, furtherY, doc)
    if (furtherPos !== null && furtherPos !== $pos.pos) {
      return doc.resolve(furtherPos)
    }
    return null
  }

  return doc.resolve(targetPos)
}

/**
 * Get DOM position (node + offset) for a document position.
 */
function getDOMPosition(dom: HTMLElement, pos: number): { node: globalThis.Node; offset: number } | null {
  // Walk through the DOM to find the node with the given position
  // This uses the data-pos attributes set by the view layer
  const walker = document.createTreeWalker(dom, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)

  let currentPos = 0
  let node: globalThis.Node | null = walker.nextNode()

  while (node) {
    if (node.nodeType === TEXT_NODE) {
      const textLength = (node as Text).length
      if (currentPos + textLength >= pos) {
        return { node, offset: pos - currentPos }
      }
      currentPos += textLength
    } else if (node.nodeType === ELEMENT_NODE) {
      const el = node as HTMLElement
      const posAttr = el.getAttribute('data-pos')
      if (posAttr !== null) {
        const nodePos = Number.parseInt(posAttr, 10)
        if (!Number.isNaN(nodePos)) {
          // Check if pos is within this element
          const sizeAttr = el.getAttribute('data-size')
          if (sizeAttr) {
            const nodeSize = Number.parseInt(sizeAttr, 10)
            if (pos >= nodePos && pos < nodePos + nodeSize) {
              // Position is within this node, continue into children
            }
          }
        }
      }
    }
    node = walker.nextNode()
  }

  return null
}

/**
 * Get the bounding rectangle at a DOM position.
 */
function getRectAtDOMPosition(node: globalThis.Node, offset: number): DOMRect | null {
  try {
    const range = document.createRange()
    if (node.nodeType === TEXT_NODE) {
      const text = node as Text
      // Clamp offset to valid range
      const safeOffset = Math.min(offset, text.length)
      range.setStart(node, safeOffset)
      range.setEnd(node, safeOffset)
    } else {
      range.setStart(node, 0)
      range.setEnd(node, 0)
    }

    const rects = range.getClientRects()
    if (rects.length > 0) {
      return rects[0]
    }

    // Fallback to bounding client rect
    return range.getBoundingClientRect()
  } catch {
    return null
  }
}

/**
 * Find document position from screen coordinates.
 */
function posAtCoords(dom: HTMLElement, x: number, y: number, _doc: DocNode): number | null {
  // Use caretPositionFromPoint or caretRangeFromPoint
  let range: Range | null = null

  if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(x, y)
    if (pos) {
      range = document.createRange()
      range.setStart(pos.offsetNode, pos.offset)
      range.collapse(true)
    }
  } else if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(x, y)
  }

  if (!range || !dom.contains(range.startContainer)) {
    return null
  }

  // Convert DOM position to document position by walking the tree
  return posFromDOMOffset(dom, range.startContainer, range.startOffset)
}

/**
 * Convert a DOM node/offset to a document position.
 */
function posFromDOMOffset(root: HTMLElement, node: globalThis.Node, offset: number): number | null {
  // Find the closest element with data-pos
  let current: globalThis.Node | null = node
  while (current && current !== root) {
    if (current.nodeType === ELEMENT_NODE) {
      const el = current as HTMLElement
      const posAttr = el.getAttribute('data-pos')
      if (posAttr !== null) {
        const basePos = Number.parseInt(posAttr, 10)
        if (!Number.isNaN(basePos)) {
          // Calculate offset within this element
          const textOffset = getTextOffsetBefore(el, node, offset)
          return basePos + textOffset
        }
      }
    }
    current = current.parentNode
  }

  // Fallback: count text from start
  return countTextBefore(root, node, offset)
}

/**
 * Get text offset before a given DOM position within an element.
 */
function getTextOffsetBefore(container: HTMLElement, targetNode: globalThis.Node, targetOffset: number): number {
  let offset = 0
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()

  while (node) {
    if (node === targetNode) {
      return offset + targetOffset
    }
    offset += (node as Text).length
    node = walker.nextNode()
  }

  return offset
}

/**
 * Count all text before a given DOM position.
 */
function countTextBefore(root: HTMLElement, targetNode: globalThis.Node, targetOffset: number): number {
  let count = 0
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()

  while (node) {
    if (node === targetNode) {
      return count + targetOffset
    }
    count += (node as Text).length
    node = walker.nextNode()
  }

  return count
}

// ============================================================================
// Word movement commands
// ============================================================================

/**
 * Move cursor to the start of the previous word.
 */
export const cursorWordLeft: Command = (state, dispatch) => {
  const { $head, empty } = state.selection

  // If there's a selection, collapse to the left edge first
  if (!empty) {
    if (dispatch) {
      const sel = TextSelection.create(state.doc, state.selection.from)
      dispatch(state.tr().setSelection(sel))
    }
    return true
  }

  const newPos = findWordBoundary(state.doc, $head, -1)
  if (newPos === $head.pos) return false

  if (dispatch) {
    const sel = TextSelection.create(state.doc, newPos)
    dispatch(state.tr().setSelection(sel))
  }

  return true
}

/**
 * Move cursor to the end of the next word.
 */
export const cursorWordRight: Command = (state, dispatch) => {
  const { $head, empty } = state.selection

  // If there's a selection, collapse to the right edge first
  if (!empty) {
    if (dispatch) {
      const sel = TextSelection.create(state.doc, state.selection.to)
      dispatch(state.tr().setSelection(sel))
    }
    return true
  }

  const newPos = findWordBoundary(state.doc, $head, 1)
  if (newPos === $head.pos) return false

  if (dispatch) {
    const sel = TextSelection.create(state.doc, newPos)
    dispatch(state.tr().setSelection(sel))
  }

  return true
}

/**
 * Extend selection to the start of the previous word.
 */
export const selectWordLeft: Command = (state, dispatch) => {
  const { $anchor, $head } = state.selection
  const newPos = findWordBoundary(state.doc, $head, -1)

  if (newPos === $head.pos) return false

  if (dispatch) {
    const sel = TextSelection.create(state.doc, $anchor.pos, newPos)
    dispatch(state.tr().setSelection(sel))
  }

  return true
}

/**
 * Extend selection to the end of the next word.
 */
export const selectWordRight: Command = (state, dispatch) => {
  const { $anchor, $head } = state.selection
  const newPos = findWordBoundary(state.doc, $head, 1)

  if (newPos === $head.pos) return false

  if (dispatch) {
    const sel = TextSelection.create(state.doc, $anchor.pos, newPos)
    dispatch(state.tr().setSelection(sel))
  }

  return true
}

/**
 * Find word boundary from a position in a given direction.
 */
function findWordBoundary(_doc: DocNode, $pos: ResolvedPos, dir: -1 | 1): number {
  const { parent, parentOffset } = $pos
  const text = parent.textContent

  if (dir < 0) {
    // Move backward
    let pos = parentOffset

    // Skip whitespace
    while (pos > 0 && /\s/.test(text[pos - 1])) pos--

    // Skip word characters
    while (pos > 0 && /\S/.test(text[pos - 1])) pos--

    return $pos.pos - (parentOffset - pos)
  }
  // Move forward
  let pos = parentOffset

  // Skip word characters
  while (pos < text.length && /\S/.test(text[pos])) pos++

  // Skip whitespace
  while (pos < text.length && /\s/.test(text[pos])) pos++

  return $pos.pos + (pos - parentOffset)
}
