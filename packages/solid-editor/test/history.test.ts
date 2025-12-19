/**
 * Tests for the history plugin (undo/redo)
 */

import { describe, expect, it } from 'vitest'
import { closeHistory, history, redo, redoDepth, undo, undoDepth } from '../src/plugins'
import { EditorState, TextSelection } from '../src/state'
import { doc, p } from './schema'

/**
 * Helper to create a state with history plugin
 */
function stateWithHistory(d: ReturnType<typeof doc>, pos: number): EditorState {
  return EditorState.create({
    doc: d,
    selection: TextSelection.create(d, pos),
    plugins: [history()],
  })
}

/**
 * Helper to execute a command
 */
function execCommand(
  state: EditorState,
  command: (state: EditorState, dispatch?: (tr: any) => void) => boolean,
): { executed: boolean; state: EditorState } {
  let newState = state
  const executed = command(state, (tr) => {
    newState = state.apply(tr)
  })
  return { executed, state: newState }
}

/**
 * Helper to type text at current position
 */
function typeText(state: EditorState, text: string): EditorState {
  const tr = state.tr()
  tr.insertText(text, state.selection.from)
  return state.apply(tr)
}

/**
 * Helper to delete character before cursor
 */
function backspace(state: EditorState): EditorState {
  const { from } = state.selection
  if (from <= 1) return state
  const tr = state.tr()
  tr.delete(from - 1, from)
  return state.apply(tr)
}

// ============================================================================
// Basic undo/redo tests
// ============================================================================

