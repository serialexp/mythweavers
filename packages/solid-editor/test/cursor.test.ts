import { describe, expect, it } from 'vitest'
import {
  cursorDocEnd,
  cursorDocStart,
  cursorLeft,
  cursorLineEnd,
  cursorLineStart,
  cursorRight,
  cursorWordLeft,
  cursorWordRight,
  selectAll,
  selectDocEnd,
  selectDocStart,
  selectLeft,
  selectLineEnd,
  selectLineStart,
  selectRight,
  selectWordLeft,
  selectWordRight,
} from '../src/commands'
import { EditorState, TextSelection } from '../src/state'
import { blockquote, doc, p } from './schema'

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
function stateWithSelection(d: ReturnType<typeof doc>, anchor: number, head: number): EditorState {
  return EditorState.create({
    doc: d,
    selection: TextSelection.create(d, anchor, head),
  })
}

/**
 * Helper to execute a command and return the new selection position
 */
function execCommand(
  state: EditorState,
  command: (state: EditorState, dispatch?: (tr: any) => void, view?: any) => boolean,
): { from: number; to: number; executed: boolean } {
  let newState = state
  const executed = command(state, (tr) => {
    newState = state.apply(tr)
  })
  return {
    from: newState.selection.from,
    to: newState.selection.to,
    executed,
  }
}

describe('Cursor Commands', () => {
  describe('cursorLeft', () => {
    it('moves cursor one position left', () => {
      // doc(p("hello")) has positions: 0 <p> 1 h 2 e 3 l 4 l 5 o 6 </p> 7
      const d = doc(p('hello'))
      const state = stateAt(d, 3) // cursor after "he"

      const result = execCommand(state, cursorLeft)

      expect(result.executed).toBe(true)
      expect(result.from).toBe(2) // moved left
      expect(result.to).toBe(2)
    })

    it('stays at document start', () => {
      const d = doc(p('hello'))
      const state = stateAt(d, 1) // cursor at start of text

      const result = execCommand(state, cursorLeft)

      // Should either stay at 1 or move to 0 (before paragraph)
      expect(result.from).toBeLessThanOrEqual(1)
    })

    it('collapses selection to the left', () => {
      const d = doc(p('hello world'))
      const state = stateWithSelection(d, 3, 8) // "llo wo" selected

      const result = execCommand(state, cursorLeft)

      expect(result.executed).toBe(true)
      expect(result.from).toBe(3) // collapsed to left edge
      expect(result.to).toBe(3)
    })
  })

  describe('cursorRight', () => {
    it('moves cursor one position right', () => {
      const d = doc(p('hello'))
      const state = stateAt(d, 3)

      const result = execCommand(state, cursorRight)

      expect(result.executed).toBe(true)
      expect(result.from).toBe(4)
      expect(result.to).toBe(4)
    })

    it('stays at document end', () => {
      const d = doc(p('hello'))
      const state = stateAt(d, 6) // cursor at end of text

      const result = execCommand(state, cursorRight)

      // Should stay at or near the end
      expect(result.from).toBeGreaterThanOrEqual(6)
    })

    it('collapses selection to the right', () => {
      const d = doc(p('hello world'))
      const state = stateWithSelection(d, 3, 8)

      const result = execCommand(state, cursorRight)

      expect(result.executed).toBe(true)
      expect(result.from).toBe(8) // collapsed to right edge
      expect(result.to).toBe(8)
    })
  })

  describe('cursorLineStart', () => {
    it('moves cursor to start of paragraph', () => {
      const d = doc(p('hello world'))
      const state = stateAt(d, 8) // middle of text

      const result = execCommand(state, cursorLineStart)

      expect(result.executed).toBe(true)
      expect(result.from).toBe(1) // start of paragraph content
    })

    it('returns false when already at line start', () => {
      const d = doc(p('hello'))
      const state = stateAt(d, 1)

      const result = execCommand(state, cursorLineStart)

      expect(result.executed).toBe(false)
    })
  })

  describe('cursorLineEnd', () => {
    it('moves cursor to end of paragraph', () => {
      const d = doc(p('hello world'))
      const state = stateAt(d, 3) // middle of text

      const result = execCommand(state, cursorLineEnd)

      expect(result.executed).toBe(true)
      expect(result.from).toBe(12) // end of paragraph content
    })

    it('returns false when already at line end', () => {
      const d = doc(p('hello'))
      const state = stateAt(d, 6)

      const result = execCommand(state, cursorLineEnd)

      expect(result.executed).toBe(false)
    })
  })

  describe('cursorDocStart', () => {
    it('moves cursor to document start', () => {
      const d = doc(p('hello'), p('world'))
      const state = stateAt(d, 10) // in second paragraph

      const result = execCommand(state, cursorDocStart)

      expect(result.executed).toBe(true)
      expect(result.from).toBe(1) // start of first paragraph content
    })
  })

  describe('cursorDocEnd', () => {
    it('moves cursor to document end', () => {
      const d = doc(p('hello'), p('world'))
      const state = stateAt(d, 3) // in first paragraph

      const result = execCommand(state, cursorDocEnd)

      expect(result.executed).toBe(true)
      expect(result.from).toBe(13) // end of second paragraph
    })
  })

  describe('cursorWordLeft', () => {
    it('moves to start of current word', () => {
      const d = doc(p('hello world'))
      const state = stateAt(d, 9) // middle of "world" (after "wo")

      const result = execCommand(state, cursorWordLeft)

      expect(result.executed).toBe(true)
      expect(result.from).toBe(7) // start of "world"
    })

    it('moves to previous word when at word start', () => {
      const d = doc(p('hello world'))
      const state = stateAt(d, 7) // start of "world"

      const result = execCommand(state, cursorWordLeft)

      expect(result.executed).toBe(true)
      expect(result.from).toBe(1) // start of "hello"
    })

    it('collapses selection when not empty', () => {
      const d = doc(p('hello world'))
      const state = stateWithSelection(d, 3, 9)

      const result = execCommand(state, cursorWordLeft)

      expect(result.executed).toBe(true)
      expect(result.from).toBe(3) // collapsed to selection start
      expect(result.to).toBe(3)
    })
  })

  describe('cursorWordRight', () => {
    it('moves to end of current word', () => {
      const d = doc(p('hello world'))
      const state = stateAt(d, 3) // middle of "hello"

      const result = execCommand(state, cursorWordRight)

      expect(result.executed).toBe(true)
      expect(result.from).toBe(7) // after "hello " (includes trailing space)
    })

    it('moves to next word when at word end', () => {
      const d = doc(p('hello world'))
      const state = stateAt(d, 6) // end of "hello"

      const result = execCommand(state, cursorWordRight)

      expect(result.executed).toBe(true)
      // Should move past whitespace to end of "world"
      expect(result.from).toBeGreaterThan(6)
    })
  })
})

