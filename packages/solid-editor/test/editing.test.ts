/**
 * Tests for editing commands (splitBlock, joinBackward, joinForward, etc.)
 */

import { describe, expect, it } from 'vitest'
import { deleteBackward, deleteForward, joinBackward, joinForward, splitBlock } from '../src/commands'
import { EditorState, TextSelection } from '../src/state'
import { doc, p } from './schema'

/**
 * Helper to create a state with cursor at a specific position
 */
function stateAt(d: ReturnType<typeof doc>, pos: number): EditorState {
  return EditorState.create({
    doc: d,
    selection: TextSelection.create(d, pos),
  })
}

/**
 * Helper to create a state with a selection range
 */
function stateWithSelection(d: ReturnType<typeof doc>, from: number, to: number): EditorState {
  return EditorState.create({
    doc: d,
    selection: TextSelection.create(d, from, to),
  })
}

/**
 * Helper to execute a command and return the result
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

// ============================================================================
// splitBlock tests
// ============================================================================

describe('splitBlock', () => {
  it('splits paragraph in the middle', () => {
    // doc: <p>hello world</p>
    // Positions: 0=before p, 1=h, 2=e, 3=l, 4=l, 5=o, 6= , 7=w...
    const d = doc(p('hello world'))
    const state = stateAt(d, 6) // After "hello"

    const result = execCommand(state, splitBlock)

    expect(result.executed).toBe(true)
    expect(result.state.doc.childCount).toBe(2)
    expect(result.state.doc.child(0).textContent).toBe('hello')
    expect(result.state.doc.child(1).textContent).toBe(' world')
  })

  it('splits paragraph at the start', () => {
    const d = doc(p('hello'))
    const state = stateAt(d, 1) // At start of text

    const result = execCommand(state, splitBlock)

    expect(result.executed).toBe(true)
    expect(result.state.doc.childCount).toBe(2)
    expect(result.state.doc.child(0).textContent).toBe('')
    expect(result.state.doc.child(1).textContent).toBe('hello')
  })

  it('splits paragraph at the end', () => {
    const d = doc(p('hello'))
    const state = stateAt(d, 6) // After "hello"

    const result = execCommand(state, splitBlock)

    expect(result.executed).toBe(true)
    expect(result.state.doc.childCount).toBe(2)
    expect(result.state.doc.child(0).textContent).toBe('hello')
    expect(result.state.doc.child(1).textContent).toBe('')
  })

  it('deletes selection then splits', () => {
    const d = doc(p('hello world'))
    // Positions: 1=|h, 2=h|e, 3=he|l, 4=hel|l, 5=hell|o, 6=hello|, 7=hello |w, 8=hello w|o
    // Select from position 3 to 8 selects "llo w" (5 chars)
    const state = stateWithSelection(d, 3, 8)

    const result = execCommand(state, splitBlock)

    expect(result.executed).toBe(true)
    expect(result.state.doc.childCount).toBe(2)
    // After deleting "llo w", we have "he" + "orld", then split at cursor
    expect(result.state.doc.child(0).textContent).toBe('he')
    expect(result.state.doc.child(1).textContent).toBe('orld')
  })

  it('positions cursor in new paragraph after split', () => {
    const d = doc(p('hello world'))
    const state = stateAt(d, 6) // After "hello"

    const result = execCommand(state, splitBlock)

    expect(result.executed).toBe(true)
    // Cursor should be at start of second paragraph
    const sel = result.state.selection
    expect(sel.$from.parent.textContent).toBe(' world')
    expect(sel.$from.parentOffset).toBe(0)
  })

  it('works with empty paragraph', () => {
    const d = doc(p())
    const state = stateAt(d, 1)

    const result = execCommand(state, splitBlock)

    expect(result.executed).toBe(true)
    expect(result.state.doc.childCount).toBe(2)
  })

  it('works with multiple paragraphs', () => {
    const d = doc(p('first'), p('second'))
    const state = stateAt(d, 4) // In "first" after "fir"

    const result = execCommand(state, splitBlock)

    expect(result.executed).toBe(true)
    expect(result.state.doc.childCount).toBe(3)
    expect(result.state.doc.child(0).textContent).toBe('fir')
    expect(result.state.doc.child(1).textContent).toBe('st')
    expect(result.state.doc.child(2).textContent).toBe('second')
  })
})

// ============================================================================
// joinBackward tests
// ============================================================================

describe('joinBackward', () => {
  it('joins with previous paragraph at start of block', () => {
    const d = doc(p('hello'), p('world'))
    // Position 8 is start of "world" (after </p><p>)
    const state = stateAt(d, 8)

    const result = execCommand(state, joinBackward)

    expect(result.executed).toBe(true)
    expect(result.state.doc.childCount).toBe(1)
    expect(result.state.doc.child(0).textContent).toBe('helloworld')
  })

  it('does nothing in middle of paragraph', () => {
    const d = doc(p('hello'), p('world'))
    const state = stateAt(d, 10) // In the middle of "world"

    const result = execCommand(state, joinBackward)

    expect(result.executed).toBe(false)
    expect(result.state.doc.childCount).toBe(2) // Unchanged
  })

  it('does nothing at start of document', () => {
    const d = doc(p('hello'))
    const state = stateAt(d, 1) // Start of first paragraph

    const result = execCommand(state, joinBackward)

    expect(result.executed).toBe(false)
  })

  it('deletes empty paragraph when joining', () => {
    const d = doc(p('hello'), p())
    const state = stateAt(d, 8) // Start of empty paragraph

    const result = execCommand(state, joinBackward)

    expect(result.executed).toBe(true)
    expect(result.state.doc.childCount).toBe(1)
    expect(result.state.doc.child(0).textContent).toBe('hello')
  })

  it('positions cursor at join point', () => {
    const d = doc(p('hello'), p('world'))
    const state = stateAt(d, 8)

    const result = execCommand(state, joinBackward)

    expect(result.executed).toBe(true)
    // Cursor should be at the join point (after "hello")
    const sel = result.state.selection
    expect(sel.from).toBe(6) // Position after "hello" in merged paragraph
  })

  it('does nothing with non-empty selection', () => {
    const d = doc(p('hello'), p('world'))
    const state = stateWithSelection(d, 8, 10)

    const result = execCommand(state, joinBackward)

    expect(result.executed).toBe(false)
  })
})

// ============================================================================
// joinForward tests
// ============================================================================

describe('joinForward', () => {
  it('joins with next paragraph at end of block', () => {
    const d = doc(p('hello'), p('world'))
    const state = stateAt(d, 6) // End of "hello"

    const result = execCommand(state, joinForward)

    expect(result.executed).toBe(true)
    expect(result.state.doc.childCount).toBe(1)
    expect(result.state.doc.child(0).textContent).toBe('helloworld')
  })

  it('does nothing in middle of paragraph', () => {
    const d = doc(p('hello'), p('world'))
    const state = stateAt(d, 3) // Middle of "hello"

    const result = execCommand(state, joinForward)

    expect(result.executed).toBe(false)
  })

  it('does nothing at end of document', () => {
    const d = doc(p('hello'))
    const state = stateAt(d, 6) // End of only paragraph

    const result = execCommand(state, joinForward)

    expect(result.executed).toBe(false)
  })

  it('deletes empty next paragraph', () => {
    const d = doc(p('hello'), p())
    const state = stateAt(d, 6) // End of "hello"

    const result = execCommand(state, joinForward)

    expect(result.executed).toBe(true)
    expect(result.state.doc.childCount).toBe(1)
  })

  it('does nothing with non-empty selection', () => {
    const d = doc(p('hello'), p('world'))
    const state = stateWithSelection(d, 4, 6)

    const result = execCommand(state, joinForward)

    expect(result.executed).toBe(false)
  })
})

// ============================================================================
// deleteBackward tests
// ============================================================================

describe('deleteBackward', () => {
  it('deletes selection if present', () => {
    const d = doc(p('hello world'))
    const state = stateWithSelection(d, 2, 5) // Select "ell"

    const result = execCommand(state, deleteBackward)

    expect(result.executed).toBe(true)
    expect(result.state.doc.child(0).textContent).toBe('ho world')
  })

  it('joins backward at start of paragraph', () => {
    const d = doc(p('hello'), p('world'))
    const state = stateAt(d, 8) // Start of "world"

    const result = execCommand(state, deleteBackward)

    expect(result.executed).toBe(true)
    expect(result.state.doc.childCount).toBe(1)
    expect(result.state.doc.child(0).textContent).toBe('helloworld')
  })

  it('deletes one character backward', () => {
    const d = doc(p('hello'))
    const state = stateAt(d, 4) // After "hel"

    const result = execCommand(state, deleteBackward)

    expect(result.executed).toBe(true)
    expect(result.state.doc.child(0).textContent).toBe('helo')
  })

  it('does nothing at start of document', () => {
    const d = doc(p('hello'))
    const state = stateAt(d, 1)

    const result = execCommand(state, deleteBackward)

    expect(result.executed).toBe(false)
  })
})

// ============================================================================
// deleteForward tests
// ============================================================================

describe('deleteForward', () => {
  it('deletes selection if present', () => {
    const d = doc(p('hello world'))
    const state = stateWithSelection(d, 2, 5) // Select "ell"

    const result = execCommand(state, deleteForward)

    expect(result.executed).toBe(true)
    expect(result.state.doc.child(0).textContent).toBe('ho world')
  })

  it('joins forward at end of paragraph', () => {
    const d = doc(p('hello'), p('world'))
    const state = stateAt(d, 6) // End of "hello"

    const result = execCommand(state, deleteForward)

    expect(result.executed).toBe(true)
    expect(result.state.doc.childCount).toBe(1)
    expect(result.state.doc.child(0).textContent).toBe('helloworld')
  })

  it('deletes one character forward', () => {
    const d = doc(p('hello'))
    const state = stateAt(d, 3) // After "he"

    const result = execCommand(state, deleteForward)

    expect(result.executed).toBe(true)
    expect(result.state.doc.child(0).textContent).toBe('helo')
  })

  it('does nothing at end of document', () => {
    const d = doc(p('hello'))
    const state = stateAt(d, 6) // End of paragraph

    const result = execCommand(state, deleteForward)

    expect(result.executed).toBe(false)
  })
})

// ============================================================================
// Cross-paragraph selection tests
// ============================================================================

describe('Cross-paragraph operations', () => {
  it('can delete selection spanning multiple paragraphs', () => {
    const d = doc(p('hello'), p('world'))
    // doc(p("hello"), p("world")) positions:
    // 1-6: "hello" in first p, 7: boundary, 8-13: "world" in second p
    // Select from position 4 (after "hel") to position 10 (after "wo")
    // This selects "lo" + boundary + "wo"
    const state = stateWithSelection(d, 4, 10)

    const result = execCommand(state, deleteBackward)

    expect(result.executed).toBe(true)
    expect(result.state.doc.childCount).toBe(1)
    // After deleting, we get "hel" + "rld" = "helrld"
    expect(result.state.doc.child(0).textContent).toBe('helrld')
  })

  it('can split then join to restore original', () => {
    const d = doc(p('hello world'))
    let state = stateAt(d, 6) // After "hello"

    // Split
    let result = execCommand(state, splitBlock)
    expect(result.state.doc.childCount).toBe(2)

    // Move to start of second paragraph
    state = EditorState.create({
      doc: result.state.doc,
      selection: TextSelection.create(result.state.doc, 8),
    })

    // Join backward
    result = execCommand(state, joinBackward)
    expect(result.state.doc.childCount).toBe(1)
    expect(result.state.doc.child(0).textContent).toBe('hello world')
  })
})
