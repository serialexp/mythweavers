/**
 * CellSelection: a Selection subclass that models table cell selections.
 *
 * A cell selection spans a rectangular region of cells in a table.
 * It is identified by an anchor cell (the one that stays in place when
 * extending) and a head cell (the one that moves).
 *
 * The table plugin needs to be active to wire in the user interaction
 * part (mouse drag, shift-click, etc). This module only defines the
 * selection type and its serialization/mapping logic.
 *
 * Ported from prosemirror-tables/cellselection.ts.
 */

import { Fragment, Node, ResolvedPos, Slice } from '../model'
import {
  Selection,
  SelectionRange,
  TextSelection,
  NodeSelection,
  type SelectionBookmark,
} from '../state/selection'
import type { EditorState } from '../state/state'
import type { Mappable } from '../transform/map'
import { DecorationSet, node as nodeDecoration } from '../view/decoration'
import { TableMap } from './tablemap'
import type { CellAttrs } from './util'
import { inSameTable, pointsAtCell, removeColSpan } from './util'

/** JSON representation of a CellSelection. */
export interface CellSelectionJSON {
  type: string
  anchor: number
  head: number
}

/**
 * A Selection subclass that represents a cell selection spanning part of a table.
 *
 * When the table editing plugin is enabled, these will be created when the
 * user selects across cells, and will be drawn by giving selected cells a
 * `selectedCell` CSS class via node decorations.
 */
export class CellSelection extends Selection {
  /** Resolved position pointing _in front of_ the anchor cell. */
  readonly $anchorCell: ResolvedPos
  /** Resolved position pointing in front of the head cell. */
  readonly $headCell: ResolvedPos

  /**
   * Create a cell selection. The positions should point _before_ two
   * cells in the same table. They may be the same, to select a single cell.
   */
  constructor($anchorCell: ResolvedPos, $headCell: ResolvedPos = $anchorCell) {
    const table = $anchorCell.node(-1)
    const map = TableMap.get(table)
    const tableStart = $anchorCell.start(-1)
    const rect = map.rectBetween($anchorCell.pos - tableStart, $headCell.pos - tableStart)

    const doc = $anchorCell.node(0)
    const cells = map.cellsInRect(rect).filter((p) => p !== $headCell.pos - tableStart)
    // Make the head cell the first range, so it counts as the primary part
    cells.unshift($headCell.pos - tableStart)

    const ranges = cells.map((pos) => {
      const cell = table.nodeAt(pos)
      if (!cell) {
        throw new RangeError(`No cell with offset ${pos} found`)
      }
      const from = tableStart + pos + 1
      return new SelectionRange(doc.resolve(from), doc.resolve(from + cell.content.size))
    })

    super(ranges[0].$from, ranges[0].$to, ranges)
    this.$anchorCell = $anchorCell
    this.$headCell = $headCell
    // Override the base class's `visible = true` field assignment.
    // Cell selections should not show native browser selection — they use
    // decorations (selectedCell class) instead.
    this.visible = false
  }

  map(doc: Node, mapping: Mappable): CellSelection | Selection {
    const $anchorCell = doc.resolve(mapping.map(this.$anchorCell.pos))
    const $headCell = doc.resolve(mapping.map(this.$headCell.pos))
    if (pointsAtCell($anchorCell) && pointsAtCell($headCell) && inSameTable($anchorCell, $headCell)) {
      const tableChanged = this.$anchorCell.node(-1) !== $anchorCell.node(-1)
      if (tableChanged && this.isRowSelection()) {
        return CellSelection.rowSelection($anchorCell, $headCell)
      } else if (tableChanged && this.isColSelection()) {
        return CellSelection.colSelection($anchorCell, $headCell)
      }
      return new CellSelection($anchorCell, $headCell)
    }
    return TextSelection.between($anchorCell, $headCell)
  }

