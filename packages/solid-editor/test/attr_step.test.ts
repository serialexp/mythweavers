import { describe, expect, it } from 'vitest'
import { AttrStep, DocAttrStep, Mapping, StepMap, Transform } from '../src/transform'
import { eq } from './builder'
import { doc, h1, h2, img, p } from './schema'

describe('AttrStep', () => {
  describe('apply', () => {
    it('can change a heading level', () => {
      const d = doc(h1('hello'))

      // h1 is at position 0 (first child of doc)
      const step = new AttrStep(0, 'level', 2)
      const result = step.apply(d)

      expect(result.failed).toBeNull()
      expect(result.doc!.firstChild!.attrs.level).toBe(2)
      expect(result.doc!.textContent).toBe('hello')
    })

    it('can change image attributes', () => {
      const d = doc(p('text', img()))

      // img is at position 5 (after "text")
      const step = new AttrStep(5, 'alt', 'An image')
      const result = step.apply(d)

      expect(result.failed).toBeNull()
      const imgNode = result.doc!.firstChild!.child(1)
      expect(imgNode.attrs.alt).toBe('An image')
    })

    it('fails if no node at position', () => {
      const d = doc(p('hello'))

      // Position 100 is out of bounds
      const step = new AttrStep(100, 'level', 2)
      const result = step.apply(d)

      expect(result.failed).not.toBeNull()
    })
  })

  describe('invert', () => {
    it('can invert an attribute change', () => {
      const d = doc(h1('hello'))

      const step = new AttrStep(0, 'level', 2)
      const result = step.apply(d)

      expect(result.failed).toBeNull()

      const inverted = step.invert(d)
      const restored = inverted.apply(result.doc!)

      expect(restored.failed).toBeNull()
      expect(eq(restored.doc!, d)).toBe(true)
    })
  })

  describe('map', () => {
    it('can be mapped through position changes', () => {
      const mapping = new Mapping()
      // Insert 5 chars at position 10 (after the heading)
      mapping.appendMap(new StepMap([10, 0, 5]))

      // Heading at position 0 stays at position 0
      const step = new AttrStep(0, 'level', 2)

      const mapped = step.map(mapping)
      expect(mapped).not.toBeNull()
      expect((mapped as AttrStep).pos).toBe(0)
    })

    it('adjusts position when content is inserted before', () => {
      const mapping = new Mapping()
      // Delete 7 chars at position 0, insert 14 chars
      mapping.appendMap(new StepMap([0, 7, 14]))

      // Position 7 (after original heading) maps to 14
      const step = new AttrStep(7, 'level', 2)

      const mapped = step.map(mapping)
      expect(mapped).not.toBeNull()
      expect((mapped as AttrStep).pos).toBe(14)
    })

    it('returns null when position is deleted', () => {
      const mapping = new Mapping()
      // Delete content at position 5 (inside a range that covers position 7)
      mapping.appendMap(new StepMap([5, 10, 0]))

      // Position 7 is inside the deleted range
      const step = new AttrStep(7, 'level', 2)

      const mapped = step.map(mapping)
      expect(mapped).toBeNull()
    })
  })

  describe('getMap', () => {
    it("returns empty map (attr changes don't move positions)", () => {
      const step = new AttrStep(0, 'level', 2)
      const map = step.getMap()
      expect(map).toBe(StepMap.empty)
    })
  })

  describe('JSON serialization', () => {
    it('can serialize to JSON', () => {
      const step = new AttrStep(0, 'level', 2)

      const json = step.toJSON()
      expect(json.stepType).toBe('attr')
      expect(json.pos).toBe(0)
      expect(json.attr).toBe('level')
      expect(json.value).toBe(2)
    })

    it('can deserialize from JSON', () => {
      const d = doc(h1('hello'))
      const schema = d.type.schema

      const step = new AttrStep(0, 'level', 2)
      const json = step.toJSON()
      const restored = AttrStep.fromJSON(schema, json)

      expect(restored.pos).toBe(0)
      expect(restored.attr).toBe('level')
      expect(restored.value).toBe(2)
    })

    it('can handle null values', () => {
      const d = doc(p('text', img()))
      const schema = d.type.schema

      const step = new AttrStep(5, 'alt', null)
      const json = step.toJSON()
      const restored = AttrStep.fromJSON(schema, json)

      expect(restored.value).toBeNull()
    })
  })

  describe('integration with Transform', () => {
    it('can be used via Transform.step', () => {
      const d = doc(h1('hello'))

      const tr = new Transform(d)
      tr.step(new AttrStep(0, 'level', 3))

      expect(tr.docChanged).toBe(true)
      expect(tr.doc.firstChild!.attrs.level).toBe(3)
    })

    it('is chainable with other steps', () => {
      const d = doc(h1('hello'), h2('world'))

      const tr = new Transform(d)
      // First heading at position 0, nodeSize = 7 (1 + 5 + 1)
      tr.step(new AttrStep(0, 'level', 2))
      // Second heading at position 7
      tr.step(new AttrStep(7, 'level', 3))

      expect(tr.steps.length).toBe(2)
      expect(tr.doc.child(0).attrs.level).toBe(2)
      expect(tr.doc.child(1).attrs.level).toBe(3)
    })
  })
})

