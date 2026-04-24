/**
 * Table commands.
 *
 * All commands follow the (state, dispatch?) => boolean pattern.
 * When called without dispatch, they return whether the command is applicable.
 * When called with dispatch, they execute the command.
 *
 * Ported from prosemirror-tables/commands.ts.
 * Adapted for solidjs-editor: state.tr() instead of state.tr.
 */

import { Fragment, Node, Slice } from '../model'
import type { NodeType, ResolvedPos } from '../model'
import type { EditorState } from '../state/state'
import type { Transaction } from '../state/transaction'
import { TextSelection } from '../state/selection'
import { CellSelection } from './cellselection'
import type { TableRole } from './schema'
import { tableNodeTypes } from './schema'
import type { Rect } from './tablemap'
import { TableMap } from './tablemap'
import type { CellAttrs } from './util'
import {
  addColSpan,
  cellAround,
  cellWrapping,
  columnIsHeader,
  isInTable,
  moveCellForward,
  removeColSpan,
  selectionCell,
} from './util'

// ── Types ──────────────────────────────────────────────────────────────

/** A command function. */
export type Command = (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean

/** A table rectangle augmented with table metadata. */
export type TableRect = Rect & {
  tableStart: number
  map: TableMap
  table: Node
}

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Get the selected rectangle in a table, if any.
 * Adds the table map, table node, and table start offset.
 */
export function selectedRect(state: EditorState): TableRect {
  const sel = state.selection
  const $pos = selectionCell(state)
  const table = $pos.node(-1)
  const tableStart = $pos.start(-1)
  const map = TableMap.get(table)
  const rect =
    sel instanceof CellSelection
      ? map.rectBetween(sel.$anchorCell.pos - tableStart, sel.$headCell.pos - tableStart)
      : map.findCell($pos.pos - tableStart)
  return { ...rect, tableStart, map, table }
}

/** Check whether a cell is empty (single empty textblock). */
function isEmpty(cell: Node): boolean {
  const c = cell.content
  return c.childCount === 1 && c.child(0).isTextblock && c.child(0).childCount === 0
}

/** Check whether a row consists entirely of header cells. */
export function rowIsHeader(map: TableMap, table: Node, row: number): boolean {
  const headerCell = tableNodeTypes(table.type.schema).header_cell
  for (let col = 0; col < map.width; col++) {
    if (table.nodeAt(map.map[col + row * map.width])?.type !== headerCell) return false
  }
  return true
}

/** Check whether cells overlap the edges of a rectangle. */
function cellsOverlapRectangle({ width, height, map }: TableMap, rect: Rect): boolean {
  let indexTop = rect.top * width + rect.left
  let indexLeft = indexTop
  let indexBottom = (rect.bottom - 1) * width + rect.left
  let indexRight = indexTop + (rect.right - rect.left - 1)
  for (let i = rect.top; i < rect.bottom; i++) {
    if ((rect.left > 0 && map[indexLeft] === map[indexLeft - 1]) || (rect.right < width && map[indexRight] === map[indexRight + 1]))
      return true
    indexLeft += width
    indexRight += width
  }
  for (let i = rect.left; i < rect.right; i++) {
    if ((rect.top > 0 && map[indexTop] === map[indexTop - width]) || (rect.bottom < height && map[indexBottom] === map[indexBottom + width]))
      return true
    indexTop++
    indexBottom++
  }
  return false
}

// ── Column commands ────────────────────────────────────────────────────

/**
 * Add a column at the given position in a table.
 */
export function addColumn(tr: Transaction, { map, tableStart, table }: TableRect, col: number): Transaction {
  let refColumn: number | null = col > 0 ? -1 : 0
  if (columnIsHeader(map, table, col + refColumn)) {
    refColumn = col === 0 || col === map.width ? null : 0
  }

  for (let row = 0; row < map.height; row++) {
    const index = row * map.width + col
    // If this position falls inside a col-spanning cell
    if (col > 0 && col < map.width && map.map[index - 1] === map.map[index]) {
      const pos = map.map[index]
      const cell = table.nodeAt(pos)!
      tr.setNodeMarkup(tr.mapping.map(tableStart + pos), null, addColSpan(cell.attrs as CellAttrs, col - map.colCount(pos)))
      row += (cell.attrs.rowspan as number) - 1
    } else {
      const type =
        refColumn == null
          ? tableNodeTypes(table.type.schema).cell
          : table.nodeAt(map.map[index + refColumn])!.type
      const pos = map.positionAt(row, col, table)
      tr.insert(tr.mapping.map(tableStart + pos), type.createAndFill()!)
    }
  }
  return tr
}

/** Command to add a column before the column with the selection. */
export function addColumnBefore(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  if (!isInTable(state)) return false
  if (dispatch) {
    const rect = selectedRect(state)
    dispatch(addColumn(state.tr(), rect, rect.left))
  }
  return true
}

/** Command to add a column after the column with the selection. */
export function addColumnAfter(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  if (!isInTable(state)) return false
  if (dispatch) {
    const rect = selectedRect(state)
    dispatch(addColumn(state.tr(), rect, rect.right))
  }
  return true
}

/** Remove a column at the given position from a table. */
export function removeColumn(tr: Transaction, { map, table, tableStart }: TableRect, col: number): void {
  const mapStart = tr.mapping.maps.length
  for (let row = 0; row < map.height; ) {
    const index = row * map.width + col
    const pos = map.map[index]
    const cell = table.nodeAt(pos)!
    const attrs = cell.attrs as CellAttrs
    // If this is part of a col-spanning cell
    if ((col > 0 && map.map[index - 1] === pos) || (col < map.width - 1 && map.map[index + 1] === pos)) {
      tr.setNodeMarkup(tr.mapping.slice(mapStart).map(tableStart + pos), null, removeColSpan(attrs, col - map.colCount(pos)))
    } else {
      const start = tr.mapping.slice(mapStart).map(tableStart + pos)
      tr.delete(start, start + cell.nodeSize)
    }
    row += attrs.rowspan
  }
}

/** Command that removes the selected columns from a table. */
export function deleteColumn(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  if (!isInTable(state)) return false
  if (dispatch) {
    const rect = selectedRect(state)
    const tr = state.tr()
    if (rect.left === 0 && rect.right === rect.map.width) return false
    for (let i = rect.right - 1; ; i--) {
      removeColumn(tr, rect, i)
      if (i === rect.left) break
      const table = rect.tableStart ? tr.doc.nodeAt(rect.tableStart - 1) : tr.doc
      if (!table) throw new RangeError('No table found')
      rect.table = table
      rect.map = TableMap.get(table)
    }
    dispatch(tr)
  }
  return true
}

// ── Row commands ───────────────────────────────────────────────────────

/** Add a row at the given position in a table. */
export function addRow(tr: Transaction, { map, tableStart, table }: TableRect, row: number): Transaction {
  let rowPos = tableStart
  for (let i = 0; i < row; i++) rowPos += table.child(i).nodeSize
  const cells: Node[] = []
  let refRow: number | null = row > 0 ? -1 : 0
  if (rowIsHeader(map, table, row + refRow)) {
    refRow = row === 0 || row === map.height ? null : 0
  }
  for (let col = 0, index = map.width * row; col < map.width; col++, index++) {
    // Covered by a rowspan cell
    if (row > 0 && row < map.height && map.map[index] === map.map[index - map.width]) {
      const pos = map.map[index]
      const attrs = table.nodeAt(pos)!.attrs
      tr.setNodeMarkup(tableStart + pos, null, {
        ...attrs,
        rowspan: (attrs.rowspan as number) + 1,
      })
      col += (attrs.colspan as number) - 1
    } else {
      const type =
        refRow == null
          ? tableNodeTypes(table.type.schema).cell
          : table.nodeAt(map.map[index + refRow * map.width])?.type
      const node = type?.createAndFill()
      if (node) cells.push(node)
    }
  }
  tr.insert(rowPos, tableNodeTypes(table.type.schema).row.create(null, cells))
  return tr
}

/** Add a table row before the selection. */
export function addRowBefore(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  if (!isInTable(state)) return false
  if (dispatch) {
    const rect = selectedRect(state)
    dispatch(addRow(state.tr(), rect, rect.top))
  }
  return true
}

/** Add a table row after the selection. */
export function addRowAfter(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  if (!isInTable(state)) return false
  if (dispatch) {
    const rect = selectedRect(state)
    dispatch(addRow(state.tr(), rect, rect.bottom))
  }
  return true
}

/** Remove a row at the given position from a table. */
export function removeRow(tr: Transaction, { map, table, tableStart }: TableRect, row: number): void {
  let rowPos = 0
  for (let i = 0; i < row; i++) rowPos += table.child(i).nodeSize
  const nextRow = rowPos + table.child(row).nodeSize

  const mapFrom = tr.mapping.maps.length
  tr.delete(rowPos + tableStart, nextRow + tableStart)

  const seen = new Set<number>()
  for (let col = 0, index = row * map.width; col < map.width; col++, index++) {
    const pos = map.map[index]
    if (seen.has(pos)) continue
    seen.add(pos)

    if (row > 0 && pos === map.map[index - map.width]) {
      // Cell starts in the row above — reduce rowspan
      const attrs = table.nodeAt(pos)!.attrs as CellAttrs
      tr.setNodeMarkup(tr.mapping.slice(mapFrom).map(pos + tableStart), null, {
        ...attrs,
        rowspan: attrs.rowspan - 1,
      })
      col += attrs.colspan - 1
    } else if (row < map.height && pos === map.map[index + map.width]) {
      // Cell continues in the row below — move it down
      const cell = table.nodeAt(pos)!
      const attrs = cell.attrs as CellAttrs
      const copy = cell.type.create({ ...attrs, rowspan: attrs.rowspan - 1 }, cell.content)
      const newPos = map.positionAt(row + 1, col, table)
      tr.insert(tr.mapping.slice(mapFrom).map(tableStart + newPos), copy)
      col += attrs.colspan - 1
    }
  }
}

/** Remove the selected rows from a table. */
export function deleteRow(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  if (!isInTable(state)) return false
  if (dispatch) {
    const rect = selectedRect(state)
    const tr = state.tr()
    if (rect.top === 0 && rect.bottom === rect.map.height) return false
    for (let i = rect.bottom - 1; ; i--) {
      removeRow(tr, rect, i)
      if (i === rect.top) break
      const table = rect.tableStart ? tr.doc.nodeAt(rect.tableStart - 1) : tr.doc
      if (!table) throw new RangeError('No table found')
      rect.table = table
      rect.map = TableMap.get(rect.table)
    }
    dispatch(tr)
  }
  return true
}

// ── Merge / Split ──────────────────────────────────────────────────────

/**
 * Merge the selected cells into a single cell. Only available when
 * the selected cells' outline forms a rectangle.
 */
export function mergeCells(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  const sel = state.selection
  if (!(sel instanceof CellSelection) || sel.$anchorCell.pos === sel.$headCell.pos) return false
  const rect = selectedRect(state)
  const { map } = rect
  if (cellsOverlapRectangle(map, rect)) return false
  if (dispatch) {
    const tr = state.tr()
    const seen: Record<number, boolean> = {}
    let content = Fragment.empty
    let mergedPos: number | undefined
    let mergedCell: Node | undefined
    for (let row = rect.top; row < rect.bottom; row++) {
      for (let col = rect.left; col < rect.right; col++) {
        const cellPos = map.map[row * map.width + col]
        const cell = rect.table.nodeAt(cellPos)
        if (seen[cellPos] || !cell) continue
        seen[cellPos] = true
        if (mergedPos == null) {
          mergedPos = cellPos
          mergedCell = cell
        } else {
          if (!isEmpty(cell)) content = content.append(cell.content)
          const mapped = tr.mapping.map(cellPos + rect.tableStart)
          tr.delete(mapped, mapped + cell.nodeSize)
        }
      }
    }
    if (mergedPos == null || mergedCell == null) return true

    tr.setNodeMarkup(mergedPos + rect.tableStart, null, {
      ...addColSpan(mergedCell.attrs as CellAttrs, mergedCell.attrs.colspan as number, rect.right - rect.left - (mergedCell.attrs.colspan as number)),
      rowspan: rect.bottom - rect.top,
    })
    if (content.size > 0) {
      const end = mergedPos + 1 + mergedCell.content.size
      const start = isEmpty(mergedCell) ? mergedPos + 1 : end
      tr.replaceWith(start + rect.tableStart, end + rect.tableStart, content)
    }
    tr.setSelection(new CellSelection(tr.doc.resolve(mergedPos + rect.tableStart)))
    dispatch(tr)
  }
  return true
}

/** Options for getCellType in splitCellWithType. */
export interface GetCellTypeOptions {
  node: Node
  row: number
  col: number
}

/**
 * Split a selected cell whose rowspan or colspan is greater than one
 * into smaller cells. Uses the first cell type for new cells.
 */
export function splitCell(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  const nodeTypes = tableNodeTypes(state.schema)
  return splitCellWithType(({ node }) => {
    return nodeTypes[node.type.spec.tableRole as TableRole]
  })(state, dispatch)
}

/**
 * Split a selected cell with a custom function to determine cell types.
 */
export function splitCellWithType(getCellType: (options: GetCellTypeOptions) => NodeType): Command {
  return (state, dispatch) => {
    const sel = state.selection
    let cellNode: Node | null | undefined
    let cellPos: number | undefined
    if (!(sel instanceof CellSelection)) {
      cellNode = cellWrapping(sel.$from)
      if (!cellNode) return false
      cellPos = cellAround(sel.$from)?.pos
    } else {
      if (sel.$anchorCell.pos !== sel.$headCell.pos) return false
      cellNode = sel.$anchorCell.nodeAfter
      cellPos = sel.$anchorCell.pos
    }
    if (cellNode == null || cellPos == null) return false
    if ((cellNode.attrs.colspan as number) === 1 && (cellNode.attrs.rowspan as number) === 1) return false
    if (dispatch) {
      let baseAttrs = cellNode.attrs
      const attrs: Record<string, unknown>[] = []
      const colwidth = baseAttrs.colwidth as number[] | null
      if ((baseAttrs.rowspan as number) > 1) baseAttrs = { ...baseAttrs, rowspan: 1 }
      if ((baseAttrs.colspan as number) > 1) baseAttrs = { ...baseAttrs, colspan: 1 }
      const rect = selectedRect(state)
      const tr = state.tr()
      for (let i = 0; i < rect.right - rect.left; i++) {
        attrs.push(
          colwidth
            ? { ...baseAttrs, colwidth: colwidth[i] ? [colwidth[i]] : null }
            : baseAttrs,
        )
      }
      let lastCell: number | undefined
      for (let row = rect.top; row < rect.bottom; row++) {
        let pos = rect.map.positionAt(row, rect.left, rect.table)
        if (row === rect.top) pos += cellNode.nodeSize
        for (let col = rect.left, i = 0; col < rect.right; col++, i++) {
          if (col === rect.left && row === rect.top) continue
          tr.insert(
            (lastCell = tr.mapping.map(pos + rect.tableStart, 1)),
            getCellType({ node: cellNode, row, col }).createAndFill(attrs[i])!,
          )
        }
      }
      tr.setNodeMarkup(cellPos, getCellType({ node: cellNode, row: rect.top, col: rect.left }), attrs[0])
      if (sel instanceof CellSelection) {
        tr.setSelection(
          new CellSelection(tr.doc.resolve(sel.$anchorCell.pos), lastCell ? tr.doc.resolve(lastCell) : undefined),
        )
      }
      dispatch(tr)
    }
    return true
  }
}

// ── Cell attributes ────────────────────────────────────────────────────

/**
 * Returns a command that sets the given attribute to the given value
 * on selected cells.
 */
export function setCellAttr(name: string, value: unknown): Command {
  return function (state, dispatch) {
    if (!isInTable(state)) return false
    const $cell = selectionCell(state)
    if ($cell.nodeAfter!.attrs[name] === value) return false
    if (dispatch) {
      const tr = state.tr()
      if (state.selection instanceof CellSelection) {
        state.selection.forEachCell((node, pos) => {
          if (node.attrs[name] !== value) {
            tr.setNodeMarkup(pos, null, { ...node.attrs, [name]: value })
          }
        })
      } else {
        tr.setNodeMarkup($cell.pos, null, { ...$cell.nodeAfter!.attrs, [name]: value })
      }
      dispatch(tr)
    }
    return true
  }
}

// ── Header toggle ──────────────────────────────────────────────────────

/** Toggle type for header commands. */
export type ToggleHeaderType = 'column' | 'row' | 'cell'

/**
 * Toggle between row/column header and normal cells.
 * Applies to the first row (for 'row'), first column (for 'column'),
 * or the selected cells (for 'cell').
 */
export function toggleHeader(type: ToggleHeaderType): Command {
  return function (state, dispatch) {
    if (!isInTable(state)) return false
    if (dispatch) {
      const types = tableNodeTypes(state.schema)
      const rect = selectedRect(state)
      const tr = state.tr()
      const cells = rect.map.cellsInRect(
        type === 'column'
          ? { left: rect.left, top: 0, right: rect.right, bottom: rect.map.height }
          : type === 'row'
            ? { left: 0, top: rect.top, right: rect.map.width, bottom: rect.bottom }
            : rect,
      )
      const nodes = cells.map((pos) => rect.table.nodeAt(pos)!)
      // Remove headers if any exist
      for (let i = 0; i < cells.length; i++) {
        if (nodes[i].type === types.header_cell) {
          tr.setNodeMarkup(rect.tableStart + cells[i], types.cell, nodes[i].attrs)
        }
      }
      // If no headers were removed, add them instead
      if (tr.steps.length === 0) {
        for (let i = 0; i < cells.length; i++) {
          tr.setNodeMarkup(rect.tableStart + cells[i], types.header_cell, nodes[i].attrs)
        }
      }
      dispatch(tr)
    }
    return true
  }
}

/** Toggles whether the selected row contains header cells. */
export const toggleHeaderRow: Command = toggleHeader('row')

/** Toggles whether the selected column contains header cells. */
export const toggleHeaderColumn: Command = toggleHeader('column')

/** Toggles whether the selected cells are header cells. */
export const toggleHeaderCell: Command = toggleHeader('cell')

// ── Navigation ─────────────────────────────────────────────────────────

/** Find the next cell in a given direction from a cell position. */
function findNextCell($cell: ResolvedPos, dir: number): number | null {
  if (dir < 0) {
    const before = $cell.nodeBefore
    if (before) return $cell.pos - before.nodeSize
    for (let row = $cell.index(-1) - 1, rowEnd = $cell.before(); row >= 0; row--) {
      const rowNode = $cell.node(-1).child(row)
      const lastChild = rowNode.lastChild
      if (lastChild) return rowEnd - 1 - lastChild.nodeSize
      rowEnd -= rowNode.nodeSize
    }
  } else {
    if ($cell.index() < $cell.parent.childCount - 1) {
      return $cell.pos + $cell.nodeAfter!.nodeSize
    }
    const table = $cell.node(-1)
    for (let row = $cell.indexAfter(-1), rowStart = $cell.after(); row < table.childCount; row++) {
      const rowNode = table.child(row)
      if (rowNode.childCount) return rowStart + 1
      rowStart += rowNode.nodeSize
    }
  }
  return null
}

/**
 * Returns a command for selecting the next (direction=1) or previous
 * (direction=-1) cell in a table.
 */
export function goToNextCell(direction: number): Command {
  return function (state, dispatch) {
    if (!isInTable(state)) return false
    const cell = findNextCell(selectionCell(state), direction)
    if (cell == null) return false
    if (dispatch) {
      const $cell = state.doc.resolve(cell)
      dispatch(state.tr().setSelection(TextSelection.between($cell, moveCellForward($cell))).scrollIntoView())
    }
    return true
  }
}

// ── Table-level commands ───────────────────────────────────────────────

/** Deletes the table around the selection, if any. */
export function deleteTable(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  const $pos = state.selection.$anchor
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d)
    if (node.type.spec.tableRole === 'table') {
      if (dispatch) {
        dispatch(state.tr().delete($pos.before(d), $pos.after(d)).scrollIntoView())
      }
      return true
    }
  }
  return false
}