  /**
   * Returns a rectangular slice of table rows containing the selected cells.
   */
  content(): Slice {
    const table = this.$anchorCell.node(-1)
    const map = TableMap.get(table)
    const tableStart = this.$anchorCell.start(-1)

    const rect = map.rectBetween(this.$anchorCell.pos - tableStart, this.$headCell.pos - tableStart)
    const seen: Record<number, boolean> = {}
    const rows: Node[] = []

    for (let row = rect.top; row < rect.bottom; row++) {
      const rowContent: Node[] = []
      for (let index = row * map.width + rect.left, col = rect.left; col < rect.right; col++, index++) {
        const pos = map.map[index]
        if (seen[pos]) continue
        seen[pos] = true

        const cellRect = map.findCell(pos)
        let cell = table.nodeAt(pos)
        if (!cell) {
          throw new RangeError(`No cell with offset ${pos} found`)
        }

        const extraLeft = rect.left - cellRect.left
        const extraRight = cellRect.right - rect.right

        if (extraLeft > 0 || extraRight > 0) {
          let attrs = cell.attrs as CellAttrs
          if (extraLeft > 0) {
            attrs = removeColSpan(attrs, 0, extraLeft)
          }
          if (extraRight > 0) {
            attrs = removeColSpan(attrs, attrs.colspan - extraRight, extraRight)
          }
          if (cellRect.left < rect.left) {
            cell = cell.type.createAndFill(attrs)!
          } else {
            cell = cell.type.create(attrs, cell.content)
          }
        }

        if (cellRect.top < rect.top || cellRect.bottom > rect.bottom) {
          const attrs = {
            ...cell.attrs,
            rowspan: Math.min(cellRect.bottom, rect.bottom) - Math.max(cellRect.top, rect.top),
          }
          if (cellRect.top < rect.top) {
            cell = cell.type.createAndFill(attrs)!
          } else {
            cell = cell.type.create(attrs, cell.content)
          }
        }

        rowContent.push(cell)
      }
      rows.push(table.child(row).copy(Fragment.from(rowContent)))
    }

    const fragment = this.isColSelection() && this.isRowSelection() ? table : rows
    return new Slice(Fragment.from(fragment), 1, 1)
  }

  replace(tr: TransactionLike, content: Slice = Slice.empty): void {
    const mapFrom = tr.steps.length
    const ranges = this.ranges
    for (let i = 0; i < ranges.length; i++) {
      const { $from, $to } = ranges[i]
      const mapping = tr.mapping.slice(mapFrom)
      tr.replace(mapping.map($from.pos), mapping.map($to.pos), i ? Slice.empty : content)
    }
    const sel = Selection.findFrom(tr.doc.resolve(tr.mapping.slice(mapFrom).map(this.to)), -1)
    if (sel) tr.setSelection(sel)
  }

  replaceWith(tr: TransactionLike, node: Node): void {
    this.replace(tr, new Slice(Fragment.from(node), 0, 0))
  }

  /**
   * Call a function for every cell in the selection.
   */
  forEachCell(f: (node: Node, pos: number) => void): void {
    const table = this.$anchorCell.node(-1)
    const map = TableMap.get(table)
    const tableStart = this.$anchorCell.start(-1)

    const cells = map.cellsInRect(
      map.rectBetween(this.$anchorCell.pos - tableStart, this.$headCell.pos - tableStart),
    )
    for (let i = 0; i < cells.length; i++) {
      f(table.nodeAt(cells[i])!, tableStart + cells[i])
    }
  }

  /**
   * True if this selection spans all rows (from top to bottom of the table).
   */
  isColSelection(): boolean {
    const anchorTop = this.$anchorCell.index(-1)
    const headTop = this.$headCell.index(-1)
    if (Math.min(anchorTop, headTop) > 0) return false

    const anchorBottom = anchorTop + (this.$anchorCell.nodeAfter!.attrs.rowspan as number)
    const headBottom = headTop + (this.$headCell.nodeAfter!.attrs.rowspan as number)

    return Math.max(anchorBottom, headBottom) === this.$headCell.node(-1).childCount
  }

  /**
   * True if this selection spans all columns (from left to right of the table).
   */
  isRowSelection(): boolean {
    const table = this.$anchorCell.node(-1)
    const map = TableMap.get(table)
    const tableStart = this.$anchorCell.start(-1)

    const anchorLeft = map.colCount(this.$anchorCell.pos - tableStart)
    const headLeft = map.colCount(this.$headCell.pos - tableStart)
    if (Math.min(anchorLeft, headLeft) > 0) return false

    const anchorRight = anchorLeft + (this.$anchorCell.nodeAfter!.attrs.colspan as number)
    const headRight = headLeft + (this.$headCell.nodeAfter!.attrs.colspan as number)
    return Math.max(anchorRight, headRight) === map.width
  }

  eq(other: Selection): boolean {
    return (
      other instanceof CellSelection &&
      other.$anchorCell.pos === this.$anchorCell.pos &&
      other.$headCell.pos === this.$headCell.pos
    )
  }

