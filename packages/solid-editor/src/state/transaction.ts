import { Mark, Node, Slice } from '../model'
import { Transform } from '../transform'
import { Selection } from './selection'

/**
 * An editor state transaction, which can be applied to a state to
 * create an updated state. Extends Transform with selection and
 * metadata management.
 */
export class Transaction extends Transform {
  /**
   * The timestamp associated with this transaction, in the same
   * format as `Date.now()`.
   */
  readonly time: number

  /**
   * The stored marks set by this transaction, if any.
   */
  private storedMarksSet: readonly Mark[] | null = null

  /**
   * The current selection after this transaction.
   */
  curSelection: Selection

  /**
   * The selection before the transaction was applied.
   */
  readonly curSelectionFor: number = 0

  /**
   * The step count this selection was based on.
   */
  private updated = 0

  /**
   * Metadata attached to this transaction.
   */
  private meta: Map<string | Plugin<unknown>, unknown> = new Map()

  constructor(state: EditorState) {
    super(state.doc)
    this.time = Date.now()
    this.curSelection = state.selection
    this.storedMarksSet = state.storedMarks
  }

  /**
   * The transaction's current selection. This defaults to the editor
   * selection mapped through the steps in the transaction, but can be
   * changed with `setSelection`.
   */
  get selection(): Selection {
    if (this.curSelectionFor < this.steps.length) {
      ;(this as { curSelection: Selection }).curSelection = this.curSelection.map(
        this.doc,
        this.mapping.slice(this.curSelectionFor),
      )
      ;(this as { curSelectionFor: number }).curSelectionFor = this.steps.length
    }
    return this.curSelection
  }

  /**
   * Update the transaction's current selection. Will determine the
   * selection that the editor gets when the transaction is applied.
   */
  setSelection(selection: Selection): this {
    if (selection.$from.doc !== this.doc) {
      throw new RangeError('Selection passed to setSelection must point at the current document')
    }
    this.curSelection = selection
    ;(this as { curSelectionFor: number }).curSelectionFor = this.steps.length
    this.updated = (this.updated | UPDATED_SEL) & ~UPDATED_MARKS
    this.storedMarksSet = null
    return this
  }

  /**
   * Whether the selection was explicitly updated by this transaction.
   */
  get selectionSet(): boolean {
    return (this.updated & UPDATED_SEL) > 0
  }

  /**
   * Set the current stored marks.
   */
  setStoredMarks(marks: readonly Mark[] | null): this {
    this.storedMarksSet = marks
    this.updated |= UPDATED_MARKS
    return this
  }

  /**
   * Make sure the current stored marks or, if that is null, the marks
   * at the selection, match the given set of marks. Does nothing if
   * this is already the case.
   */
  ensureMarks(marks: readonly Mark[]): this {
    if (!Mark.sameSet(this.storedMarks || [], marks)) {
      this.setStoredMarks(marks)
    }
    return this
  }

  /**
   * Add a mark to the set of stored marks.
   */
  addStoredMark(mark: Mark): this {
    return this.ensureMarks(mark.addToSet(this.storedMarks || []))
  }

  /**
   * Remove a mark or mark type from the set of stored marks.
   */
  removeStoredMark(mark: Mark | import('../model').MarkType): this {
    return this.ensureMarks(mark.removeFromSet(this.storedMarks || []))
  }

  /**
   * The stored marks set on this transaction, if any.
   */
  get storedMarks(): readonly Mark[] | null {
    return this.storedMarksSet
  }

  /**
   * Whether the stored marks were explicitly set for this transaction.
   */
  get storedMarksSet_(): boolean {
    return (this.updated & UPDATED_MARKS) > 0
  }

  /**
   * Store a metadata property in this transaction. Used by plugins.
   */
  setMeta(key: string | Plugin<unknown> | { key: string }, value: unknown): this {
    this.meta.set(typeof key === 'object' && 'key' in key ? key.key : key, value)
    return this
  }

  /**
   * Retrieve a metadata property from this transaction.
   */
  getMeta(key: string | Plugin<unknown> | { key: string }): unknown {
    return this.meta.get(typeof key === 'object' && 'key' in key ? key.key : key)
  }

  /**
   * Returns true if this transaction doesn't contain any metadata.
   */
  get isGeneric(): boolean {
    for (const [key] of this.meta) {
      if (typeof key === 'string') return false
    }
    return true
  }

  /**
   * Indicate that the given position or range was explicitly scrolled
   * into view.
   */
  scrollIntoView(): this {
    this.updated |= UPDATED_SCROLL
    return this
  }

  /**
   * True when this transaction has had scrollIntoView called on it.
   */
  get scrolledIntoView(): boolean {
    return (this.updated & UPDATED_SCROLL) > 0
  }

  /**
   * Delete the current selection.
   */
  deleteSelection(): this {
    const sel = this.selection
    if (!sel.empty) {
      this.delete(sel.from, sel.to)
    }
    return this
  }

  /**
   * Replace the selection with the given content. If `inheritMarks` is true,
   * inherit marks from the content at the selection position.
   */
  replaceSelectionWith(node: import('../model').Node, inheritMarks = true): this {
    const sel = this.selection

    if (inheritMarks) {
      // Get marks to apply - match ProseMirror's logic
      const marks =
        this.storedMarks ||
        (sel.empty ? sel.$from.marks() : sel.$from.marksAcross(sel.$to) || Mark.none)

      // Apply marks to the node
      node = node.mark(marks)
    }

    sel.replaceWith(this, node)
    return this
  }

  /**
   * Replace the selection with the given slice.
   */
  replaceSelection(slice: Slice): this {
    const sel = this.selection
    this.replace(sel.from, sel.to, slice)
    return this
  }
}

const UPDATED_SEL = 1
const UPDATED_MARKS = 2
const UPDATED_SCROLL = 4

// Forward reference for EditorState - will be properly typed when imported
interface EditorState {
  doc: Node
  selection: Selection
  storedMarks: readonly Mark[] | null
}

// Forward reference for Plugin
interface Plugin<_T> {
  key: string
}
