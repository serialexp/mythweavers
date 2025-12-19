import { Node, Schema, Slice } from '../model'
import { Mappable, StepMap } from './map'
import { Step, StepResult } from './step'

/**
 * Replace a part of the document with a slice of content, but
 * preserve a range of the replaced region by moving it into the
 * slice.
 *
 * This is used for operations like wrapping (where the content is
 * wrapped in new parent nodes) and lifting (where wrapper nodes are
 * removed).
 */
export class ReplaceAroundStep extends Step {
  /**
   * Create a replace-around step. The positions `from` and `to`
   * describe the outer range to be replaced. `gapFrom` and `gapTo`
   * describe the range of content that should be preserved and moved
   * into the slice. The slice's open start and end, combined with
   * `insert`, determines where the preserved content goes.
   */
  constructor(
    /** The start of the replaced range. */
    readonly from: number,
    /** The end of the replaced range. */
    readonly to: number,
    /** The start of the gap (content to preserve). */
    readonly gapFrom: number,
    /** The end of the gap (content to preserve). */
    readonly gapTo: number,
    /** The slice to insert. */
    readonly slice: Slice,
    /** Position in the slice where the preserved content goes. */
    readonly insert: number,
    /** @internal */
    readonly structure = false,
  ) {
    super()
  }

  apply(doc: Node): StepResult {
    if (this.structure && (contentBetween(doc, this.from, this.gapFrom) || contentBetween(doc, this.gapTo, this.to))) {
      return StepResult.fail('Structure gap-replace would overwrite content')
    }

    const gap = doc.slice(this.gapFrom, this.gapTo)
    if (gap.openStart || gap.openEnd) {
      return StepResult.fail('Gap is not a flat range')
    }

    const inserted = this.slice.insertAt(this.insert, gap.content)
    if (!inserted) {
      return StepResult.fail('Content does not fit in gap')
    }

    return StepResult.fromReplace(doc, this.from, this.to, inserted)
  }

  getMap(): StepMap {
    return new StepMap([
      this.from,
      this.gapFrom - this.from,
      this.insert,
      this.gapTo,
      this.to - this.gapTo,
      this.slice.size - this.insert,
    ])
  }

  invert(doc: Node): Step {
    const gap = this.gapTo - this.gapFrom
    return new ReplaceAroundStep(
      this.from,
      this.from + this.slice.size + gap,
      this.from + this.insert,
      this.from + this.insert + gap,
      doc.slice(this.from, this.to).removeBetween(this.gapFrom - this.from, this.gapTo - this.from),
      this.gapFrom - this.from,
      this.structure,
    )
  }

  map(mapping: Mappable): Step | null {
    const from = mapping.mapResult(this.from, 1)
    const to = mapping.mapResult(this.to, -1)
    const gapFrom = this.from === this.gapFrom ? from.pos : mapping.map(this.gapFrom, -1)
    const gapTo = this.to === this.gapTo ? to.pos : mapping.map(this.gapTo, 1)

    if ((from.deletedAcross && to.deletedAcross) || gapFrom < from.pos || gapTo > to.pos) {
      return null
    }

    return new ReplaceAroundStep(from.pos, to.pos, gapFrom, gapTo, this.slice, this.insert, this.structure)
  }

  toJSON(): {
    stepType: string
    from: number
    to: number
    gapFrom: number
    gapTo: number
    insert: number
    slice?: ReturnType<Slice['toJSON']>
    structure?: boolean
  } {
    const json: ReturnType<ReplaceAroundStep['toJSON']> = {
      stepType: 'replaceAround',
      from: this.from,
      to: this.to,
      gapFrom: this.gapFrom,
      gapTo: this.gapTo,
      insert: this.insert,
    }
    if (this.slice.size) json.slice = this.slice.toJSON()
    if (this.structure) json.structure = true
    return json
  }

  static fromJSON(schema: Schema, json: unknown): ReplaceAroundStep {
    const data = json as {
      from?: number
      to?: number
      gapFrom?: number
      gapTo?: number
      insert?: number
      slice?: unknown
      structure?: boolean
    }
    if (
      typeof data.from !== 'number' ||
      typeof data.to !== 'number' ||
      typeof data.gapFrom !== 'number' ||
      typeof data.gapTo !== 'number' ||
      typeof data.insert !== 'number'
    ) {
      throw new RangeError('Invalid input for ReplaceAroundStep.fromJSON')
    }
    return new ReplaceAroundStep(
      data.from,
      data.to,
      data.gapFrom,
      data.gapTo,
      Slice.fromJSON(schema, data.slice as Parameters<typeof Slice.fromJSON>[1]),
      data.insert,
      !!data.structure,
    )
  }
}

Step.jsonID('replaceAround', ReplaceAroundStep)

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
