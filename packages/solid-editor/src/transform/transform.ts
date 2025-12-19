import { Fragment, Mark, MarkType, Node, NodeRange, NodeType, Slice } from '../model'
import type { Attrs } from '../model/types'
import { Mapping } from './map'
import { AddMarkStep, RemoveMarkStep } from './mark_step'
import { ReplaceAroundStep } from './replace_around_step'
import { ReplaceStep } from './replace_step'
import { Step, StepResult } from './step'

/**
 * Error type for transform failures.
 */
export class TransformError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TransformError'
  }
}

/**
 * Abstraction to build up and track an array of steps representing
 * a document transformation.
 *
 * Most transforming methods return the `Transform` object itself, so
 * that they can be chained.
 */
export class Transform {
  /** The steps in this transform. */
  readonly steps: Step[] = []
  /** The documents before each of the steps. */
  readonly docs: Node[] = []
  /** A mapping with the maps for each of the steps in this transform. */
  readonly mapping: Mapping = new Mapping()

  /** Create a transform that starts with the given document. */
  constructor(
    /** The current document (the result of applying the steps in the transform). */
    public doc: Node,
  ) {}

  /** The starting document. */
  get before(): Node {
    return this.docs.length ? this.docs[0] : this.doc
  }

  /**
   * Apply a new step in this transform, saving the result. Throws an
   * error when the step fails.
   */
  step(step: Step): this {
    const result = this.maybeStep(step)
    if (result.failed) throw new TransformError(result.failed)
    return this
  }

  /**
   * Try to apply a step in this transformation, ignoring it if it
   * fails. Returns the step result.
   */
  maybeStep(step: Step): StepResult {
    const result = step.apply(this.doc)
    if (!result.failed) this.addStep(step, result.doc!)
    return result
  }

  /** True when the document has been changed (when there are any steps). */
  get docChanged(): boolean {
    return this.steps.length > 0
  }

  /** @internal */
  addStep(step: Step, doc: Node): void {
    this.docs.push(this.doc)
    this.steps.push(step)
    this.mapping.appendMap(step.getMap())
    this.doc = doc
  }

  /**
   * Replace the part of the document between `from` and `to` with the
   * given `slice`.
   */
  replace(from: number, to = from, slice = Slice.empty): this {
    const step = replaceStep(this.doc, from, to, slice)
    if (step) this.step(step)
    return this
  }

  /**
   * Replace the given range with the given content, which may be a
   * fragment, node, or array of nodes.
   */
  replaceWith(from: number, to: number, content: Fragment | Node | readonly Node[]): this {
    return this.replace(from, to, new Slice(Fragment.from(content), 0, 0))
  }

  /** Delete the content between the given positions. */
  delete(from: number, to: number): this {
    return this.replace(from, to, Slice.empty)
  }

  /** Insert the given content at the given position. */
  insert(pos: number, content: Fragment | Node | readonly Node[]): this {
    return this.replaceWith(pos, pos, content)
  }

  /**
   * Insert the given text at the given position, inheriting marks from
   * the position.
   */
  insertText(text: string, from: number, to = from): this {
    const schema = this.doc.type.schema
    const $from = this.doc.resolve(from)
    // Get marks at this position
    const marks = to === from ? $from.marks() : []
    return this.replaceWith(from, to, schema.text(text, marks))
  }

  /**
   * Add the given mark to the inline content between `from` and `to`.
   */
  addMark(from: number, to: number, mark: Mark): this {
    const removed: { from: number; to: number }[] = []
    const added: { from: number; to: number }[] = []
    let removing: { from: number; to: number } | null = null
    let adding: { from: number; to: number } | null = null

    console.log('[addMark] called with', { from, to, markType: mark.type.name })

    this.doc.nodesBetween(from, to, (node, pos, parent): undefined => {
      if (!node.isInline) return

      const marks = node.marks
      // Check if parent allows this mark type
      if (!parent!.type.allowsMarkType(mark.type)) {
        // Close any open adding range
        if (adding) {
          added.push(adding)
          adding = null
        }
        return
      }

      const start = Math.max(pos, from)
      const end = Math.min(pos + node.nodeSize, to)
      const fullText = node.isText ? node.text : null
      const markedText = fullText ? fullText.slice(start - pos, end - pos) : null
      console.log('[addMark] visiting node', {
        nodeType: node.type.name,
        pos,
        nodeSize: node.nodeSize,
        from,
        to,
        calculatedStart: start,
        calculatedEnd: end,
        fullText,
        markedText,
      })

      // Check if a mark of this type (with different attrs) needs to be removed
      const found = mark.type.isInSet(marks)
      if (found) {
        if (!mark.eq(found)) {
          // Different mark with same type - need to remove old one
          if (removing && removing.to === start) {
            removing.to = end
          } else {
            if (removing) removed.push(removing)
            removing = { from: start, to: end }
          }
        }
      }

      // Check if we need to add the mark
      if (!mark.isInSet(marks)) {
        if (adding && adding.to === start) {
          adding.to = end
        } else {
          if (adding) added.push(adding)
          adding = { from: start, to: end }
        }
      }
    })

    // Finalize any open ranges
    if (removing) removed.push(removing)
    if (adding) added.push(adding)

    console.log('[addMark] final ranges', { removed, added })

    // First remove conflicting marks, then add new marks
    for (let i = removed.length - 1; i >= 0; i--) {
      this.step(new RemoveMarkStep(removed[i].from, removed[i].to, mark))
    }
    for (let i = added.length - 1; i >= 0; i--) {
      console.log('[addMark] creating AddMarkStep', { from: added[i].from, to: added[i].to })
      this.step(new AddMarkStep(added[i].from, added[i].to, mark))
    }

    return this
  }

