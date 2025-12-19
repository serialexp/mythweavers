import { Fragment, Mark, Node, ResolvedPos, Slice } from '../model'
import { Mapping } from '../transform'

/**
 * Superclass for editor selections. Every selection type should
 * extend this class.
 */
export abstract class Selection {
  /**
   * The ranges covered by this selection.
   */
  readonly ranges: readonly SelectionRange[]

  /**
   * Initialize a selection with the head and anchor and ranges.
   * The `ranges` array must not be empty.
   */
  constructor(
    /** The resolved anchor of the selection (the side that stays in place). */
    readonly $anchor: ResolvedPos,
    /** The resolved head of the selection (the side that moves when shift-selecting). */
    readonly $head: ResolvedPos,
    ranges?: readonly SelectionRange[],
  ) {
    this.ranges = ranges || [new SelectionRange($anchor.min($head), $anchor.max($head))]
  }

  /** The selection's anchor, as an unresolved position. */
  get anchor(): number {
    return this.$anchor.pos
  }

  /** The selection's head. */
  get head(): number {
    return this.$head.pos
  }

  /** The lower bound of the selection's main range. */
  get from(): number {
    return this.$from.pos
  }

  /** The upper bound of the selection's main range. */
  get to(): number {
    return this.$to.pos
  }

  /** The resolved lower bound of the selection's main range. */
  get $from(): ResolvedPos {
    return this.ranges[0].$from
  }

  /** The resolved upper bound of the selection's main range. */
  get $to(): ResolvedPos {
    return this.ranges[0].$to
  }

  /** Indicates whether the selection contains any content. */
  get empty(): boolean {
    const ranges = this.ranges
    for (let i = 0; i < ranges.length; i++) {
      if (ranges[i].$from.pos !== ranges[i].$to.pos) return false
    }
    return true
  }

  /**
   * Get the content of this selection as a slice.
   */
  content(): Slice {
    return this.$from.doc.slice(this.from, this.to, true)
  }

  /**
   * Replace the selection with a slice or, if no slice is given, delete
   * the selection. Will append to the given transaction.
   */
  replace(tr: Transaction, content: Slice = Slice.empty): void {
    const mapFrom = tr.steps.length
    const ranges = this.ranges
    for (let i = 0; i < ranges.length; i++) {
      const { $from, $to } = ranges[i]
      const mapping = tr.mapping.slice(mapFrom)
      const from = mapping.map($from.pos)
      const to = mapping.map($to.pos)
      if (i) {
        tr.delete(from, to)
      } else {
        tr.replace(from, to, content)
      }
    }
    const head = this.$head
    const sel = Selection.findFrom(tr.doc.resolve(tr.mapping.slice(mapFrom).map(head.pos)), 1, true)
    if (sel) tr.setSelection(sel)
  }

  /**
   * Replace the selection with the given node, appending the changes
   * to the given transaction.
   */
  replaceWith(tr: Transaction, node: Node): void {
    const mapFrom = tr.steps.length
    const ranges = this.ranges
    for (let i = 0; i < ranges.length; i++) {
      const { $from, $to } = ranges[i]
      const mapping = tr.mapping.slice(mapFrom)
      tr.replaceWith(mapping.map($from.pos), mapping.map($to.pos), i ? Fragment.empty : Fragment.from(node))
    }

    const head = this.$head
    const set = Selection.findFrom(tr.doc.resolve(tr.mapping.slice(mapFrom).map(head.pos)), 1, true)
    if (set) tr.setSelection(set)
  }

  /**
   * Map this selection through a mappable thing.
   */
  abstract map(doc: Node, mapping: Mappable): Selection

  /**
   * Convert the selection to a JSON representation.
   */
  abstract toJSON(): object

  /**
   * Compare this selection to another selection.
   */
  abstract eq(other: Selection): boolean

  /**
   * Get a bookmark for this selection, which can be used to recreate
   * the selection after the document has changed.
   */
  getBookmark(): SelectionBookmark {
    return TextSelection.between(this.$anchor, this.$head).getBookmark()
  }

