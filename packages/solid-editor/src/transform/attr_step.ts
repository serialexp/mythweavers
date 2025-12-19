import { Fragment, Node, Schema, Slice } from '../model'
import { Mappable, StepMap } from './map'
import { Step, StepResult } from './step'

/**
 * Change the attributes of a node at a specific position.
 */
export class AttrStep extends Step {
  constructor(
    /** The position of the node to modify. */
    readonly pos: number,
    /** The attribute name to change. */
    readonly attr: string,
    /** The new value for the attribute. */
    readonly value: unknown,
  ) {
    super()
  }

  apply(doc: Node): StepResult {
    let node: Node | null
    try {
      node = doc.nodeAt(this.pos)
    } catch {
      return StepResult.fail('Position out of bounds')
    }

    if (!node) {
      return StepResult.fail("No node at attribute step's position")
    }

    const attrs: { [name: string]: unknown } = Object.create(null)
    for (const name in node.attrs) {
      attrs[name] = node.attrs[name]
    }
    attrs[this.attr] = this.value

    // Preserve the node's content when creating the updated node
    const updated = node.type.create(attrs, node.content, node.marks)
    return StepResult.fromReplace(doc, this.pos, this.pos + node.nodeSize, new Slice(Fragment.from(updated), 0, 0))
  }

  getMap(): StepMap {
    return StepMap.empty
  }

  invert(doc: Node): Step {
    const node = doc.nodeAt(this.pos)
    return new AttrStep(this.pos, this.attr, node ? node.attrs[this.attr] : null)
  }

  map(mapping: Mappable): Step | null {
    const pos = mapping.mapResult(this.pos, 1)
    return pos.deletedAfter ? null : new AttrStep(pos.pos, this.attr, this.value)
  }

  toJSON(): { stepType: string; pos: number; attr: string; value: unknown } {
    return {
      stepType: 'attr',
      pos: this.pos,
      attr: this.attr,
      value: this.value,
    }
  }

  static fromJSON(_schema: Schema, json: unknown): AttrStep {
    const data = json as { pos?: number; attr?: string; value?: unknown }
    if (typeof data.pos !== 'number' || typeof data.attr !== 'string') {
      throw new RangeError('Invalid input for AttrStep.fromJSON')
    }
    return new AttrStep(data.pos, data.attr, data.value)
  }
}

Step.jsonID('attr', AttrStep)

/**
 * Change a specific attribute on a node in the document.
 * This is a convenience step that handles updating a single attribute.
 */
export class DocAttrStep extends Step {
  constructor(
    /** The attribute name to change on the document. */
    readonly attr: string,
    /** The new value for the attribute. */
    readonly value: unknown,
  ) {
    super()
  }

  apply(doc: Node): StepResult {
    const attrs: { [name: string]: unknown } = Object.create(null)
    for (const name in doc.attrs) {
      attrs[name] = doc.attrs[name]
    }
    attrs[this.attr] = this.value

    const updated = doc.type.create(attrs, doc.content, doc.marks)
    return StepResult.ok(updated)
  }

  getMap(): StepMap {
    return StepMap.empty
  }

  invert(doc: Node): Step {
    return new DocAttrStep(this.attr, doc.attrs[this.attr])
  }

  map(_mapping: Mappable): Step | null {
    return this
  }

  toJSON(): { stepType: string; attr: string; value: unknown } {
    return {
      stepType: 'docAttr',
      attr: this.attr,
      value: this.value,
    }
  }

  static fromJSON(_schema: Schema, json: unknown): DocAttrStep {
    const data = json as { attr?: string; value?: unknown }
    if (typeof data.attr !== 'string') {
      throw new RangeError('Invalid input for DocAttrStep.fromJSON')
    }
    return new DocAttrStep(data.attr, data.value)
  }
}

Step.jsonID('docAttr', DocAttrStep)