  /**
   * Returns the smallest column selection that covers the given anchor
   * and head cell.
   */
  static colSelection($anchorCell: ResolvedPos, $headCell: ResolvedPos = $anchorCell): CellSelection {
    const table = $anchorCell.node(-1)
    const map = TableMap.get(table)
    const tableStart = $anchorCell.start(-1)

    const anchorRect = map.findCell($anchorCell.pos - tableStart)
    const headRect = map.findCell($headCell.pos - tableStart)
    const doc = $anchorCell.node(0)

    if (anchorRect.top <= headRect.top) {
      if (anchorRect.top > 0) $anchorCell = doc.resolve(tableStart + map.map[anchorRect.left])
      if (headRect.bottom < map.height)
        $headCell = doc.resolve(tableStart + map.map[map.width * (map.height - 1) + headRect.right - 1])
    } else {
      if (headRect.top > 0) $headCell = doc.resolve(tableStart + map.map[headRect.left])
      if (anchorRect.bottom < map.height)
        $anchorCell = doc.resolve(tableStart + map.map[map.width * (map.height - 1) + anchorRect.right - 1])
    }
    return new CellSelection($anchorCell, $headCell)
  }

  /**
   * Returns the smallest row selection that covers the given anchor
   * and head cell.
   */
  static rowSelection($anchorCell: ResolvedPos, $headCell: ResolvedPos = $anchorCell): CellSelection {
    const table = $anchorCell.node(-1)
    const map = TableMap.get(table)
    const tableStart = $anchorCell.start(-1)

    const anchorRect = map.findCell($anchorCell.pos - tableStart)
    const headRect = map.findCell($headCell.pos - tableStart)
    const doc = $anchorCell.node(0)

    if (anchorRect.left <= headRect.left) {
      if (anchorRect.left > 0) $anchorCell = doc.resolve(tableStart + map.map[anchorRect.top * map.width])
      if (headRect.right < map.width)
        $headCell = doc.resolve(tableStart + map.map[map.width * (headRect.top + 1) - 1])
    } else {
      if (headRect.left > 0) $headCell = doc.resolve(tableStart + map.map[headRect.top * map.width])
      if (anchorRect.right < map.width)
        $anchorCell = doc.resolve(tableStart + map.map[map.width * (anchorRect.top + 1) - 1])
    }
    return new CellSelection($anchorCell, $headCell)
  }

  toJSON(): CellSelectionJSON {
    return {
      type: 'cell',
      anchor: this.$anchorCell.pos,
      head: this.$headCell.pos,
    }
  }

  static fromJSON(doc: Node, json: CellSelectionJSON): CellSelection {
    return new CellSelection(doc.resolve(json.anchor), doc.resolve(json.head))
  }

  /**
   * Create a cell selection from unresolved positions.
   */
  static create(doc: Node, anchorCell: number, headCell: number = anchorCell): CellSelection {
    return new CellSelection(doc.resolve(anchorCell), doc.resolve(headCell))
  }

  getBookmark(): SelectionBookmark {
    return new CellBookmark(this.$anchorCell.pos, this.$headCell.pos)
  }
}

// Register for JSON deserialization
Selection.jsonID('cell', CellSelection)

/**
 * A bookmark for CellSelection that can survive document changes.
 */
export class CellBookmark implements SelectionBookmark {
  constructor(
    readonly anchor: number,
    readonly head: number,
  ) {}

  map(mapping: Mappable): CellBookmark {
    return new CellBookmark(mapping.map(this.anchor), mapping.map(this.head))
  }

  resolve(doc: Node): CellSelection | Selection {
    const $anchorCell = doc.resolve(this.anchor)
    const $headCell = doc.resolve(this.head)
    if (
      $anchorCell.parent.type.spec.tableRole === 'row' &&
      $headCell.parent.type.spec.tableRole === 'row' &&
      $anchorCell.index() < $anchorCell.parent.childCount &&
      $headCell.index() < $headCell.parent.childCount &&
      inSameTable($anchorCell, $headCell)
    ) {
      return new CellSelection($anchorCell, $headCell)
    }
    return Selection.near($headCell, 1)
  }
}

/**
 * Create decorations that highlight selected cells.
 * Returns a DecorationSet with node decorations that add `selectedCell`
 * CSS class to each cell in the selection, or null if the selection
 * is not a CellSelection.
 */