  /**
   * Controls whether creating a selection between the two positions
   * creates a text selection.
   */
  visible = true

  /**
   * Find a valid cursor or leaf node selection starting at the given
   * position and searching back if `dir` is negative, forward if positive.
   */
  static findFrom($pos: ResolvedPos, dir: number, textOnly = false): Selection | null {
    const inner = $pos.parent.inlineContent
      ? new TextSelection($pos)
      : findSelectionIn($pos.node(0), $pos.parent, $pos.pos, $pos.index(), dir, textOnly)
    if (inner) return inner

    for (let depth = $pos.depth - 1; depth >= 0; depth--) {
      const found =
        dir < 0
          ? findSelectionIn($pos.node(0), $pos.node(depth), $pos.before(depth + 1), $pos.index(depth), dir, textOnly)
          : findSelectionIn($pos.node(0), $pos.node(depth), $pos.after(depth + 1), $pos.index(depth) + 1, dir, textOnly)
      if (found) return found
    }
    return null
  }

  /**
   * Find a valid cursor or leaf node selection near the given position.
   */
  static near($pos: ResolvedPos, bias = 1): Selection {
    return Selection.findFrom($pos, bias) || Selection.findFrom($pos, -bias) || new AllSelection($pos.node(0))
  }

  /**
   * Find the cursor or leaf node selection closest to the start of
   * the document.
   */
  static atStart(doc: Node): Selection {
    return findSelectionIn(doc, doc, 0, 0, 1) || new AllSelection(doc)
  }

  /**
   * Find the cursor or leaf node selection closest to the end of the
   * document.
   */
  static atEnd(doc: Node): Selection {
    return findSelectionIn(doc, doc, doc.content.size, doc.childCount, -1) || new AllSelection(doc)
  }

  /**
   * Deserialize the JSON representation of a selection.
   */
  static fromJSON(doc: Node, json: { type: string; anchor: number; head: number }): Selection {
    if (!json || !json.type) throw new RangeError('Invalid input for Selection.fromJSON')
    const cls = classesById[json.type]
    if (!cls) throw new RangeError(`No selection type ${json.type} defined`)
    return cls.fromJSON(doc, json)
  }

  /**
   * To be able to deserialize selections from JSON, custom selection
   * classes must register themselves.
   */
  static jsonID(id: string, selectionClass: { fromJSON: (doc: Node, json: object) => Selection }): void {
    if (id in classesById) throw new RangeError(`Duplicate use of selection JSON ID ${id}`)
    classesById[id] = selectionClass
  }
}

// Forward reference - will be set after Transaction is defined
interface Transaction {
  steps: unknown[]
  mapping: Mapping
  doc: Node
  replace(from: number, to: number, slice?: Slice): Transaction
  replaceWith(from: number, to: number, content: Fragment | Node): Transaction
  delete(from: number, to: number): Transaction
  setSelection(selection: Selection): Transaction
  ensureMarks(marks: readonly Mark[]): Transaction
}

interface Mappable {
  map(pos: number, assoc?: number): number
  mapResult(pos: number, assoc?: number): { pos: number; deleted: boolean }
}

const classesById: { [id: string]: { fromJSON: (doc: Node, json: object) => Selection } } = Object.create(null)

/**
 * Represents a single range in a selection.
 */
export class SelectionRange {
  constructor(
    /** The lower bound of the range. */
    readonly $from: ResolvedPos,
    /** The upper bound of the range. */
    readonly $to: ResolvedPos,
  ) {}
}

/**
 * A text selection represents a classical editor selection, with a
 * head (the moving side) and anchor (the fixed side).
 */
export class TextSelection extends Selection {
  /**
   * Construct a text selection between the given points.
   */
  constructor($anchor: ResolvedPos, $head: ResolvedPos = $anchor) {
    super($anchor, $head)
  }

  /**
   * Returns a resolved position if this is a cursor selection (an
   * empty text selection), and null otherwise.
   */
  get $cursor(): ResolvedPos | null {
    return this.$anchor.pos === this.$head.pos ? this.$head : null
  }