  /**
   * Remove marks from inline nodes between `from` and `to`. When
   * `mark` is a single mark, remove only that exact mark. When it's a
   * mark type, remove all marks of that type. When it's null, remove
   * all marks of any type.
   */
  removeMark(from: number, to: number, mark?: Mark | MarkType | null): this {
    const matched: { from: number; to: number; style: Mark }[] = []

    this.doc.nodesBetween(from, to, (node, pos): undefined => {
      if (!node.isInline) return
      const toRemove: Mark[] = []

      const start = Math.max(pos, from)
      const end = Math.min(pos + node.nodeSize, to)

      if (mark instanceof Mark) {
        // Remove specific mark instance
        if (mark.isInSet(node.marks)) {
          toRemove.push(mark)
        }
      } else if (mark instanceof MarkType) {
        // Remove all marks of this type
        const found = mark.isInSet(node.marks)
        if (found) {
          toRemove.push(found)
        }
      } else {
        // Remove all marks
        toRemove.push(...node.marks)
      }

      for (const m of toRemove) {
        // Try to extend an existing matched range
        let found = false
        for (const existing of matched) {
          if (existing.to === start && existing.style.eq(m)) {
            existing.to = end
            found = true
            break
          }
        }
        if (!found) {
          matched.push({ from: start, to: end, style: m })
        }
      }
    })

    // Apply steps in reverse order to avoid position shifting issues
    for (let i = matched.length - 1; i >= 0; i--) {
      this.step(new RemoveMarkStep(matched[i].from, matched[i].to, matched[i].style))
    }

    return this
  }

  /**
   * Lift the content in the given range out of its parent node.
   */
  lift(range: NodeRange, target: number): this {
    const { $from, $to, depth } = range

    const gapStart = $from.before(depth + 1)
    const gapEnd = $to.after(depth + 1)
    const start = gapStart
    const end = gapEnd

    let before = Fragment.empty
    let openStart = 0
    for (let d = depth, splitting = false; d > target; d--) {
      if (splitting || $from.index(d) > 0) {
        splitting = true
        before = Fragment.from($from.node(d).copy(before))
        openStart++
      } else {
        start - 1
      }
    }

    let after = Fragment.empty
    let openEnd = 0
    for (let d = depth, splitting = false; d > target; d--) {
      if (splitting || $to.after(d + 1) < $to.end(d)) {
        splitting = true
        after = Fragment.from($to.node(d).copy(after))
        openEnd++
      } else {
        end + 1
      }
    }

    return this.step(
      new ReplaceAroundStep(
        start,
        end,
        gapStart,
        gapEnd,
        new Slice(before.append(after), openStart, openEnd),
        before.size - openStart,
        true,
      ),
    )
  }

  /**
   * Wrap the given range in the given set of wrappers.
   */
  wrap(range: NodeRange, wrappers: readonly { type: NodeType; attrs?: Attrs | null }[]): this {
    let content = Fragment.empty
    for (let i = wrappers.length - 1; i >= 0; i--) {
      if (content.size) {
        const match = wrappers[i].type.contentMatch!.matchType(content.firstChild!.type)
        if (!match) {
          throw new RangeError("Wrapper type doesn't fit inside previous wrapper")
        }
      }
      content = Fragment.from(wrappers[i].type.create(wrappers[i].attrs || null, content))
    }

    const start = range.start
    const end = range.end

    return this.step(new ReplaceAroundStep(start, end, start, end, new Slice(content, 0, 0), wrappers.length, true))
  }

