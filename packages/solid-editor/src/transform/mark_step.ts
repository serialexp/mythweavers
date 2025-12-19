import { Fragment, Mark, Node, Schema, Slice } from '../model'
import { Mappable } from './map'
import { Step, StepResult } from './step'

/**
 * Helper to map over all inline nodes in a fragment.
 */
function mapFragment(fragment: Fragment, f: (child: Node, parent: Node, i: number) => Node, parent: Node): Fragment {
  const mapped: Node[] = []
  for (let i = 0; i < fragment.childCount; i++) {
    let child = fragment.child(i)
    if (child.content.size) {
      child = child.copy(mapFragment(child.content, f, child))
    }
    if (child.isInline) {
      child = f(child, parent, i)
    }
    mapped.push(child)
  }
  return Fragment.fromArray(mapped)
}

/**
 * Add a mark to all inline content between two positions.
 */
export class AddMarkStep extends Step {
  constructor(
    /** The start of the marked range. */
    readonly from: number,
    /** The end of the marked range. */
    readonly to: number,
    /** The mark to add. */
    readonly mark: Mark,
  ) {
    super()
  }

  apply(doc: Node): StepResult {
    const oldSlice = doc.slice(this.from, this.to)
    const $from = doc.resolve(this.from)
    const parent = $from.node($from.sharedDepth(this.to))
    const slice = new Slice(
      mapFragment(
        oldSlice.content,
        (node, parent) => {
          if (!node.isAtom || !parent.type.allowsMarkType(this.mark.type)) {
            return node
          }
          return node.mark(this.mark.addToSet(node.marks))
        },
        parent,
      ),
      oldSlice.openStart,
      oldSlice.openEnd,
    )
    return StepResult.fromReplace(doc, this.from, this.to, slice)
  }

  invert(): Step {
    return new RemoveMarkStep(this.from, this.to, this.mark)
  }

  map(mapping: Mappable): Step | null {
    const from = mapping.mapResult(this.from, 1)
    const to = mapping.mapResult(this.to, -1)
    if ((from.deleted && to.deleted) || from.pos >= to.pos) return null
    return new AddMarkStep(from.pos, to.pos, this.mark)
  }

  merge(other: Step): Step | null {
    if (other instanceof AddMarkStep && other.mark.eq(this.mark) && this.from <= other.to && this.to >= other.from) {
      return new AddMarkStep(Math.min(this.from, other.from), Math.max(this.to, other.to), this.mark)
    }
    return null
  }

  toJSON(): { stepType: string; from: number; to: number; mark: ReturnType<Mark['toJSON']> } {
    return {
      stepType: 'addMark',
      mark: this.mark.toJSON(),
      from: this.from,
      to: this.to,
    }
  }

  static fromJSON(schema: Schema, json: unknown): AddMarkStep {
    const data = json as { from?: number; to?: number; mark?: unknown }
    if (typeof data.from !== 'number' || typeof data.to !== 'number') {
      throw new RangeError('Invalid input for AddMarkStep.fromJSON')
    }
    return new AddMarkStep(data.from, data.to, schema.markFromJSON(data.mark as ReturnType<Mark['toJSON']>))
  }
}

Step.jsonID('addMark', AddMarkStep)

/**
 * Remove a mark from all inline content between two positions.
 */
export class RemoveMarkStep extends Step {
  constructor(
    /** The start of the unmarked range. */
    readonly from: number,
    /** The end of the unmarked range. */
    readonly to: number,
    /** The mark to remove. */
    readonly mark: Mark,
  ) {
    super()
  }

  apply(doc: Node): StepResult {
    const oldSlice = doc.slice(this.from, this.to)
    const slice = new Slice(
      mapFragment(oldSlice.content, (node) => node.mark(this.mark.removeFromSet(node.marks)), doc),
      oldSlice.openStart,
      oldSlice.openEnd,
    )
    return StepResult.fromReplace(doc, this.from, this.to, slice)
  }

  invert(): Step {
    return new AddMarkStep(this.from, this.to, this.mark)
  }

  map(mapping: Mappable): Step | null {
    const from = mapping.mapResult(this.from, 1)
    const to = mapping.mapResult(this.to, -1)
    if ((from.deleted && to.deleted) || from.pos >= to.pos) return null
    return new RemoveMarkStep(from.pos, to.pos, this.mark)
  }

  merge(other: Step): Step | null {
    if (other instanceof RemoveMarkStep && other.mark.eq(this.mark) && this.from <= other.to && this.to >= other.from) {
      return new RemoveMarkStep(Math.min(this.from, other.from), Math.max(this.to, other.to), this.mark)
    }
    return null
  }