describe('Selection Extension Commands', () => {
  describe('selectLeft', () => {
    it('extends selection one position left', () => {
      const d = doc(p('hello world'))
      const state = stateAt(d, 6) // cursor after "hello"

      const result = execCommand(state, selectLeft)

      expect(result.executed).toBe(true)
      expect(result.from).toBe(5) // selection starts earlier
      expect(result.to).toBe(6) // anchor stays
    })

    it('extends existing selection further left', () => {
      const d = doc(p('hello world'))
      const state = stateWithSelection(d, 8, 5) // head at 5, anchor at 8

      const result = execCommand(state, selectLeft)

      expect(result.executed).toBe(true)
      // Selection should extend from anchor (8) to head-1 (4)
    })

    it('returns false at document start', () => {
      const d = doc(p('hello'))
      const state = stateAt(d, 0)

      const result = execCommand(state, selectLeft)

      expect(result.executed).toBe(false)
    })
  })

  describe('selectRight', () => {
    it('extends selection one position right', () => {
      const d = doc(p('hello world'))
      const state = stateAt(d, 6)

      const result = execCommand(state, selectRight)

      expect(result.executed).toBe(true)
      expect(result.from).toBe(6) // anchor
      expect(result.to).toBe(7) // head moved right
    })
  })

  describe('selectLineStart', () => {
    it('extends selection to line start', () => {
      const d = doc(p('hello world'))
      const state = stateAt(d, 8)

      const result = execCommand(state, selectLineStart)

      expect(result.executed).toBe(true)
      expect(result.from).toBe(1) // start of line
      expect(result.to).toBe(8) // anchor
    })
  })

  describe('selectLineEnd', () => {
    it('extends selection to line end', () => {
      const d = doc(p('hello world'))
      const state = stateAt(d, 3)

      const result = execCommand(state, selectLineEnd)

      expect(result.executed).toBe(true)
      expect(result.from).toBe(3) // anchor
      expect(result.to).toBe(12) // end of line
    })
  })

  describe('selectDocStart', () => {
    it('extends selection to document start', () => {
      const d = doc(p('hello'), p('world'))
      const state = stateAt(d, 10)

      const result = execCommand(state, selectDocStart)

      expect(result.executed).toBe(true)
      expect(result.from).toBe(1) // document start
      expect(result.to).toBe(10) // anchor
    })
  })

  describe('selectDocEnd', () => {
    it('extends selection to document end', () => {
      const d = doc(p('hello'), p('world'))
      const state = stateAt(d, 3)

      const result = execCommand(state, selectDocEnd)

      expect(result.executed).toBe(true)
      expect(result.from).toBe(3) // anchor
      expect(result.to).toBe(13) // document end
    })
  })

  describe('selectWordLeft', () => {
    it('extends selection to word start', () => {
      const d = doc(p('hello world'))
      const state = stateAt(d, 9) // middle of "world"

      const result = execCommand(state, selectWordLeft)

      expect(result.executed).toBe(true)
      expect(result.from).toBe(7) // start of "world"
      expect(result.to).toBe(9) // anchor
    })
  })

  describe('selectWordRight', () => {
    it('extends selection to word end', () => {
      const d = doc(p('hello world'))
      const state = stateAt(d, 3) // middle of "hello"

      const result = execCommand(state, selectWordRight)

      expect(result.executed).toBe(true)
      expect(result.from).toBe(3) // anchor
      expect(result.to).toBeGreaterThan(3) // past word end
    })
  })

  describe('selectAll', () => {
    it('selects entire document content', () => {
      const d = doc(p('hello'), p('world'))
      const state = stateAt(d, 3)

      const result = execCommand(state, selectAll)

      expect(result.executed).toBe(true)
      expect(result.from).toBe(0)
      expect(result.to).toBe(d.content.size)
    })
  })
})

