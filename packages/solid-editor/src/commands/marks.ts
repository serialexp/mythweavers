/**
 * Mark commands for solidjs-editor.
 *
 * Provides `toggleMark` — the standard command for toggling inline
 * formatting marks (bold, italic, code, underline, strikethrough, etc).
 */

import type { MarkType, Mark } from '../model'
import type { EditorState, Transaction } from '../state'
import type { CommandContext } from '../keymap'

/**
 * Command type — matches the standard (state, dispatch?, view?) => boolean
 * signature used throughout the editor.
 */
export type Command = (
  state: EditorState,
  dispatch?: (tr: Transaction) => void,
  view?: CommandContext,
) => boolean

/**
 * Create a command that toggles the given mark type.
 *
 * When the selection is empty, toggles the mark in stored marks
 * (so the next typed character will have/not have it).
 *
 * When the selection is non-empty, adds or removes the mark across
 * the selected range. The mark is removed if any text in the range
 * already has it; otherwise it's added.
 *
 * @param markType - The mark type to toggle (e.g. `schema.marks.strong`)
 * @param attrs - Optional attributes for the mark (e.g. `{ color: 'red' }`)
 * @returns A command function
 *
 * @example
 * ```ts
 * const toggleBold = toggleMark(schema.marks.strong)
 * const toggleHighlight = toggleMark(schema.marks.highlight, { color: 'yellow' })
 * ```
 */
export function toggleMark(markType: MarkType, attrs?: Record<string, unknown>): Command {
  return (state, dispatch) => {
    const { from, to, empty } = state.selection

    // Check applicability: the mark must be allowed at the current position
    if (empty) {
      if (!markType.isInSet(state.storedMarks ?? state.selection.$from.marks())
        && !canApplyMark(state, markType)) {
        return false
      }
    } else {
      if (!canApplyMark(state, markType)) return false
    }

    if (!dispatch) return true

    const mark = markType.create(attrs ?? null)
    const tr = state.tr()

    if (empty) {
      // Toggle in stored marks
      const existing = state.storedMarks ?? state.selection.$from.marks()
      if (markType.isInSet(existing)) {
        tr.setStoredMarks(existing.filter((m) => m.type !== markType))
      } else {
        tr.setStoredMarks([...existing, mark])
      }
    } else {
      // Toggle across the selected range
      if (markActive(state, markType)) {
        tr.removeMark(from, to, mark)
      } else {
        tr.addMark(from, to, mark)
      }
    }

    dispatch(tr)
    return true
  }
}

/**
 * Check whether the given mark type is active at the current selection.
 *
 * For empty selections: checks stored marks or marks at the cursor.
 * For non-empty selections: checks if any node in the range has the mark.
 */
export function markActive(state: EditorState, markType: MarkType): boolean {
  const { from, $from, to, empty } = state.selection
  if (empty) {
    const marks = state.storedMarks ?? $from.marks()
    return !!markType.isInSet(marks)
  }
  let active = false
  state.doc.nodesBetween(from, to, (node) => {
    if (markType.isInSet(node.marks)) active = true
    return undefined
  })
  return active
}

/**
 * Check whether the mark type can be applied somewhere in the current
 * selection range. Returns false if the mark is excluded everywhere
 * (e.g. code marks inside a code_block).
 */
function canApplyMark(state: EditorState, markType: MarkType): boolean {
  const { from, to, empty } = state.selection
  if (empty) {
    // Check the parent node at cursor
    return state.selection.$from.parent.type.allowsMarkType(markType)
  }
  let found = false
  state.doc.nodesBetween(from, to, (node) => {
    if (found) return false // short-circuit
    if (node.inlineContent && node.type.allowsMarkType(markType)) {
      found = true
    }
    return undefined
  })
  return found
}
