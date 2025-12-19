import { describe, expect, it } from 'vitest'
import {
  AddMarkStep,
  AddNodeMarkStep,
  Mapping,
  RemoveMarkStep,
  RemoveNodeMarkStep,
  StepMap,
  Transform,
} from '../src/transform'
import { eq } from './builder'
import { doc, em, img, p } from './schema'

describe('AddMarkStep', () => {
  it('can add a mark to text', () => {
    const d = doc(p('hello world'))
    const schema = d.type.schema
    const emMark = schema.marks.em.create()

    const step = new AddMarkStep(2, 7, emMark)
    const result = step.apply(d)

    expect(result.failed).toBeNull()
    expect(result.doc!.firstChild!.childCount).toBe(3)
    // Check that "ello " has the em mark
    const emChild = result.doc!.firstChild!.child(1)
    expect(emChild.marks.length).toBe(1)
    expect(emChild.marks[0].type.name).toBe('em')
  })

  it('inverts to RemoveMarkStep', () => {
    const d = doc(p('hello'))
    const schema = d.type.schema
    const emMark = schema.marks.em.create()

    const step = new AddMarkStep(2, 5, emMark)
    const inverted = step.invert()

    expect(inverted).toBeInstanceOf(RemoveMarkStep)
    expect((inverted as RemoveMarkStep).from).toBe(2)
    expect((inverted as RemoveMarkStep).to).toBe(5)
  })

  it('can be mapped through position changes', () => {
    const mapping = new Mapping()
    mapping.appendMap(new StepMap([1, 0, 3])) // insert 3 chars at pos 1

    const d = doc(p('hello'))
    const schema = d.type.schema
    const step = new AddMarkStep(2, 5, schema.marks.em.create())

    const mapped = step.map(mapping)
    expect(mapped).not.toBeNull()
    expect((mapped as AddMarkStep).from).toBe(5) // 2 + 3
    expect((mapped as AddMarkStep).to).toBe(8) // 5 + 3
  })

  it('returns null when mapped range is deleted', () => {
    const mapping = new Mapping()
    mapping.appendMap(new StepMap([2, 5, 0])) // delete from 2 to 7

    const d = doc(p('hello'))
    const schema = d.type.schema
    const step = new AddMarkStep(3, 5, schema.marks.em.create())

    const mapped = step.map(mapping)
    expect(mapped).toBeNull()
  })

  it('can merge adjacent mark additions', () => {
    const d = doc(p('hello world'))
    const schema = d.type.schema
    const emMark = schema.marks.em.create()

    const step1 = new AddMarkStep(2, 5, emMark)
    const step2 = new AddMarkStep(5, 8, emMark)

    const merged = step1.merge(step2)
    expect(merged).not.toBeNull()
    expect((merged as AddMarkStep).from).toBe(2)
    expect((merged as AddMarkStep).to).toBe(8)
  })

  it('cannot merge non-adjacent mark additions', () => {
    const d = doc(p('hello world'))
    const schema = d.type.schema
    const emMark = schema.marks.em.create()

    const step1 = new AddMarkStep(2, 4, emMark)
    const step2 = new AddMarkStep(6, 8, emMark)

    const merged = step1.merge(step2)
    expect(merged).toBeNull()
  })

  it('serializes to JSON', () => {
    const d = doc(p('hello'))
    const schema = d.type.schema
    const step = new AddMarkStep(2, 5, schema.marks.em.create())

    const json = step.toJSON()
    expect(json.stepType).toBe('addMark')
    expect(json.from).toBe(2)
    expect(json.to).toBe(5)
    expect(json.mark.type).toBe('em')
  })

  it('deserializes from JSON', () => {
    const d = doc(p('hello'))
    const schema = d.type.schema

    const step = AddMarkStep.fromJSON(schema, {
      from: 2,
      to: 5,
      mark: { type: 'em' },
    })

    expect(step.from).toBe(2)
    expect(step.to).toBe(5)
    expect(step.mark.type.name).toBe('em')
  })
})