  /**
   * Set the type of all textblocks in the given range to the given type.
   */
  setBlockType(from: number, to: number | undefined, type: NodeType, attrs?: Attrs | null): this {
    to = to ?? from

    if (!type.isTextblock) {
      throw new RangeError('Type given to setBlockType should be a textblock')
    }

    const mapFrom = this.steps.length
    this.doc.nodesBetween(from, to, (node, pos): undefined => {
      if (
        node.isTextblock &&
        !node.hasMarkup(type, attrs) &&
        canChangeType(this.doc, this.mapping.slice(mapFrom).map(pos), type)
      ) {
        // Clear marks that aren't allowed in the new type
        const newMarks = type.allowedMarks(node.marks)
        const mappedPos = this.mapping.slice(mapFrom).map(pos)
        const startM = mappedPos + 1
        const endM = mappedPos + 1 + node.content.size

        // Set up the new node
        this.step(
          new ReplaceAroundStep(
            mappedPos,
            mappedPos + node.nodeSize,
            startM,
            endM,
            new Slice(Fragment.from(type.create(attrs, null, newMarks)), 0, 0),
            1,
            true,
          ),
        )
      }
    })

    return this
  }

  /**
   * Change the type, attributes, and/or marks of a node at the given position.
   * When `type` is not given, the existing node type is preserved.
   * Likewise, `attrs` and `marks` default to the node's current values.
   */
  setNodeMarkup(pos: number, type?: NodeType | null, attrs?: Attrs | null, marks?: readonly Mark[]): this {
    const node = this.doc.nodeAt(pos)
    if (!node) throw new RangeError('No node at given position')

    type = type ?? node.type
    const newNode = type.create(attrs ?? node.attrs, null, marks ?? node.marks)

    if (node.isLeaf) {
      return this.replaceWith(pos, pos + node.nodeSize, newNode)
    }

    if (!type.validContent(node.content)) {
      throw new RangeError(`Invalid content for node type ${type.name}`)
    }

    return this.step(
      new ReplaceAroundStep(
        pos,
        pos + node.nodeSize,
        pos + 1,
        pos + node.nodeSize - 1,
        new Slice(Fragment.from(newNode), 0, 0),
        1,
        true,
      ),
    )
  }

  /**
   * Split the node at the given position, optionally with types for the
   * nodes created.
   */
  split(pos: number, depth = 1, typesAfter?: { type: NodeType; attrs?: Attrs | null }[] | null): this {
    const $pos = this.doc.resolve(pos)

    let before = Fragment.empty
    let after = Fragment.empty

    for (let d = $pos.depth, e = $pos.depth - depth, i = depth - 1; d > e; d--, i--) {
      before = Fragment.from($pos.node(d).copy(before))
      const typeAfter = typesAfter?.[i]
      after = Fragment.from(typeAfter ? typeAfter.type.create(typeAfter.attrs, after) : $pos.node(d).copy(after))
    }

    return this.step(new ReplaceStep(pos, pos, new Slice(before.append(after), depth, depth)))
  }

  /**
   * Join the blocks around the given position. If depth is 2, their
   * parents are also joined, and so on.
   */
  join(pos: number, depth = 1): this {
    const step = new ReplaceStep(pos - depth, pos + depth, Slice.empty)
    return this.step(step)
  }
}

/**
 * Check if a block type change is valid at the given position.
 */
function canChangeType(doc: Node, pos: number, type: NodeType): boolean {
  const $pos = doc.resolve(pos)
  const index = $pos.index()
  return $pos.parent.canReplaceWith(index, index + 1, type)
}

/**
 * Create a ReplaceStep that fits a slice into a given position.
 * Returns null if the replace would be a no-op.
 *
 * This is a simplified version - the full ProseMirror implementation
 * has sophisticated fitting logic for complex cases.
 */
export function replaceStep(doc: Node, from: number, to = from, slice = Slice.empty): Step | null {
  if (from === to && !slice.size) return null

  const $from = doc.resolve(from)
  const $to = doc.resolve(to)

  // Simple case: no open nodes and we're replacing within the same parent
  if (fitsTrivially($from, $to, slice)) {
    return new ReplaceStep(from, to, slice)
  }

  // For now, just create the step and let it fail if it doesn't fit.
  // The full implementation would use the Fitter class to adjust the slice.
  return new ReplaceStep(from, to, slice)
}

/**
 * Check if a slice fits trivially at the given position.
 */
function fitsTrivially(
  $from: { start(): number; parent: Node; index(): number },
  $to: { start(): number; index(): number },
  slice: Slice,
): boolean {
  return (
    !slice.openStart &&
    !slice.openEnd &&
    $from.start() === $to.start() &&
    $from.parent.canReplace($from.index(), $to.index(), slice.content)
  )
}
