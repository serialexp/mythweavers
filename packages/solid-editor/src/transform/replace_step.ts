import { Node, Schema, Slice } from '../model'
import { Mappable, StepMap } from './map'
import { Step, StepResult } from './step'

/**
 * Replace a part of the document with a slice of new content.
 */
export class ReplaceStep extends Step {
  /**
   * The given `slice` should fit the 'gap' between `from` and
   * `to`—the depths must line up, and the surrounding nodes must be
   * able to be joined with the open sides of the slice. When
   * `structure` is true, the step will fail if the content between
   * from and to is not just a sequence of closing and then opening
   * tokens.
   */
  constructor(
    /** The start position of the replaced range. */
    readonly from: number,
    /** The end position of the replaced range. */
    readonly to: number,
    /** The slice to insert. */
    readonly slice: Slice,
    /** @internal */
    readonly structure = false,
  ) {
    super()
  }

  apply(doc: Node): StepResult {
    if (this.structure && contentBetween(doc, this.from, this.to)) {
      return StepResult.fail('Structure replace would overwrite content')
    }
    return StepResult.fromReplace(doc, this.from, this.to, this.slice)
  }

  getMap(): StepMap {
    return new StepMap([this.from, this.to - this.from, this.slice.size])
  }

  invert(doc: Node): Step {
    return new ReplaceStep(this.from, this.from + this.slice.size, doc.slice(this.from, this.to))
  }

  map(mapping: Mappable): Step | null {
    const from = mapping.mapResult(this.from, 1)
    const to = mapping.mapResult(this.to, -1)
    if (from.deletedAcross && to.deletedAcross) return null
    return new ReplaceStep(from.pos, Math.max(from.pos, to.pos), this.slice, this.structure)
  }

  merge(other: Step): Step | null {
    if (!(other instanceof ReplaceStep) || other.structure || this.structure) {
      return null
    }

    if (this.from + this.slice.size === other.from && !this.slice.openEnd && !other.slice.openStart) {
      const slice =
        this.slice.size + other.slice.size === 0
          ? Slice.empty
          : new Slice(this.slice.content.append(other.slice.content), this.slice.openStart, other.slice.openEnd)
      return new ReplaceStep(this.from, this.to + (other.to - other.from), slice, this.structure)
    }
    if (other.to === this.from && !this.slice.openStart && !other.slice.openEnd) {
      const slice =
        this.slice.size + other.slice.size === 0
          ? Slice.empty
          : new Slice(other.slice.content.append(this.slice.content), other.slice.openStart, this.slice.openEnd)
      return new ReplaceStep(other.from, this.to, slice, this.structure)
    }

    return null
  }

  toJSON(): {
    stepType: string
    from: number
    to: number
    slice?: ReturnType<Slice['toJSON']>
    structure?: boolean
  } {
    const json: ReturnType<ReplaceStep['toJSON']> = {
      stepType: 'replace',
      from: this.from,
      to: this.to,
    }
    if (this.slice.size) json.slice = this.slice.toJSON()
    if (this.structure) json.structure = true
    return json
  }

  static fromJSON(schema: Schema, json: unknown): ReplaceStep {
    const data = json as { from?: number; to?: number; slice?: unknown; structure?: boolean }
    if (typeof data.from !== 'number' || typeof data.to !== 'number') {
      throw new RangeError('Invalid input for ReplaceStep.fromJSON')
    }
    return new ReplaceStep(
      data.from,
      data.to,
      Slice.fromJSON(schema, data.slice as Parameters<typeof Slice.fromJSON>[1]),
      !!data.structure,
    )
  }
}

Step.jsonID('replace', ReplaceStep)

/**
 * Check if there is actual content between two positions.
 */
function contentBetween(doc: Node, from: number, to: number): boolean {
  const $from = doc.resolve(from)
  let dist = to - from
  let depth = $from.depth

  while (dist > 0 && depth > 0 && $from.indexAfter(depth) === $from.node(depth).childCount) {
    depth--
    dist--
  }

  if (dist > 0) {
    let next = $from.node(depth).maybeChild($from.indexAfter(depth))
    while (dist > 0) {
      if (!next || next.isLeaf) return true
      next = next.firstChild
      dist--
    }
  }

  return false
}