export function drawCellSelection(state: EditorState): DecorationSet | null {
  if (!(state.selection instanceof CellSelection)) return null
  const decorations: ReturnType<typeof nodeDecoration>[] = []
  state.selection.forEachCell((node, pos) => {
    decorations.push(nodeDecoration(pos, pos + node.nodeSize, { class: 'selectedCell' }))
  })
  return DecorationSet.create(state.doc, decorations)
}

/**
 * Normalize edge-case selections into proper CellSelections.
 *
 * Handles:
 * - NodeSelection of a cell -> CellSelection of that cell
 * - NodeSelection of a row -> row CellSelection
 * - NodeSelection of a table -> full-table CellSelection (unless allowTableNodeSelection)
 * - TextSelection at a cell boundary -> collapsed TextSelection
 * - TextSelection across cell boundaries -> constrained to single cell
 */
export function normalizeSelection(
  state: EditorState,
  tr: TransactionLike | undefined,
  allowTableNodeSelection: boolean,
): TransactionLike | undefined {
  const sel = (tr || state).selection
  const doc = (tr || state).doc
  let normalize: Selection | undefined
  let role: string | undefined

  if (sel instanceof NodeSelection && (role = sel.node.type.spec.tableRole as string)) {
    if (role === 'cell' || role === 'header_cell') {
      normalize = CellSelection.create(doc, sel.from)
    } else if (role === 'row') {
      const $cell = doc.resolve(sel.from + 1)
      normalize = CellSelection.rowSelection($cell, $cell)
    } else if (!allowTableNodeSelection) {
      const map = TableMap.get(sel.node)
      const start = sel.from + 1
      const lastCell = start + map.map[map.width * map.height - 1]
      normalize = CellSelection.create(doc, start + 1, lastCell)
    }
  } else if (sel instanceof TextSelection && isCellBoundarySelection(sel)) {
    normalize = TextSelection.create(doc, sel.from)
  } else if (sel instanceof TextSelection && isTextSelectionAcrossCells(sel)) {
    normalize = TextSelection.create(doc, sel.$from.start(), sel.$from.end())
  }

  if (normalize) {
    ;(tr || (tr = state.tr())).setSelection(normalize)
  }
  return tr
}

/**
 * Check if a text selection sits at the boundary between cells
 * (e.g., at the end of one cell and start of the next).
 */
function isCellBoundarySelection({ $from, $to }: TextSelection): boolean {
  if ($from.pos === $to.pos || $from.pos < $to.pos - 6) return false
  let afterFrom = $from.pos
  let depth = $from.depth
  for (; depth >= 0; depth--, afterFrom++) {
    if ($from.after(depth + 1) < $from.end(depth)) break
  }
  let beforeTo = $to.pos
  for (let d = $to.depth; d >= 0; d--, beforeTo--) {
    if ($to.before(d + 1) > $to.start(d)) break
  }
  return afterFrom === beforeTo && /row|table/.test($from.node(depth).type.spec.tableRole as string)
}

/**
 * Check if a text selection spans across cell boundaries.
 */
function isTextSelectionAcrossCells({ $from, $to }: TextSelection): boolean {
  let fromCellBoundaryNode: Node | undefined
  let toCellBoundaryNode: Node | undefined

  for (let i = $from.depth; i > 0; i--) {
    const node = $from.node(i)
    if (node.type.spec.tableRole === 'cell' || node.type.spec.tableRole === 'header_cell') {
      fromCellBoundaryNode = node
      break
    }
  }

  for (let i = $to.depth; i > 0; i--) {
    const node = $to.node(i)
    if (node.type.spec.tableRole === 'cell' || node.type.spec.tableRole === 'header_cell') {
      toCellBoundaryNode = node
      break
    }
  }

  return fromCellBoundaryNode !== toCellBoundaryNode && $to.parentOffset === 0
}

// We use a minimal transaction-like interface to avoid importing
// the actual Transaction class (which would cause circular deps).
// This matches the interface used in selection.ts.
interface TransactionLike {
  steps: unknown[]
  mapping: { slice(from: number): Mappable; map(pos: number, assoc?: number): number }
  doc: Node
  selection: Selection
  replace(from: number, to: number, slice?: Slice): TransactionLike
  replaceWith(from: number, to: number, content: Fragment | Node): TransactionLike
  delete(from: number, to: number): TransactionLike
  setSelection(selection: Selection): TransactionLike
}