describe('Multi-paragraph navigation', () => {
  it('cursorRight can cross paragraph boundaries', () => {
    const d = doc(p('ab'), p('cd'))
    // Positions: 0 <p> 1 a 2 b 3 </p> 4 <p> 5 c 6 d 7 </p> 8
    const state = stateAt(d, 3) // end of first paragraph

    const result = execCommand(state, cursorRight)

    // Should move to position 4 or 5 (between paragraphs or start of second)
    expect(result.from).toBeGreaterThan(3)
  })

  it('cursorLeft can cross paragraph boundaries', () => {
    const d = doc(p('ab'), p('cd'))
    const state = stateAt(d, 5) // start of second paragraph

    const result = execCommand(state, cursorLeft)

    // Should move back towards first paragraph
    expect(result.from).toBeLessThan(5)
  })
})

describe('Edge cases', () => {
  it('handles empty paragraph', () => {
    const d = doc(p())
    // Empty paragraph: 0 <p> 1 </p> 2
    const state = stateAt(d, 1)

    // cursorLeft should not crash
    const leftResult = execCommand(state, cursorLeft)
    expect(leftResult.from).toBeLessThanOrEqual(1)

    // cursorRight should not crash
    const rightResult = execCommand(state, cursorRight)
    expect(rightResult.from).toBeGreaterThanOrEqual(1)
  })

  it('handles nested blocks', () => {
    const d = doc(blockquote(p('nested')))
    // 0 <blockquote> 1 <p> 2 n 3 e 4 s 5 t 6 e 7 d 8 </p> 9 </blockquote> 10
    const state = stateAt(d, 4) // middle of "nested"

    const result = execCommand(state, cursorLineStart)
    expect(result.from).toBe(2) // start of paragraph inside blockquote
  })

  it('cursorDocStart finds text in nested structure', () => {
    const d = doc(blockquote(p('nested')))
    const state = stateAt(d, 6)

    const result = execCommand(state, cursorDocStart)

    expect(result.from).toBe(2) // first text position
  })
})
