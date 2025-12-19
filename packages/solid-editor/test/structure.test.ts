import { describe, expect, it } from 'vitest'
import { Transform, canJoin, canSplit, liftTarget } from '../src/transform'
import { blockquote, doc, h1, p } from './schema'

describe('Structure Helpers', () => {
  describe('liftTarget', () => {
    it('finds lift target for paragraph in blockquote', () => {
      const d = doc(blockquote(p('hello')))
      const $from = d.resolve(2) // inside paragraph
      const $to = d.resolve(7)
      const range = $from.blockRange($to)

      expect(range).not.toBeNull()
      const target = liftTarget(range!)
      // The target is 0 because we can lift to doc level
      expect(target).toBe(0)
    })

    it('returns null when lifting not possible', () => {
      const d = doc(p('hello'))
      const $from = d.resolve(1)
      const $to = d.resolve(6)
      const range = $from.blockRange($to)

      expect(range).not.toBeNull()
      const target = liftTarget(range!)
      expect(target).toBeNull() // already at top level
    })
  })

  describe('canSplit', () => {
    it('returns true for valid split position in textblock', () => {
      const d = doc(p('hello world'))
      // Position 7 is between "hello" and " world", inside paragraph
      expect(canSplit(d, 7)).toBe(true)
    })
  })

  describe('canJoin', () => {
    it('returns true for joinable blocks', () => {
      const d = doc(p('hello'), p('world'))
      // Position 7 is between the two paragraphs
      expect(canJoin(d, 7)).toBe(true)
    })

    it('returns false for non-joinable positions', () => {
      const d = doc(p('hello'))
      // Position 3 is inside text, not between blocks
      expect(canJoin(d, 3)).toBe(false)
    })
  })
})

describe('Transform structure methods', () => {
  describe('wrap', () => {
    it('can wrap a paragraph in a blockquote', () => {
      const d = doc(p('hello'))
      const schema = d.type.schema
      const $from = d.resolve(1)
      const $to = d.resolve(6)
      const range = $from.blockRange($to)

      expect(range).not.toBeNull()

      const tr = new Transform(d)
      tr.wrap(range!, [{ type: schema.nodes.blockquote }])

      expect(tr.docChanged).toBe(true)
      expect(tr.doc.firstChild!.type.name).toBe('blockquote')
      expect(tr.doc.firstChild!.firstChild!.type.name).toBe('paragraph')
      expect(tr.doc.textContent).toBe('hello')
    })

    it('can wrap multiple paragraphs in a blockquote', () => {
      const d = doc(p('hello'), p('world'))
      const schema = d.type.schema
      const $from = d.resolve(1)
      const $to = d.resolve(13)
      const range = $from.blockRange($to)

      expect(range).not.toBeNull()

      const tr = new Transform(d)
      tr.wrap(range!, [{ type: schema.nodes.blockquote }])

      expect(tr.docChanged).toBe(true)
      expect(tr.doc.childCount).toBe(1)
      expect(tr.doc.firstChild!.type.name).toBe('blockquote')
      expect(tr.doc.firstChild!.childCount).toBe(2)
    })
  })

  describe('setBlockType', () => {
    it('can change paragraph to heading', () => {
      const d = doc(p('hello'))
      const schema = d.type.schema

      const tr = new Transform(d)
      tr.setBlockType(1, 6, schema.nodes.heading, { level: 1 })

      expect(tr.docChanged).toBe(true)
      expect(tr.doc.firstChild!.type.name).toBe('heading')
      expect(tr.doc.firstChild!.attrs.level).toBe(1)
      expect(tr.doc.textContent).toBe('hello')
    })

    it('can change heading back to paragraph', () => {
      const d = doc(h1('hello'))
      const schema = d.type.schema

      const tr = new Transform(d)
      tr.setBlockType(1, 6, schema.nodes.paragraph)

      expect(tr.docChanged).toBe(true)
      expect(tr.doc.firstChild!.type.name).toBe('paragraph')
    })

    it('changes multiple blocks in range', () => {
      const d = doc(p('hello'), p('world'))
      const schema = d.type.schema

      const tr = new Transform(d)
      tr.setBlockType(1, 14, schema.nodes.heading, { level: 2 })

      expect(tr.docChanged).toBe(true)
      expect(tr.doc.child(0).type.name).toBe('heading')
      expect(tr.doc.child(1).type.name).toBe('heading')
    })
  })

  describe('split', () => {
    it('can split a paragraph', () => {
      const d = doc(p('hello world'))
      // Position 7 is after "hello "
      const tr = new Transform(d)
      tr.split(7)

      expect(tr.docChanged).toBe(true)
      expect(tr.doc.childCount).toBe(2)
      expect(tr.doc.child(0).textContent).toBe('hello ')
      expect(tr.doc.child(1).textContent).toBe('world')
    })

    it('can split with custom type after', () => {
      const d = doc(p('hello world'))
      const schema = d.type.schema

      const tr = new Transform(d)
      tr.split(7, 1, [{ type: schema.nodes.heading, attrs: { level: 1 } }])

      expect(tr.docChanged).toBe(true)
      expect(tr.doc.child(0).type.name).toBe('paragraph')
      expect(tr.doc.child(1).type.name).toBe('heading')
    })
  })

  describe('join', () => {
    it('can join two paragraphs', () => {
      const d = doc(p('hello'), p('world'))

      const tr = new Transform(d)
      tr.join(7)

      expect(tr.docChanged).toBe(true)
      expect(tr.doc.childCount).toBe(1)
      expect(tr.doc.textContent).toBe('helloworld')
    })
  })
})
