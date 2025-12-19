import { describe, expect, it } from 'vitest'
import { Node } from '../src/model'
import { blockquote, doc, em, p } from './schema'

/**
 * Test document structure:
 * doc(p("ab"), blockquote(p(em("cd"), "ef")))
 *
 * Position map:
 * 0: before first p
 * 1: start of "ab"
 * 2: between "a" and "b"
 * 3: end of "ab"
 * 4: between p and blockquote
 * 5: start of blockquote
 * 6: start of inner p / start of "cd"
 * 7: between "c" and "d"
 * 8: between "cd" and "ef"
 * 9: between "e" and "f"
 * 10: end of "ef"
 * 11: end of inner p / end of blockquote content
 * 12: end of doc
 */
const testDoc = doc(p('ab'), blockquote(p(em('cd'), 'ef')))

// Helper structures for expected values
const _doc = { node: testDoc, start: 0, end: 12 }
const _p1 = { node: testDoc.child(0), start: 1, end: 3 }
const _blk = { node: testDoc.child(1), start: 5, end: 11 }
const _p2 = { node: _blk.node.child(0), start: 6, end: 10 }

describe('ResolvedPos', () => {
  describe('resolve', () => {
    it('should reflect the document structure', () => {
      // Expected format: [nodeInfos..., parentOffset, nodeBefore, nodeAfter]
      // nodeInfo = { node, start, end }
      const expected: {
        [pos: number]: Array<{ node: Node; start: number; end: number } | number | Node | string | null>
      } = {
        0: [_doc, 0, null, _p1.node],
        1: [_doc, _p1, 0, null, 'ab'],
        2: [_doc, _p1, 1, 'a', 'b'],
        3: [_doc, _p1, 2, 'ab', null],
        4: [_doc, 4, _p1.node, _blk.node],
        5: [_doc, _blk, 0, null, _p2.node],
        6: [_doc, _blk, _p2, 0, null, 'cd'],
        7: [_doc, _blk, _p2, 1, 'c', 'd'],
        8: [_doc, _blk, _p2, 2, 'cd', 'ef'],
        9: [_doc, _blk, _p2, 3, 'e', 'f'],
        10: [_doc, _blk, _p2, 4, 'ef', null],
        11: [_doc, _blk, 6, _p2.node, null],
        12: [_doc, 12, _blk.node, null],
      }

      for (let pos = 0; pos <= testDoc.content.size; pos++) {
        const $pos = testDoc.resolve(pos)
        const exp = expected[pos]

        // Check depth
        expect($pos.depth).toBe(exp.length - 4)

        // Check each depth level
        for (let i = 0; i < exp.length - 3; i++) {
          const nodeInfo = exp[i] as { node: Node; start: number; end: number }
          expect($pos.node(i).eq(nodeInfo.node)).toBe(true)
          expect($pos.start(i)).toBe(nodeInfo.start)
          expect($pos.end(i)).toBe(nodeInfo.end)

          if (i) {
            expect($pos.before(i)).toBe(nodeInfo.start - 1)
            expect($pos.after(i)).toBe(nodeInfo.end + 1)
          }
        }

        // Check parentOffset
        expect($pos.parentOffset).toBe(exp[exp.length - 3])

        // Check nodeBefore
        const before = $pos.nodeBefore
        const eBefore = exp[exp.length - 2]
        if (typeof eBefore === 'string') {
          expect(before?.textContent).toBe(eBefore)
        } else {
          expect(before).toBe(eBefore)
        }

        // Check nodeAfter
        const after = $pos.nodeAfter
        const eAfter = exp[exp.length - 1]
        if (typeof eAfter === 'string') {
          expect(after?.textContent).toBe(eAfter)
        } else {
          expect(after).toBe(eAfter)
        }
      }
    })

    it('throws on invalid positions', () => {
      expect(() => testDoc.resolve(-1)).toThrow()
      expect(() => testDoc.resolve(13)).toThrow()
    })

    it('has a working posAtIndex method', () => {
      const d = doc(blockquote(p('one'), blockquote(p('two ', em('three')), p('four'))))
      const pThree = d.resolve(12) // Start of em("three")

      // At current depth (inside inner blockquote > p)
      expect(pThree.posAtIndex(0)).toBe(8)
      expect(pThree.posAtIndex(1)).toBe(12)
      expect(pThree.posAtIndex(2)).toBe(17)

      // At depth 2 (inner blockquote)
      expect(pThree.posAtIndex(0, 2)).toBe(7)
      expect(pThree.posAtIndex(1, 2)).toBe(18)
      expect(pThree.posAtIndex(2, 2)).toBe(24)

      // At depth 1 (outer blockquote)
      expect(pThree.posAtIndex(0, 1)).toBe(1)
      expect(pThree.posAtIndex(1, 1)).toBe(6)
      expect(pThree.posAtIndex(2, 1)).toBe(25)

      // At depth 0 (doc)
      expect(pThree.posAtIndex(0, 0)).toBe(0)
      expect(pThree.posAtIndex(1, 0)).toBe(26)
    })

    it('has working index and indexAfter methods', () => {
      const $pos2 = testDoc.resolve(2) // Between "a" and "b"
      expect($pos2.index()).toBe(0) // Index of text node
      expect($pos2.indexAfter()).toBe(1) // After position in text

      const $pos4 = testDoc.resolve(4) // Between p and blockquote
      expect($pos4.index()).toBe(1) // Index points to blockquote
      expect($pos4.indexAfter()).toBe(1) // Same because not in text
    })

    it('has working sharedDepth method', () => {
      const $pos2 = testDoc.resolve(2)
      expect($pos2.sharedDepth(1)).toBe(1) // Same paragraph
      expect($pos2.sharedDepth(3)).toBe(1) // Same paragraph
      expect($pos2.sharedDepth(6)).toBe(0) // Different paragraphs, share doc
      expect($pos2.sharedDepth(0)).toBe(0) // Share doc
    })

    it('has working sameParent method', () => {
      const $pos2 = testDoc.resolve(2)
      const $pos3 = testDoc.resolve(3)
      const $pos6 = testDoc.resolve(6)

      expect($pos2.sameParent($pos3)).toBe(true)
      expect($pos2.sameParent($pos6)).toBe(false)
    })

    it('has working min and max methods', () => {
      const $pos2 = testDoc.resolve(2)
      const $pos6 = testDoc.resolve(6)

      expect($pos2.min($pos6).pos).toBe(2)
      expect($pos2.max($pos6).pos).toBe(6)
      expect($pos6.min($pos2).pos).toBe(2)
      expect($pos6.max($pos2).pos).toBe(6)
    })

    it('caches resolved positions', () => {
      const $pos1 = testDoc.resolve(2)
      const $pos2 = testDoc.resolve(2)
      expect($pos1).toBe($pos2) // Same cached instance
    })
  })

  describe('textOffset', () => {
    it('returns 0 for positions between nodes', () => {
      expect(testDoc.resolve(0).textOffset).toBe(0)
      expect(testDoc.resolve(4).textOffset).toBe(0)
    })

    it('returns offset for positions in text', () => {
      expect(testDoc.resolve(2).textOffset).toBe(1) // After "a"
      expect(testDoc.resolve(7).textOffset).toBe(1) // After "c"
    })
  })

  describe('parent and doc', () => {
    it('returns correct parent', () => {
      expect(testDoc.resolve(2).parent.eq(_p1.node)).toBe(true)
      expect(testDoc.resolve(7).parent.eq(_p2.node)).toBe(true)
    })

    it('returns doc as root', () => {
      expect(testDoc.resolve(2).doc.eq(testDoc)).toBe(true)
      expect(testDoc.resolve(7).doc.eq(testDoc)).toBe(true)
    })
  })
})