  toJSON(): { stepType: string; from: number; to: number; mark: ReturnType<Mark['toJSON']> } {
    return {
      stepType: 'removeMark',
      mark: this.mark.toJSON(),
      from: this.from,
      to: this.to,
    }
  }

  static fromJSON(schema: Schema, json: unknown): RemoveMarkStep {
    const data = json as { from?: number; to?: number; mark?: unknown }
    if (typeof data.from !== 'number' || typeof data.to !== 'number') {
      throw new RangeError('Invalid input for RemoveMarkStep.fromJSON')
    }
    return new RemoveMarkStep(data.from, data.to, schema.markFromJSON(data.mark as ReturnType<Mark['toJSON']>))
  }
}

Step.jsonID('removeMark', RemoveMarkStep)

/**
 * Add a mark to a specific node.
 */
export class AddNodeMarkStep extends Step {
  constructor(
    /** The position of the target node. */
    readonly pos: number,
    /** The mark to add. */
    readonly mark: Mark,
  ) {
    super()
  }

  apply(doc: Node): StepResult {
    const node = doc.nodeAt(this.pos)
    if (!node) return StepResult.fail("No node at mark step's position")
    const updated = node.type.create(node.attrs, null, this.mark.addToSet(node.marks))
    return StepResult.fromReplace(
      doc,
      this.pos,
      this.pos + 1,
      new Slice(Fragment.from(updated), 0, node.isLeaf ? 0 : 1),
    )
  }

  invert(doc: Node): Step {
    const node = doc.nodeAt(this.pos)
    if (node) {
      const newSet = this.mark.addToSet(node.marks)
      if (newSet.length === node.marks.length) {
        for (let i = 0; i < node.marks.length; i++) {
          if (!node.marks[i].isInSet(newSet)) {
            return new AddNodeMarkStep(this.pos, node.marks[i])
          }
        }
        return new AddNodeMarkStep(this.pos, this.mark)
      }
    }
    return new RemoveNodeMarkStep(this.pos, this.mark)
  }

  map(mapping: Mappable): Step | null {
    const pos = mapping.mapResult(this.pos, 1)
    return pos.deletedAfter ? null : new AddNodeMarkStep(pos.pos, this.mark)
  }

  toJSON(): { stepType: string; pos: number; mark: ReturnType<Mark['toJSON']> } {
    return { stepType: 'addNodeMark', pos: this.pos, mark: this.mark.toJSON() }
  }

  static fromJSON(schema: Schema, json: unknown): AddNodeMarkStep {
    const data = json as { pos?: number; mark?: unknown }
    if (typeof data.pos !== 'number') {
      throw new RangeError('Invalid input for AddNodeMarkStep.fromJSON')
    }
    return new AddNodeMarkStep(data.pos, schema.markFromJSON(data.mark as ReturnType<Mark['toJSON']>))
  }
}

Step.jsonID('addNodeMark', AddNodeMarkStep)

/**
 * Remove a mark from a specific node.
 */
export class RemoveNodeMarkStep extends Step {
  constructor(
    /** The position of the target node. */
    readonly pos: number,
    /** The mark to remove. */
    readonly mark: Mark,
  ) {
    super()
  }

  apply(doc: Node): StepResult {
    const node = doc.nodeAt(this.pos)
    if (!node) return StepResult.fail("No node at mark step's position")
    const updated = node.type.create(node.attrs, null, this.mark.removeFromSet(node.marks))
    return StepResult.fromReplace(
      doc,
      this.pos,
      this.pos + 1,
      new Slice(Fragment.from(updated), 0, node.isLeaf ? 0 : 1),
    )
  }

  invert(doc: Node): Step {
    const node = doc.nodeAt(this.pos)
    if (!node || !this.mark.isInSet(node.marks)) return this
    return new AddNodeMarkStep(this.pos, this.mark)
  }

  map(mapping: Mappable): Step | null {
    const pos = mapping.mapResult(this.pos, 1)
    return pos.deletedAfter ? null : new RemoveNodeMarkStep(pos.pos, this.mark)
  }

  toJSON(): { stepType: string; pos: number; mark: ReturnType<Mark['toJSON']> } {
    return { stepType: 'removeNodeMark', pos: this.pos, mark: this.mark.toJSON() }
  }

  static fromJSON(schema: Schema, json: unknown): RemoveNodeMarkStep {
    const data = json as { pos?: number; mark?: unknown }
    if (typeof data.pos !== 'number') {
      throw new RangeError('Invalid input for RemoveNodeMarkStep.fromJSON')
    }
    return new RemoveNodeMarkStep(data.pos, schema.markFromJSON(data.mark as ReturnType<Mark['toJSON']>))
  }
}

Step.jsonID('removeNodeMark', RemoveNodeMarkStep)
