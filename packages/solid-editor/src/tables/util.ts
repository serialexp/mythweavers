/**
 * Table utility functions.
 *
 * Helper functions for working with tables: finding cells around positions,
 * checking if a position is inside a table, navigating between cells, and
 * manipulating cell colspan/colwidth attributes.
 *
 * Ported from prosemirror-tables with minimal changes.
 */

import type { Node, ResolvedPos } from '../model'
import type { EditorState } from '../state'
import { PluginKey } from '../state/plugin'
import type { CellSelection } from './cellselection'
import { tableNodeTypes } from './schema'
import type { Rect } from './tablemap'
import { TableMap } from './tablemap'

/** Mutable attributes record for building DOM attrs. */
export type MutableAttrs = Record<string, unknown>

/** Cell attributes relevant to table operations. */
export interface CellAttrs {
  colspan: number
  rowspan: number
  colwidth: number[] | null
}

/**
 * Plugin key for the table editing plugin's state.
 * The state stores the anchor cell position during mouse-drag cell selection.
 */
export const tableEditingKey = new PluginKey<number>('selectingCells')

/**
 * Find the resolved position of the cell around `$pos`, if any.
 * Walks up the tree looking for a row node and returns the position
 * just before the cell containing `$pos`.
 */
export function cellAround($pos: ResolvedPos): ResolvedPos | null {
  for (let d = $pos.depth - 1; d > 0; d--) {
    if ($pos.node(d).type.spec.tableRole === 'row') {
      return $pos.node(0).resolve($pos.before(d + 1))
    }
  }
  return null
}

/**
 * Find the cell node wrapping the given resolved position.
 */
export function cellWrapping($pos: ResolvedPos): Node | null {
  for (let d = $pos.depth; d > 0; d--) {
    const role = $pos.node(d).type.spec.tableRole
    if (role === 'cell' || role === 'header_cell') return $pos.node(d)
  }
  return null
}

/**
 * Check whether the selection is inside a table.
 */
export function isInTable(state: EditorState): boolean {
  const $head = state.selection.$head
  for (let d = $head.depth; d > 0; d--) {
    if ($head.node(d).type.spec.tableRole === 'row') return true
  }
  return false
}

/**
 * Get the resolved position of the "selected cell" in the state.
 * Works with CellSelection (returns the anchor/head cell depending on
 * position order) and NodeSelection (if a cell is selected), and
 * falls back to searching around the cursor.
 */
export function selectionCell(state: EditorState): ResolvedPos {
  const sel = state.selection as CellSelection & { node?: Node; $anchor: ResolvedPos }
  if ('$anchorCell' in sel && sel.$anchorCell) {
    return sel.$anchorCell.pos > sel.$headCell.pos ? sel.$anchorCell : sel.$headCell
  } else if ('node' in sel && sel.node && sel.node.type.spec.tableRole === 'cell') {
    return sel.$anchor
  }
  const $cell = cellAround(sel.$head) || cellNear(sel.$head)
  if ($cell) return $cell
  throw new RangeError(`No cell found around position ${sel.head}`)
}

/**
 * Find the nearest cell to a resolved position by walking forward then backward.
 */
export function cellNear($pos: ResolvedPos): ResolvedPos | undefined {
  for (let after = $pos.nodeAfter, pos = $pos.pos; after; after = after.firstChild, pos++) {
    const role = after.type.spec.tableRole
    if (role === 'cell' || role === 'header_cell') return $pos.doc.resolve(pos)
  }
  for (let before = $pos.nodeBefore, pos = $pos.pos; before; before = before.lastChild, pos--) {
    const role = before.type.spec.tableRole
    if (role === 'cell' || role === 'header_cell') return $pos.doc.resolve(pos - before.nodeSize)
  }
  return undefined
}

/**
 * Check whether a resolved position points directly at a cell
 * (i.e., its parent is a row and there's a node after it).
 */
export function pointsAtCell($pos: ResolvedPos): boolean {
  return $pos.parent.type.spec.tableRole === 'row' && !!$pos.nodeAfter
}

/**
 * Move a resolved position forward past the current cell.
 */
export function moveCellForward($pos: ResolvedPos): ResolvedPos {
  return $pos.node(0).resolve($pos.pos + $pos.nodeAfter!.nodeSize)
}

/**
 * Check whether two cell positions are in the same table.
 */
export function inSameTable($cellA: ResolvedPos, $cellB: ResolvedPos): boolean {
  return $cellA.depth === $cellB.depth && $cellA.pos >= $cellB.start(-1) && $cellA.pos <= $cellB.end(-1)
}

/**
 * Find the cell rect (in table grid coordinates) for a cell at the given resolved position.
 */
export function findCell($pos: ResolvedPos): Rect {
  return TableMap.get($pos.node(-1)).findCell($pos.pos - $pos.start(-1))
}

/**
 * Get the column index of a cell at the given resolved position.
 */
export function colCount($pos: ResolvedPos): number {
  return TableMap.get($pos.node(-1)).colCount($pos.pos - $pos.start(-1))
}

/**
 * Find the next cell in a given direction from the given cell position.
 */
export function nextCell($pos: ResolvedPos, axis: 'horiz' | 'vert', dir: number): ResolvedPos | null {
  const table = $pos.node(-1)
  const map = TableMap.get(table)
  const tableStart = $pos.start(-1)

  const moved = map.nextCell($pos.pos - tableStart, axis, dir)
  return moved == null ? null : $pos.node(0).resolve(tableStart + moved)
}

/**
 * Remove `n` columns from a cell's colspan, adjusting colwidth accordingly.
 */
export function removeColSpan(attrs: CellAttrs, pos: number, n = 1): CellAttrs {
  const result: CellAttrs = { ...attrs, colspan: attrs.colspan - n }
  if (result.colwidth) {
    result.colwidth = result.colwidth.slice()
    result.colwidth.splice(pos, n)
    if (!result.colwidth.some((w) => w > 0)) result.colwidth = null
  }
  return result
}

/**
 * Add `n` columns to a cell's colspan, adjusting colwidth accordingly.
 */
export function addColSpan(attrs: CellAttrs, pos: number, n = 1): CellAttrs {
  const result: CellAttrs = { ...attrs, colspan: attrs.colspan + n }
  if (result.colwidth) {
    result.colwidth = result.colwidth.slice()
    for (let i = 0; i < n; i++) result.colwidth.splice(pos, 0, 0)
  }
  return result as CellAttrs
}

/**
 * Check whether an entire column consists of header cells.
 */
export function columnIsHeader(map: TableMap, table: Node, col: number): boolean {
  const headerCell = tableNodeTypes(table.type.schema).header_cell
  for (let row = 0; row < map.height; row++) {
    if (table.nodeAt(map.map[col + row * map.width])!.type !== headerCell) return false
  }
  return true
}