  map(doc: Node, mapping: Mappable): Selection {
    const $head = doc.resolve(mapping.map(this.head))
    if (!$head.parent.inlineContent) return Selection.near($head)
    const $anchor = doc.resolve(mapping.map(this.anchor))
    return new TextSelection($anchor.parent.inlineContent ? $anchor : $head, $head)
  }

  replace(tr: Transaction, content = Slice.empty): void {
    super.replace(tr, content)
    if (content === Slice.empty) {
      const marks = this.$from.marksAcross(this.$to)
      if (marks) tr.ensureMarks(marks)
    }
  }

  eq(other: Selection): boolean {
    return other instanceof TextSelection && other.anchor === this.anchor && other.head === this.head
  }

  getBookmark(): SelectionBookmark {
    return new TextBookmark(this.anchor, this.head)
  }

  toJSON(): { type: string; anchor: number; head: number } {
    return { type: 'text', anchor: this.anchor, head: this.head }
  }

  static fromJSON(doc: Node, json: { anchor?: number; head?: number }): TextSelection {
    if (typeof json.anchor !== 'number' || typeof json.head !== 'number') {
      throw new RangeError('Invalid input for TextSelection.fromJSON')
    }
    return new TextSelection(doc.resolve(json.anchor), doc.resolve(json.head))
  }

  /**
   * Create a text selection from non-resolved positions.
   */
  static create(doc: Node, anchor: number, head = anchor): TextSelection {
    const $anchor = doc.resolve(anchor)
    return new TextSelection($anchor, head === anchor ? $anchor : doc.resolve(head))
  }

  /**
   * Return a text selection that spans the given positions or, if
   * they aren't text positions, returns null.
   */
  static between($anchor: ResolvedPos, $head: ResolvedPos, bias?: number): Selection {
    const dPos = $anchor.pos - $head.pos
    if (!bias || dPos) bias = dPos >= 0 ? 1 : -1

    if (!$head.parent.inlineContent) {
      const found = Selection.findFrom($head, bias, true) || Selection.findFrom($head, -bias, true)
      if (found) $head = found.$head
      else return Selection.near($head, bias)
    }
    if (!$anchor.parent.inlineContent) {
      if (dPos === 0) {
        $anchor = $head
      } else {
        $anchor = (Selection.findFrom($anchor, -bias, true) || Selection.findFrom($anchor, bias, true))!.$anchor
        if ($anchor.pos < $head.pos !== dPos < 0) $anchor = $head
      }
    }
    return new TextSelection($anchor, $head)
  }
}

Selection.jsonID('text', TextSelection)

class TextBookmark implements SelectionBookmark {
  constructor(
    readonly anchor: number,
    readonly head: number,
  ) {}

  map(mapping: Mappable): SelectionBookmark {
    return new TextBookmark(mapping.map(this.anchor), mapping.map(this.head))
  }

  resolve(doc: Node): Selection {
    return TextSelection.between(doc.resolve(this.anchor), doc.resolve(this.head))
  }
}

/**
 * A node selection is a selection that points at a single node.
 */
export class NodeSelection extends Selection {
  /** The selected node. */
  readonly node: Node

  /**
   * Create a node selection. Does not verify the validity of its argument.
   */
  constructor($pos: ResolvedPos) {
    const node = $pos.nodeAfter!
    const $end = $pos.node(0).resolve($pos.pos + node.nodeSize)
    super($pos, $end)
    this.node = node
  }

  map(doc: Node, mapping: Mappable): Selection {
    const { deleted, pos } = mapping.mapResult(this.anchor)
    const $pos = doc.resolve(pos)
    if (deleted) return Selection.near($pos)
    return new NodeSelection($pos)
  }

  replace(tr: Transaction, content = Slice.empty): void {
    if (content === Slice.empty) {
      tr.delete(this.from, this.to)
      const sel = Selection.findFrom(tr.doc.resolve(this.from), 1, true)
      if (sel) tr.setSelection(sel)
    } else {
      super.replace(tr, content)
    }
  }