describe('NodeRange', () => {
  it('creates a range around a textblock from positions within it', () => {
    // Positions 1 and 3 are inside the first paragraph
    // blockRange returns the range at the doc level (depth 0) containing the paragraph
    const $from = testDoc.resolve(1)
    const $to = testDoc.resolve(3)
    const range = $from.blockRange($to)

    expect(range).not.toBeNull()
    expect(range!.depth).toBe(0) // doc level (parent of the textblock)
    expect(range!.start).toBe(0) // before paragraph
    expect(range!.end).toBe(4) // after paragraph
    expect(range!.parent.eq(_doc.node)).toBe(true)
    expect(range!.startIndex).toBe(0)
    expect(range!.endIndex).toBe(1)
  })

  it('finds the right depth for cross-block ranges', () => {
    const $from = testDoc.resolve(2)
    const $to = testDoc.resolve(7)
    const range = $from.blockRange($to)

    expect(range).not.toBeNull()
    expect(range!.depth).toBe(0) // doc level (common ancestor)
  })

  it('handles ranges within nested blocks', () => {
    // Positions 6-10 are inside blockquote > p
    const $from = testDoc.resolve(6)
    const $to = testDoc.resolve(10)
    const range = $from.blockRange($to)

    expect(range).not.toBeNull()
    expect(range!.depth).toBe(1) // blockquote level
  })
})