describe('history plugin', () => {
  describe('basic undo/redo', () => {
    it('can undo text insertion', () => {
      let state = stateWithHistory(doc(p('hello')), 6)

      // Type " world"
      state = typeText(state, ' world')
      expect(state.doc.child(0).textContent).toBe('hello world')

      // Undo
      const result = execCommand(state, undo)
      expect(result.executed).toBe(true)
      expect(result.state.doc.child(0).textContent).toBe('hello')
    })

    it('can redo after undo', () => {
      let state = stateWithHistory(doc(p('hello')), 6)

      // Type " world"
      state = typeText(state, ' world')

      // Undo
      let result = execCommand(state, undo)
      expect(result.state.doc.child(0).textContent).toBe('hello')

      // Redo
      result = execCommand(result.state, redo)
      expect(result.executed).toBe(true)
      expect(result.state.doc.child(0).textContent).toBe('hello world')
    })

    it('returns false when nothing to undo', () => {
      const state = stateWithHistory(doc(p('hello')), 6)

      const result = execCommand(state, undo)
      expect(result.executed).toBe(false)
    })

    it('returns false when nothing to redo', () => {
      const state = stateWithHistory(doc(p('hello')), 6)

      const result = execCommand(state, redo)
      expect(result.executed).toBe(false)
    })

    it('can undo multiple times', () => {
      let state = stateWithHistory(doc(p('a')), 2)

      // Type "b", "c", "d" with delays (separate events)
      state = typeText(state, 'b')
      // Force new group
      state = state.apply(closeHistory(state.tr()))
      state = typeText(state, 'c')
      state = state.apply(closeHistory(state.tr()))
      state = typeText(state, 'd')

      expect(state.doc.child(0).textContent).toBe('abcd')

      // Undo three times
      let result = execCommand(state, undo)
      expect(result.state.doc.child(0).textContent).toBe('abc')

      result = execCommand(result.state, undo)
      expect(result.state.doc.child(0).textContent).toBe('ab')

      result = execCommand(result.state, undo)
      expect(result.state.doc.child(0).textContent).toBe('a')
    })

    it('clears redo stack on new changes', () => {
      let state = stateWithHistory(doc(p('hello')), 6)

      // Type " world"
      state = typeText(state, ' world')

      // Undo
      let result = execCommand(state, undo)
      expect(result.state.doc.child(0).textContent).toBe('hello')

      // Type something new
      state = typeText(result.state, '!')
      expect(state.doc.child(0).textContent).toBe('hello!')

      // Redo should not work - stack was cleared
      result = execCommand(state, redo)
      expect(result.executed).toBe(false)
    })
  })

  describe('undoDepth and redoDepth', () => {
    it('reports correct undo depth', () => {
      let state = stateWithHistory(doc(p('a')), 2)

      expect(undoDepth(state)).toBe(0)

      state = typeText(state, 'b')
      expect(undoDepth(state)).toBe(1)

      state = state.apply(closeHistory(state.tr()))
      state = typeText(state, 'c')
      expect(undoDepth(state)).toBe(2)
    })

    it('reports correct redo depth', () => {
      let state = stateWithHistory(doc(p('a')), 2)

      state = typeText(state, 'b')
      state = state.apply(closeHistory(state.tr()))
      state = typeText(state, 'c')

      expect(redoDepth(state)).toBe(0)

      let result = execCommand(state, undo)
      expect(redoDepth(result.state)).toBe(1)

      result = execCommand(result.state, undo)
      expect(redoDepth(result.state)).toBe(2)
    })
  })

  describe('addToHistory metadata', () => {
    it('skips recording when addToHistory is false', () => {
      let state = stateWithHistory(doc(p('hello')), 6)

      // Make a change with addToHistory: false
      const tr = state.tr()
      tr.insertText(' world', 6)
      tr.setMeta('addToHistory', false)
      state = state.apply(tr)

      expect(state.doc.child(0).textContent).toBe('hello world')
      expect(undoDepth(state)).toBe(0)

      // Undo should not work
      const result = execCommand(state, undo)
      expect(result.executed).toBe(false)
    })
  })

  describe('selection restoration', () => {
    it('restores selection after undo', () => {
      let state = stateWithHistory(doc(p('hello world')), 6)

      // Select and delete "hello"
      state = EditorState.create({
        doc: state.doc,
        selection: TextSelection.create(state.doc, 1, 6),
        plugins: [history()],
      })

      // Type to replace
      const tr = state.tr()
      tr.replaceSelectionWith(state.schema.text('hi'))
      state = state.apply(tr)

      expect(state.doc.child(0).textContent).toBe('hi world')

      // Undo
      const result = execCommand(state, undo)
      expect(result.state.doc.child(0).textContent).toBe('hello world')
      // Selection should be restored to the original
      expect(result.state.selection.from).toBe(1)
      expect(result.state.selection.to).toBe(6)
    })
  })

  describe('closeHistory', () => {
    it('forces new event group', () => {
      let state = stateWithHistory(doc(p('a')), 2)

      // Type "b" and "c" rapidly (would normally be grouped)
      state = typeText(state, 'b')
      state = typeText(state, 'c')

      // Without closeHistory, these are in one group
      expect(undoDepth(state)).toBe(1)

      // Now force a new group
      state = state.apply(closeHistory(state.tr()))
      state = typeText(state, 'd')

      expect(undoDepth(state)).toBe(2)
    })
  })

  describe('step merging', () => {
    it('merges consecutive text insertions', () => {
      let state = stateWithHistory(doc(p('')), 1)

      // Type each character
      for (const char of 'hello') {
        state = typeText(state, char)
      }

      expect(state.doc.child(0).textContent).toBe('hello')
      // Should be one event (merged)
      expect(undoDepth(state)).toBe(1)

      // Single undo removes all
      const result = execCommand(state, undo)
      expect(result.state.doc.child(0).textContent).toBe('')
    })
  })

  describe('delete operations', () => {
    it('can undo deletions', () => {
      let state = stateWithHistory(doc(p('hello')), 6)

      // Delete characters
      state = backspace(state)
      state = backspace(state)

      expect(state.doc.child(0).textContent).toBe('hel')

      // Undo
      const result = execCommand(state, undo)
      expect(result.state.doc.child(0).textContent).toBe('hello')
    })
  })
})

describe('history with multiple paragraphs', () => {
  it('can undo paragraph split', () => {
    let state = stateWithHistory(doc(p('hello world')), 6)

    // Split paragraph
    const tr = state.tr()
    tr.split(6)
    state = state.apply(tr)

    expect(state.doc.childCount).toBe(2)
    expect(state.doc.child(0).textContent).toBe('hello')
    expect(state.doc.child(1).textContent).toBe(' world')

    // Undo
    const result = execCommand(state, undo)
    expect(result.state.doc.childCount).toBe(1)
    expect(result.state.doc.child(0).textContent).toBe('hello world')
  })

  it('can undo paragraph join', () => {
    let state = stateWithHistory(doc(p('hello'), p('world')), 7)

    // Join paragraphs (position 7 is the boundary)
    const tr = state.tr()
    tr.join(7)
    state = state.apply(tr)

    expect(state.doc.childCount).toBe(1)
    expect(state.doc.child(0).textContent).toBe('helloworld')

    // Undo
    const result = execCommand(state, undo)
    expect(result.state.doc.childCount).toBe(2)
  })
})