  content(): Slice {
    return new Slice(Fragment.from(this.node), 0, 0)
  }

  eq(other: Selection): boolean {
    return other instanceof NodeSelection && other.anchor === this.anchor
  }

  toJSON(): { type: string; anchor: number } {
    return { type: 'node', anchor: this.anchor }
  }

  getBookmark(): SelectionBookmark {
    return new NodeBookmark(this.anchor)
  }

  static fromJSON(doc: Node, json: { anchor?: number }): NodeSelection {
    if (typeof json.anchor !== 'number') {
      throw new RangeError('Invalid input for NodeSelection.fromJSON')
    }
    return new NodeSelection(doc.resolve(json.anchor))
  }

  /**
   * Create a node selection from non-resolved positions.
   */
  static create(doc: Node, from: number): NodeSelection {
    return new NodeSelection(doc.resolve(from))
  }

  /**
   * Determines whether the given node may be selected as a node selection.
   */
  static isSelectable(node: Node): boolean {
    return !node.isText && node.type.spec.selectable !== false
  }
}

Selection.jsonID('node', NodeSelection)

class NodeBookmark implements SelectionBookmark {
  constructor(readonly anchor: number) {}

  map(mapping: Mappable): SelectionBookmark {
    const { deleted, pos } = mapping.mapResult(this.anchor)
    return deleted ? new TextBookmark(pos, pos) : new NodeBookmark(pos)
  }

  resolve(doc: Node): Selection {
    const $pos = doc.resolve(this.anchor)
    const node = $pos.nodeAfter
    if (node && NodeSelection.isSelectable(node)) return new NodeSelection($pos)
    return Selection.near($pos)
  }
}

/**
 * A selection type that represents selecting the whole document.
 */
export class AllSelection extends Selection {
  /**
   * Create an all-selection over the given document.
   */
  constructor(doc: Node) {
    super(doc.resolve(0), doc.resolve(doc.content.size))
  }

  replace(tr: Transaction, content = Slice.empty): void {
    if (content === Slice.empty) {
      tr.delete(0, tr.doc.content.size)
      const sel = Selection.findFrom(tr.doc.resolve(0), 1)
      if (sel) tr.setSelection(sel)
    } else {
      super.replace(tr, content)
    }
  }

  toJSON(): { type: string } {
    return { type: 'all' }
  }

  static fromJSON(doc: Node): AllSelection {
    return new AllSelection(doc)
  }

  map(doc: Node): AllSelection {
    return new AllSelection(doc)
  }

  eq(other: Selection): boolean {
    return other instanceof AllSelection
  }

  getBookmark(): SelectionBookmark {
    return AllBookmark
  }
}

Selection.jsonID('all', AllSelection)

const AllBookmark: SelectionBookmark = {
  map() {
    return this
  },
  resolve(doc: Node) {
    return new AllSelection(doc)
  },
}

/**
 * A bookmark is a lightweight representation of a selection that
 * can be used to map the selection through document changes.
 */
export interface SelectionBookmark {
  map(mapping: Mappable): SelectionBookmark
  resolve(doc: Node): Selection
}

function findSelectionIn(
  doc: Node,
  node: Node | null,
  pos: number,
  index: number,
  dir: number,
  text = false,
): Selection | null {
  if (!node) return null
  if (node.inlineContent) return TextSelection.create(doc, pos)
  for (let i = index - (dir > 0 ? 0 : 1); dir > 0 ? i < node.childCount : i >= 0; i += dir) {
    const child = node.child(i)
    if (!child.isAtom) {
      const inner = findSelectionIn(doc, child, pos + dir, dir < 0 ? child.childCount : 0, dir, text)
      if (inner) return inner
    } else if (!text && NodeSelection.isSelectable(child)) {
      return NodeSelection.create(doc, pos - (dir < 0 ? child.nodeSize : 0))
    }
    pos += child.nodeSize * dir
  }
  return null
}

// Re-export Transaction interface for external use
export type { Transaction as TransactionInterface }
