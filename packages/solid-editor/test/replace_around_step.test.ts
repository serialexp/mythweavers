import { describe, expect, it } from 'vitest'
import { Fragment, Slice } from '../src/model'
import { Mapping, ReplaceAroundStep, StepMap, Transform } from '../src/transform'
import { eq } from './builder'
import { blockquote, doc, p } from './schema'

describe('ReplaceAroundStep', () => {
  describe('wrapping', () => {
    it('can wrap a paragraph in a blockquote', () => {
      const d = doc(p('hello'))
      const schema = d.type.schema

      // doc(p("hello")) positions:
      // 0: start of doc content (before p)
      // 1: inside p, before text
      // 2-6: "hello" characters
      // 7: after p (end of doc content)

      // To wrap the paragraph in blockquote:
      // Replace 0-7 (the whole paragraph) with blockquote containing the paragraph
      // gapFrom=0, gapTo=7 preserves the paragraph
      const bq = schema.nodes.blockquote.create()
      const slice = new Slice(
        Fragment.from(bq),
        0, // openStart
        0, // openEnd
      )

      // insert=1 means put gap content at position 1 in the slice (inside the blockquote)
      const step = new ReplaceAroundStep(0, 7, 0, 7, slice, 1)
      const result = step.apply(d)

      expect(result.failed).toBeNull()
      expect(result.doc!.firstChild!.type.name).toBe('blockquote')
      expect(result.doc!.firstChild!.firstChild!.type.name).toBe('paragraph')
    })

    it('can unwrap a blockquote', () => {
      const d = doc(blockquote(p('hello')))

      // doc(blockquote(p("hello"))) positions:
      // 0: start of doc content (before blockquote)
      // 1: inside blockquote, before p
      // 2: inside p, before text
      // 3-7: "hello" characters
      // 8: after p (inside blockquote)
      // 9: after blockquote (end of doc content)

      // Unwrap: replace 0-9 but keep 1-8 (the paragraph)
      const step = new ReplaceAroundStep(0, 9, 1, 8, Slice.empty, 0)
      const result = step.apply(d)

      expect(result.failed).toBeNull()
      expect(result.doc!.firstChild!.type.name).toBe('paragraph')
      expect(result.doc!.textContent).toBe('hello')
    })
  })

  describe('invert', () => {
    it('can invert a wrap operation', () => {
      const d = doc(p('hello'))
      const schema = d.type.schema

      const bq = schema.nodes.blockquote.create()
      const slice = new Slice(Fragment.from(bq), 0, 0)
      const step = new ReplaceAroundStep(0, 7, 0, 7, slice, 1)
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
      mapping.appendMap(new StepMap([0, 0, 5])) // insert 5 chars at start

      const d = doc(p('hello'))
      const schema = d.type.schema

      const bq = schema.nodes.blockquote.create()
      const slice = new Slice(Fragment.from(bq), 0, 0)
      const step = new ReplaceAroundStep(0, 7, 0, 7, slice, 1)

      const mapped = step.map(mapping)
      expect(mapped).not.toBeNull()
      expect((mapped as ReplaceAroundStep).from).toBe(5) // 0 + 5
      expect((mapped as ReplaceAroundStep).to).toBe(12) // 7 + 5
    })

    it('preserves gap relationship after mapping', () => {
      const mapping = new Mapping()
      // Insert 10 chars at position 0
      mapping.appendMap(new StepMap([0, 0, 10]))

      const d = doc(p('hello'))
      const schema = d.type.schema

      const bq = schema.nodes.blockquote.create()
      const slice = new Slice(Fragment.from(bq), 0, 0)
      const step = new ReplaceAroundStep(0, 7, 0, 7, slice, 1)

      const mapped = step.map(mapping)
      expect(mapped).not.toBeNull()
      // All positions should shift by 10
      expect((mapped as ReplaceAroundStep).from).toBe(10)
      expect((mapped as ReplaceAroundStep).to).toBe(17)
      expect((mapped as ReplaceAroundStep).gapFrom).toBe(10)
      expect((mapped as ReplaceAroundStep).gapTo).toBe(17)
    })
  })

  describe('getMap', () => {
    it('returns a step map', () => {
      const d = doc(p('hello'))
      const schema = d.type.schema

      const bq = schema.nodes.blockquote.create()
      const slice = new Slice(Fragment.from(bq), 0, 0)
      const step = new ReplaceAroundStep(0, 7, 0, 7, slice, 1)

      const map = step.getMap()
      expect(map).toBeDefined()
    })
  })

  describe('JSON serialization', () => {
    it('can serialize to JSON', () => {
      const d = doc(p('hello'))
      const schema = d.type.schema

      const bq = schema.nodes.blockquote.create()
      const slice = new Slice(Fragment.from(bq), 0, 0)
      const step = new ReplaceAroundStep(0, 7, 0, 7, slice, 1)

      const json = step.toJSON()
      expect(json.stepType).toBe('replaceAround')
      expect(json.from).toBe(0)
      expect(json.to).toBe(7)
      expect(json.gapFrom).toBe(0)
      expect(json.gapTo).toBe(7)
      expect(json.insert).toBe(1)
    })

    it('can deserialize from JSON', () => {
      const d = doc(p('hello'))
      const schema = d.type.schema

      const bq = schema.nodes.blockquote.create()
      const slice = new Slice(Fragment.from(bq), 0, 0)
      const step = new ReplaceAroundStep(0, 7, 0, 7, slice, 1)

      const json = step.toJSON()
      const restored = ReplaceAroundStep.fromJSON(schema, json)

      expect(restored.from).toBe(0)
      expect(restored.to).toBe(7)
      expect(restored.gapFrom).toBe(0)
      expect(restored.gapTo).toBe(7)
      expect(restored.insert).toBe(1)
    })
  })

  describe('structure flag', () => {
    it('fails with structure=true if there is content between gap edges', () => {
      const d = doc(p('hello'), p('world'))

      // Try to replace with structure check when content exists
      // between from and gapFrom or between gapTo and to
      // Replace 0-7 but gap is only 1-6 (leaving content outside gap)
      const step = new ReplaceAroundStep(0, 7, 1, 6, Slice.empty, 0, true)
      const result = step.apply(d)

      expect(result.failed).not.toBeNull()
    })
  })

  describe('integration with Transform', () => {
    it('can be used via Transform.step', () => {
      const d = doc(p('hello'))
      const schema = d.type.schema

      const bq = schema.nodes.blockquote.create()
      const slice = new Slice(Fragment.from(bq), 0, 0)
      const step = new ReplaceAroundStep(0, 7, 0, 7, slice, 1)

      const tr = new Transform(d)
      tr.step(step)

      expect(tr.docChanged).toBe(true)
      expect(tr.doc.firstChild!.type.name).toBe('blockquote')
    })
  })
})
