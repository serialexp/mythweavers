/**
 * Table support for solidjs-editor.
 *
 * Provides schema definitions, table map computation, cell selection,
 * table view components, and utility functions for working with tables.
 */

// Schema
export { tableNodes, tableNodeTypes } from './schema'
export type { TableNodesOptions, TableNodes, TableRole } from './schema'

// TableMap
export { TableMap } from './tablemap'
export type { Rect, Problem, ColWidths } from './tablemap'

// CellSelection
export { CellSelection, CellBookmark, drawCellSelection, normalizeSelection } from './cellselection'
export type { CellSelectionJSON } from './cellselection'

// Utilities
export {
  cellAround,
  cellWrapping,
  isInTable,
  selectionCell,
  cellNear,
  pointsAtCell,
  moveCellForward,
  inSameTable,
  findCell,
  colCount,
  nextCell,
  removeColSpan,
  addColSpan,
  columnIsHeader,
  tableEditingKey,
} from './util'
export type { CellAttrs, MutableAttrs } from './util'

// Commands
export {
  selectedRect,
  addColumn,
  addColumnBefore,
  addColumnAfter,
  removeColumn,
  deleteColumn,
  addRow,
  addRowBefore,
  addRowAfter,
  removeRow,
  deleteRow,
  mergeCells,
  splitCell,
  splitCellWithType,
  setCellAttr,
  toggleHeader,
  toggleHeaderRow,
  toggleHeaderColumn,
  toggleHeaderCell,
  goToNextCell,
  deleteTable,
  deleteCellSelection,
  insertTable,
  rowIsHeader,
} from './commands'
export type { Command, TableRect, ToggleHeaderType, GetCellTypeOptions } from './commands'

// Table validation and repair
export { validateTables, validateAllTables, fixTables, fixTable, fixTablesKey } from './fixtables'

// Input handling
export { arrow, shiftArrow, handleTripleClick, handleMouseDown } from './input'
export type { Direction, TableInputView } from './input'

// Plugin
export { tableEditing, tableEditingPluginKey } from './plugin'
export type { TableEditingOptions } from './plugin'

// View components
export { TableNodeView, TableRowView, TableCellView, TableHeaderView, tableNodeViews } from './TableView'