describe('RemoveMarkStep', () => {
  it('can remove a mark from text', () => {
    const d = doc(p('hello ', em('world')))
    const schema = d.type.schema
    const emMark = schema.marks.em.create()

    // The em text starts at position 7 (after "hello ")
    const step = new RemoveMarkStep(7, 12, emMark)
    const result = step.apply(d)

    expect(result.failed).toBeNull()
    // After removing, all text should have no em marks
    const textContent = result.doc!.textContent
    expect(textContent).toBe('hello world')
  })

  it('inverts to AddMarkStep', () => {
    const d = doc(p('hello'))
    const schema = d.type.schema
    const emMark = schema.marks.em.create()

    const step = new RemoveMarkStep(2, 5, emMark)
    const inverted = step.invert()

    expect(inverted).toBeInstanceOf(AddMarkStep)
  })

  it('can merge overlapping removals', () => {
    const d = doc(p('hello world'))
    const schema = d.type.schema
    const emMark = schema.marks.em.create()

    const step1 = new RemoveMarkStep(2, 6, emMark)
    const step2 = new RemoveMarkStep(4, 8, emMark)

    const merged = step1.merge(step2)
    expect(merged).not.toBeNull()
    expect((merged as RemoveMarkStep).from).toBe(2)
    expect((merged as RemoveMarkStep).to).toBe(8)
  })
})

describe('AddNodeMarkStep', () => {
  it('can add a mark to a leaf node', () => {
    const d = doc(p('hello', img()))
    const schema = d.type.schema
    const emMark = schema.marks.em.create()

    // img is at position 6 (after "hello" which is positions 2-6)
    const step = new AddNodeMarkStep(6, emMark)
    const result = step.apply(d)

    expect(result.failed).toBeNull()
  })

  it('inverts to RemoveNodeMarkStep', () => {
    const d = doc(p('hello', img()))
    const schema = d.type.schema
    const emMark = schema.marks.em.create()

    const step = new AddNodeMarkStep(6, emMark)
    const inverted = step.invert(d)

    expect(inverted).toBeInstanceOf(RemoveNodeMarkStep)
  })

  it('can serialize and deserialize', () => {
    const d = doc(p('hello'))
    const schema = d.type.schema
    const emMark = schema.marks.em.create()

    const step = new AddNodeMarkStep(1, emMark)
    const json = step.toJSON()

    expect(json.stepType).toBe('addNodeMark')
    expect(json.pos).toBe(1)

    const restored = AddNodeMarkStep.fromJSON(schema, json)
    expect(restored.pos).toBe(1)
    expect(restored.mark.type.name).toBe('em')
  })

  it('can be mapped', () => {
    const mapping = new Mapping()
    mapping.appendMap(new StepMap([1, 0, 5])) // insert 5 chars at pos 1

    const d = doc(p('hello'))
    const schema = d.type.schema
    const step = new AddNodeMarkStep(3, schema.marks.em.create())

    const mapped = step.map(mapping)
    expect(mapped).not.toBeNull()
    expect((mapped as AddNodeMarkStep).pos).toBe(8) // 3 + 5
  })
})

describe('RemoveNodeMarkStep', () => {
  it('inverts to AddNodeMarkStep when mark exists', () => {
    const d = doc(p('hello', img()))
    const schema = d.type.schema
    const emMark = schema.marks.em.create()

    // First add the mark
    const addStep = new AddNodeMarkStep(6, emMark)
    const withMark = addStep.apply(d).doc!

    // Then create remove step and invert it
    const removeStep = new RemoveNodeMarkStep(6, emMark)
    const inverted = removeStep.invert(withMark)

    expect(inverted).toBeInstanceOf(AddNodeMarkStep)
  })

  it('serializes to JSON', () => {
    const d = doc(p('hello'))
    const schema = d.type.schema
    const step = new RemoveNodeMarkStep(3, schema.marks.em.create())

    const json = step.toJSON()
    expect(json.stepType).toBe('removeNodeMark')
    expect(json.pos).toBe(3)
  })
})

describe('Mark step integration with Transform', () => {
  it('can add and remove marks through Transform', () => {
    const d = doc(p('hello world'))
    const schema = d.type.schema

    const tr = new Transform(d)
    tr.step(new AddMarkStep(2, 7, schema.marks.em.create()))

    expect(tr.docChanged).toBe(true)
    expect(tr.steps.length).toBe(1)

    // Invert should restore original
    const inverted = tr.steps[0].invert(d)
    const restored = new Transform(tr.doc).step(inverted)
    expect(eq(restored.doc, d)).toBe(true)
  })
})
