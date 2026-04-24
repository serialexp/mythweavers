/**
 * Cursor movement commands for solidjs-editor
 *
 * These commands handle arrow key navigation and related cursor movements.
 * They follow the ProseMirror command signature: (state, dispatch?, view?) => boolean
 */

import type { CommandContext } from '../keymap'
import type { Node as DocNode, ResolvedPos } from '../model'
import type { EditorState, Transaction } from '../state'
import { Selection, TextSelection } from '../state/selection'
import { domFromPos, posFromDOM } from '../view/selection'

// DOM node type constants
const TEXT_NODE = 3

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
  const domPos = domFromPos(dom, $pos.pos, doc)
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
 * Get the bounding rectangle at a DOM position.
 *
 * Element-anchored collapsed ranges produce unreliable rects across browsers
 * (often (0,0,0,0)), so we resolve element+offset to a text-node anchor first
 * whenever possible — text-anchored collapsed ranges reliably report the
 * caret rect.
 */
function getRectAtDOMPosition(node: globalThis.Node, offset: number): DOMRect | null {
  let anchorNode: globalThis.Node = node
  let anchorOffset = offset

  if (anchorNode.nodeType !== TEXT_NODE) {
    const resolved = resolveToTextAnchor(anchorNode, anchorOffset)
    if (resolved) {
      anchorNode = resolved.node
      anchorOffset = resolved.offset
    }
  }

  try {
    const range = document.createRange()
    if (anchorNode.nodeType === TEXT_NODE) {
      const text = anchorNode as Text
      const safeOffset = Math.min(Math.max(anchorOffset, 0), text.length)
      range.setStart(anchorNode, safeOffset)
      range.setEnd(anchorNode, safeOffset)
    } else {
      // No text descendant to anchor against — use the element itself as a
      // best-effort fallback (e.g. an empty paragraph's <br>).
      const clampedOffset = Math.min(Math.max(anchorOffset, 0), anchorNode.childNodes.length)
      range.setStart(anchorNode, clampedOffset)
      range.setEnd(anchorNode, clampedOffset)
    }

    const rects = range.getClientRects()
    if (rects.length > 0) return rects[0]

    const bounding = range.getBoundingClientRect()
    if (bounding.width > 0 || bounding.height > 0 || bounding.top !== 0 || bounding.left !== 0) {
      return bounding
    }

    // Last-resort fallback: the element's own bounding rect.
    if (anchorNode.nodeType !== TEXT_NODE) {
      return (anchorNode as Element).getBoundingClientRect()
    }
    return bounding
  } catch {
    return null
  }
}

/**
 * Resolve an element+child-offset position to a text node + offset pointing
 * at the same caret location. Used to get reliable caret rects from ranges.
 *
 * If the offset points to a text child, use that directly. If it points to an
 * element child, descend to its first text descendant. If it's past the last
 * child, use the end of the previous/last text descendant.
 */
function resolveToTextAnchor(
  element: globalThis.Node,
  offset: number,
): { node: Text; offset: number } | null {
  const children = element.childNodes
  if (children.length === 0) return null

  if (offset < children.length) {
    const child = children[offset]
    if (child.nodeType === TEXT_NODE) return { node: child as Text, offset: 0 }
    const first = firstTextDescendant(child)
    if (first) return { node: first, offset: 0 }
    // Element child has no text — try end of previous child instead.
    if (offset > 0) {
      const prev = children[offset - 1]
      if (prev.nodeType === TEXT_NODE) return { node: prev as Text, offset: (prev as Text).length }
      const last = lastTextDescendant(prev)
      if (last) return { node: last, offset: last.length }
    }
    return null
  }

  // Offset is past the last child — anchor at end of last text descendant.
  const lastChild = children[children.length - 1]
  if (lastChild.nodeType === TEXT_NODE) {
    return { node: lastChild as Text, offset: (lastChild as Text).length }
  }
  const last = lastTextDescendant(lastChild)
  if (last) return { node: last, offset: last.length }
  return null
}

function firstTextDescendant(node: globalThis.Node): Text | null {
  if (node.nodeType === TEXT_NODE) return node as Text
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
  return walker.nextNode() as Text | null
}

function lastTextDescendant(node: globalThis.Node): Text | null {
  if (node.nodeType === TEXT_NODE) return node as Text
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
  let result: Text | null = null
  let current = walker.nextNode()
  while (current) {
    result = current as Text
    current = walker.nextNode()
  }
  return result
}

/**
 * Find document position from screen coordinates.
 */
function posAtCoords(dom: HTMLElement, x: number, y: number, doc: DocNode): number | null {
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

  // Delegate to the authoritative DOM→model mapper (accounts for block tokens).
  return posFromDOM(doc, range.startContainer, range.startOffset)
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