describe('DocAttrStep', () => {
  describe('apply', () => {
    it('applies successfully and preserves content', () => {
      const d = doc(p('hello'))

      // DocAttrStep sets an attribute on the document
      const step = new DocAttrStep('someAttr', 'someValue')
      const result = step.apply(d)

      expect(result.failed).toBeNull()
      // Content should be preserved
      expect(result.doc!.textContent).toBe('hello')
      // A new doc was created
      expect(result.doc).not.toBe(d)
    })
  })

  describe('invert', () => {
    it('can invert a doc attribute change', () => {
      const d = doc(p('hello'))

      const step = new DocAttrStep('someAttr', 'newValue')
      const result = step.apply(d)

      expect(result.failed).toBeNull()

      const inverted = step.invert(d)
      const restored = inverted.apply(result.doc!)

      expect(restored.failed).toBeNull()
      // Content should be preserved through both operations
      expect(restored.doc!.textContent).toBe('hello')
    })
  })

  describe('map', () => {
    it('returns itself (doc attrs are position-independent)', () => {
      const mapping = new Mapping()
      mapping.appendMap(new StepMap([0, 0, 5]))

      const step = new DocAttrStep('someAttr', 'Test')
      const mapped = step.map(mapping)

      expect(mapped).toBe(step)
    })
  })

  describe('getMap', () => {
    it('returns empty map', () => {
      const step = new DocAttrStep('someAttr', 'Test')
      const map = step.getMap()
      expect(map).toBe(StepMap.empty)
    })
  })

  describe('JSON serialization', () => {
    it('can serialize to JSON', () => {
      const step = new DocAttrStep('someAttr', 'Test')

      const json = step.toJSON()
      expect(json.stepType).toBe('docAttr')
      expect(json.attr).toBe('someAttr')
      expect(json.value).toBe('Test')
    })

    it('can deserialize from JSON', () => {
      const d = doc(p('hello'))
      const schema = d.type.schema

      const step = new DocAttrStep('someAttr', 'Test')
      const json = step.toJSON()
      const restored = DocAttrStep.fromJSON(schema, json)

      expect(restored.attr).toBe('someAttr')
      expect(restored.value).toBe('Test')
    })
  })

  describe('integration with Transform', () => {
    it('can be used via Transform.step', () => {
      const d = doc(p('hello'))

      const tr = new Transform(d)
      tr.step(new DocAttrStep('someAttr', 'value'))

      expect(tr.docChanged).toBe(true)
      // The document content should be preserved
      expect(tr.doc.textContent).toBe('hello')
      // A step was recorded
      expect(tr.steps.length).toBe(1)
    })
  })
})