/** Deletes the content of the selected cells, if they are not empty. */
export function deleteCellSelection(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  const sel = state.selection
  if (!(sel instanceof CellSelection)) return false
  if (dispatch) {
    const tr = state.tr()
    const cellType = tableNodeTypes(state.schema).cell
    const baseContent = cellType.createAndFill()!.content
    sel.forEachCell((cell, pos) => {
      if (!cell.content.eq(baseContent)) {
        // Create fresh content for each cell to ensure unique node IDs
        const freshContent = cellType.createAndFill()!.content
        tr.replace(
          tr.mapping.map(pos + 1),
          tr.mapping.map(pos + cell.nodeSize - 1),
          new Slice(freshContent, 0, 0),
        )
      }
    })
    if (tr.docChanged) dispatch(tr)
  }
  return true
}

// ── Insert table ───────────────────────────────────────────────────────

/**
 * Create a command that inserts a table with the given dimensions.
 * Each cell contains an empty paragraph (via createAndFill).
 */
export function insertTable(rows: number, cols: number, withHeaderRow = false): Command {
  return function (state, dispatch) {
    const types = tableNodeTypes(state.schema)
    if (!types.table || !types.row || !types.cell) return false

    const tableRows: Node[] = []
    for (let r = 0; r < rows; r++) {
      const cells: Node[] = []
      const cellType = withHeaderRow && r === 0 ? types.header_cell : types.cell
      for (let c = 0; c < cols; c++) {
        const cell = cellType.createAndFill()
        if (!cell) return false
        cells.push(cell)
      }
      const row = types.row.create(null, cells)
      tableRows.push(row)
    }
    const tableNode = types.table.create(null, tableRows)

    if (dispatch) {
      const tr = state.tr()
      // Find a valid insertion point for a block node
      const $from = state.selection.$from
      let insertPos: number | undefined
      for (let d = $from.depth; d >= 0; d--) {
        const parent = $from.node(d)
        if (parent.type.contentMatch?.allowsType(types.table)) {
          insertPos = $from.after(d + 1 <= $from.depth ? d + 1 : d)
          break
        }
      }
      if (insertPos == null) {
        // Insert after the current block at the top level
        insertPos = $from.after(1)
      }
      tr.insert(insertPos, tableNode)
      // Move cursor into the first cell
      const resolvedPos = tr.doc.resolve(insertPos + 3) // table > row > cell > paragraph
      tr.setSelection(TextSelection.near(resolvedPos))
      dispatch(tr.scrollIntoView())
    }
    return true
  }
}
