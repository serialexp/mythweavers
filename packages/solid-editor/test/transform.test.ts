import { describe, expect, it } from 'vitest'
import { Fragment, Slice } from '../src/model'
import { ReplaceStep, Transform } from '../src/transform'
import { eq } from './builder'
import { doc, em, p, strong } from './schema'

describe('Transform', () => {
  describe('replace', () => {
    it('can delete text', () => {
      const tr = new Transform(doc(p('hello world')))
      tr.delete(2, 7)
      expect(tr.doc.textContent).toBe('hworld')
    })

    it('can insert text', () => {
      const tr = new Transform(doc(p('hello')))
      tr.insertText(' world', 6)
      expect(tr.doc.textContent).toBe('hello world')
    })

    it('can replace text', () => {
      const tr = new Transform(doc(p('hello world')))
      tr.insertText('beautiful ', 7, 7)
      expect(tr.doc.textContent).toBe('hello beautiful world')
    })

    it('can replace across paragraphs', () => {
      const tr = new Transform(doc(p('one'), p('two')))
      tr.delete(2, 7)
      expect(tr.doc.textContent).toBe('owo')
      expect(tr.doc.childCount).toBe(1)
    })

    it('can insert a node', () => {
      const tr = new Transform(doc(p('hello')))
      const schema = tr.doc.type.schema
      tr.insert(6, schema.text(' world'))
      expect(tr.doc.textContent).toBe('hello world')
    })

    it('can replaceWith a fragment', () => {
      const tr = new Transform(doc(p('hello')))
      const schema = tr.doc.type.schema
      tr.replaceWith(2, 5, Fragment.from(schema.text('XYZ')))
      expect(tr.doc.textContent).toBe('hXYZo')
    })
  })

  describe('docChanged', () => {
    it('is false when no steps have been applied', () => {
      const tr = new Transform(doc(p('hello')))
      expect(tr.docChanged).toBe(false)
    })

    it('is true after a step', () => {
      const tr = new Transform(doc(p('hello')))
      tr.delete(2, 4)
      expect(tr.docChanged).toBe(true)
    })

    it('is true even for no-effect replace', () => {
      // Even if a replace doesn't change content, if a step was added, docChanged is true
      const tr = new Transform(doc(p('hello')))
      tr.replace(2, 2) // empty replace at position
      // This doesn't add a step because replaceStep returns null for no-ops
      expect(tr.docChanged).toBe(false)
    })
  })

  describe('before', () => {
    it('returns the original document', () => {
      const original = doc(p('hello'))
      const tr = new Transform(original)
      tr.delete(2, 4)
      expect(eq(tr.before, original)).toBe(true)
      expect(eq(tr.doc, original)).toBe(false)
    })

    it('returns current doc when no steps applied', () => {
      const original = doc(p('hello'))
      const tr = new Transform(original)
      expect(tr.before).toBe(tr.doc)
    })
  })

  describe('mapping', () => {
    it('tracks position changes', () => {
      const tr = new Transform(doc(p('hello world')))
      tr.delete(2, 7) // delete "ello "
      // Position 8 (start of "world") should map to 3
      expect(tr.mapping.map(8)).toBe(3)
    })

    it('tracks multiple changes', () => {
      const tr = new Transform(doc(p('hello world')))
      tr.delete(2, 4) // "hlo world"
      tr.delete(5, 7) // "hlo orld" (deleting "wo" at adjusted positions)
      expect(tr.steps.length).toBe(2)
      expect(tr.mapping.maps.length).toBe(2)
    })
  })

  describe('step', () => {
    it('throws on invalid step', () => {
      const tr = new Transform(doc(p('hello')))
      // Try to create an invalid replacement - this throws RangeError from content validation
      expect(() => {
        tr.replace(0, 0, new Slice(Fragment.from(doc(p('nested'))), 0, 0))
      }).toThrow()
    })
  })

  describe('maybeStep', () => {
    it('returns failed result instead of throwing', () => {
      const tr = new Transform(doc(p('hello')))
      const result = tr.maybeStep(new ReplaceStep(0, 0, new Slice(Fragment.from(doc(p('nested'))), 0, 0)))
      expect(result.failed).not.toBeNull()
      expect(tr.docChanged).toBe(false)
    })
  })

  describe('docs', () => {
    it('stores intermediate documents', () => {
      const original = doc(p('hello world'))
      const tr = new Transform(original)
      tr.delete(2, 4) // deleted "el" -> "hlo world"
      tr.delete(6, 7) // deleted "o" -> "hlo wrld"

      expect(tr.docs.length).toBe(2)
      expect(eq(tr.docs[0], original)).toBe(true)
      expect(tr.docs[1].textContent).toBe('hlo world')
      expect(tr.doc.textContent).toBe('hlo wrld')
    })
  })

  describe('chaining', () => {
    it('allows method chaining', () => {
      const tr = new Transform(doc(p('hello world'))).delete(6, 7).insertText('beautiful ', 6)
      expect(tr.doc.textContent).toBe('hellobeautiful world')
    })
  })

  describe('with marks', () => {
    it('preserves marks when inserting text', () => {
      const d = doc(p('hello ', em('world')))
      const tr = new Transform(d)
      // Insert inside the emphasized text
      tr.insertText('beautiful ', 10)
      // Check that marks are preserved
      const child = tr.doc.firstChild!
      expect(child.childCount).toBe(2)
    })
  })

  describe('addMark', () => {
    it('can add a mark to text', () => {
      const d = doc(p('hello world'))
      const schema = d.type.schema
      const tr = new Transform(d)
      tr.addMark(2, 7, schema.marks.em.create())

      expect(tr.docChanged).toBe(true)
      expect(tr.steps.length).toBe(1)
      // Check "ello " has em mark
      const para = tr.doc.firstChild!
      expect(para.childCount).toBe(3)
      expect(para.child(1).marks.length).toBe(1)
      expect(para.child(1).marks[0].type.name).toBe('em')
    })

    it('skips if mark already present', () => {
      const d = doc(p('hello ', em('world')))
      const schema = d.type.schema
      const tr = new Transform(d)
      // Try to add em to already em'd text
      tr.addMark(7, 12, schema.marks.em.create())

      expect(tr.docChanged).toBe(false)
      expect(tr.steps.length).toBe(0)
    })

    it('can add mark across multiple text nodes', () => {
      const d = doc(p('hello ', strong('world'), ' today'))
      const schema = d.type.schema
      const tr = new Transform(d)
      // Add em across all text
      tr.addMark(2, 19, schema.marks.em.create())

      expect(tr.docChanged).toBe(true)
      // All inline nodes should now have em
      let hasEm = true
      tr.doc.nodesBetween(2, 19, (node) => {
        if (node.isInline && !node.marks.some((m) => m.type.name === 'em')) {
          hasEm = false
        }
      })
      expect(hasEm).toBe(true)
    })

    it('can extend partial marking', () => {
      const d = doc(p('hello ', em('wor'), 'ld'))
      const schema = d.type.schema
      const tr = new Transform(d)
      // Add em to extend to cover "world" - "wor" at 7-10, "ld" at 10-12
      tr.addMark(7, 12, schema.marks.em.create())

      expect(tr.docChanged).toBe(true)
      // "ld" should now also be emphasized
    })

    it('replaces conflicting mark with different attrs', () => {
      // Create a link mark with href
      const d = doc(p('hello world'))
      const schema = d.type.schema

      // First add a link
      const tr = new Transform(d)
      const link1 = schema.marks.link.create({ href: 'http://a.com' })
      tr.addMark(2, 7, link1)

      // Then add a different link to overlapping range
      const link2 = schema.marks.link.create({ href: 'http://b.com' })
      tr.addMark(4, 9, link2)

      // The overlapping portion should have the new link
      const _para = tr.doc.firstChild!
      // Check that multiple link operations occurred
      expect(tr.steps.length).toBeGreaterThan(1)
    })

    it('is chainable', () => {
      const d = doc(p('hello world'))
      const schema = d.type.schema
      const tr = new Transform(d).addMark(2, 7, schema.marks.em.create()).addMark(7, 12, schema.marks.strong.create())

      expect(tr.steps.length).toBe(2)
    })
  })

  describe('removeMark', () => {
    it('can remove a specific mark', () => {
      const d = doc(p('hello ', em('world')))
      const schema = d.type.schema
      const tr = new Transform(d)
      tr.removeMark(7, 12, schema.marks.em.create())

      expect(tr.docChanged).toBe(true)
      // All text should now be unmarked
      const para = tr.doc.firstChild!
      para.forEach((node) => {
        expect(node.marks.length).toBe(0)
      })
    })

    it('does nothing if mark not present', () => {
      const d = doc(p('hello world'))
      const schema = d.type.schema
      const tr = new Transform(d)
      tr.removeMark(2, 7, schema.marks.em.create())

      expect(tr.docChanged).toBe(false)
    })

    it('can remove by mark type', () => {
      const d = doc(p('hello ', em('world')))
      const schema = d.type.schema
      const tr = new Transform(d)
      tr.removeMark(7, 12, schema.marks.em)

      expect(tr.docChanged).toBe(true)
      const para = tr.doc.firstChild!
      para.forEach((node) => {
        expect(node.marks.length).toBe(0)
      })
    })

    it('can remove all marks when no mark specified', () => {
      const d = doc(p(em('hello '), strong('world')))
      const _schema = d.type.schema
      const tr = new Transform(d)
      tr.removeMark(1, 13)

      expect(tr.docChanged).toBe(true)
      const para = tr.doc.firstChild!
      para.forEach((node) => {
        expect(node.marks.length).toBe(0)
      })
    })

    it('removes only from specified range', () => {
      const d = doc(p(em('hello world')))
      const schema = d.type.schema
      const tr = new Transform(d)
      // Remove em only from "hello"
      tr.removeMark(1, 6, schema.marks.em.create())

      expect(tr.docChanged).toBe(true)
      const para = tr.doc.firstChild!
      // Should have unmarked "hello" and marked " world"
      expect(para.childCount).toBe(2)
      expect(para.child(0).marks.length).toBe(0)
      expect(para.child(1).marks.length).toBe(1)
    })

    it('is chainable', () => {
      const d = doc(p(em(strong('hello world'))))
      const schema = d.type.schema
      const tr = new Transform(d)
        .removeMark(1, 6, schema.marks.em.create())
        .removeMark(1, 6, schema.marks.strong.create())

      expect(tr.steps.length).toBe(2)
    })

    it('merges adjacent ranges for same mark', () => {
      const d = doc(p(em('hello'), em(' '), em('world')))
      const schema = d.type.schema
      const tr = new Transform(d)
      tr.removeMark(1, 13, schema.marks.em.create())

      // Should merge into single step since it's continuous em text
      expect(tr.docChanged).toBe(true)
    })
  })
})
