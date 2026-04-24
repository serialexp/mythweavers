/**
 * Table input handling.
 *
 * Provides keyboard handlers for arrow-key navigation across table cell
 * boundaries, shift-arrow handlers for extending CellSelection, triple-click
 * to select a cell, and mouse drag to create CellSelection.
 */

import type { ResolvedPos } from '../model'
import type { EditorState, Transaction } from '../state'
import { Selection, TextSelection } from '../state'
import { CellSelection } from './cellselection'
import {
  cellAround,
  inSameTable,
  nextCell,
  tableEditingKey,
} from './util'

type Axis = 'horiz' | 'vert'

/** @public */
export type Direction = -1 | 1

/** The view interface needed by table input handlers. */
export interface TableInputView {
  state: () => EditorState
  dispatch: (tr: Transaction) => void
  dom: () => HTMLElement | null
  endOfTextblock: (dir: 'up' | 'down' | 'left' | 'right') => boolean
  posAtCoords: (coords: { left: number; top: number }) => { pos: number; inside: number } | null
  root: Document | ShadowRoot
}

// ── Helpers ────────────────────────────────────────────────────────────

function maybeSetSelection(
  state: EditorState,
  dispatch: undefined | ((tr: Transaction) => void),
  selection: Selection,
): boolean {
  if (selection.eq(state.selection)) return false
  if (dispatch) dispatch(state.tr().setSelection(selection).scrollIntoView())
  return true
}

// ── Arrow keys ─────────────────────────────────────────────────────────

/**
 * Create a command that handles arrow key navigation in tables.
 * When the cursor is at the edge of a cell (determined by
 * `endOfTextblock`), it jumps to the adjacent cell.
 *
 * For horizontal arrows: moves to the next/previous position.
 * For vertical arrows: moves to the cell above/below.
 */
export function arrow(axis: Axis, dir: Direction): (state: EditorState, dispatch?: (tr: Transaction) => void, view?: TableInputView) => boolean {
  return (state, dispatch, view) => {
    if (!view) return false
    const sel = state.selection
    if (sel instanceof CellSelection) {
      return maybeSetSelection(
        state,
        dispatch,
        // CellSelection is structurally compatible with Selection at runtime;
        // TS disagrees due to TransactionLike vs Transaction in replace().
        Selection.near(sel.$headCell, dir) as Selection,
      )
    }
    if (axis !== 'horiz' && !sel.empty) return false
    const end = atEndOfCell(view, axis, dir)
    if (end == null) return false
    if (axis === 'horiz') {
      return maybeSetSelection(
        state,
        dispatch,
        Selection.near(state.doc.resolve(sel.head + dir), dir) as Selection,
      )
    }
    // vertical
    const $cell = state.doc.resolve(end)
    const $next = nextCell($cell, axis, dir)
    let newSel: Selection
    if ($next) {
      newSel = Selection.near($next, 1) as Selection
    } else if (dir < 0) {
      newSel = Selection.near(state.doc.resolve($cell.before(-1)), -1) as Selection
    } else {
      newSel = Selection.near(state.doc.resolve($cell.after(-1)), 1) as Selection
    }
    return maybeSetSelection(state, dispatch, newSel)
  }
}

/**
 * Create a command that handles shift-arrow key navigation in tables.
 * Extends or creates a CellSelection in the given direction.
 */
export function shiftArrow(axis: Axis, dir: Direction): (state: EditorState, dispatch?: (tr: Transaction) => void, view?: TableInputView) => boolean {
  return (state, dispatch, view) => {
    if (!view) return false
    const sel = state.selection
    let cellSel: CellSelection
    if (sel instanceof CellSelection) {
      cellSel = sel
    } else {
      const end = atEndOfCell(view, axis, dir)
      if (end == null) return false
      cellSel = new CellSelection(state.doc.resolve(end))
    }

    const $head = nextCell(cellSel.$headCell, axis, dir)
    if (!$head) return false
    return maybeSetSelection(
      state,
      dispatch,
      new CellSelection(cellSel.$anchorCell, $head) as unknown as Selection,
    )
  }
}

// ── Triple click ───────────────────────────────────────────────────────

/**
 * Handle triple-click inside a table cell: selects the entire cell.
 */
export function handleTripleClick(view: TableInputView, pos: number): boolean {
  const doc = view.state().doc
  const $cell = cellAround(doc.resolve(pos))
  if (!$cell) return false
  view.dispatch(view.state().tr().setSelection(new CellSelection($cell) as unknown as Selection))
  return true
}

// ── Mouse drag cell selection ──────────────────────────────────────────

/**
 * Handle mousedown on the editor. Initiates cell-drag selection
 * when the user clicks inside a table cell and drags.
 *
 * This should be called from the `handleDOMEvents.mousedown` plugin
 * prop. It returns `true` if it handled the event (preventing default).
 */
export function handleMouseDown(view: TableInputView, startEvent: MouseEvent): boolean {
  // Only handle left mouse button
  if (startEvent.button !== 0) return false
  if (startEvent.ctrlKey || startEvent.metaKey) return false

  const startDOMCell = domInCell(view, startEvent.target as Node)
  let $anchor: ResolvedPos | undefined

  if (startEvent.shiftKey && view.state().selection instanceof CellSelection) {
    // Extending an existing cell selection
    setCellSelection((view.state().selection as unknown as CellSelection).$anchorCell, startEvent)
    startEvent.preventDefault()
    return true
  }
  if (
    startEvent.shiftKey &&
    startDOMCell &&
    ($anchor = cellAround(view.state().selection.$anchor) ?? undefined) != null &&
    cellUnderMouse(view, startEvent)?.pos !== $anchor.pos
  ) {
    // Shift-click in a different cell — start a cell selection
    setCellSelection($anchor, startEvent)
    startEvent.preventDefault()
    return true
  }
  if (!startDOMCell) {
    // Not in a cell, let the default behavior happen
    return false
  }

  // Set up drag-to-select listeners
  const root = view.root

  function setCellSelection($anchor: ResolvedPos, event: MouseEvent): void {
    let $head = cellUnderMouse(view, event)
    const starting = tableEditingKey.getState(view.state()) == null
    if (!$head || !inSameTable($anchor, $head)) {
      if (starting) $head = $anchor
      else return
    }
    const selection = new CellSelection($anchor, $head) as unknown as Selection
    if (starting || !view.state().selection.eq(selection)) {
      const tr = view.state().tr().setSelection(selection)
      if (starting) tr.setMeta(tableEditingKey, $anchor.pos)
      view.dispatch(tr)
    }
  }

  function stop(): void {
    root.removeEventListener('mouseup', stop)
    root.removeEventListener('dragstart', stop)
    root.removeEventListener('mousemove', move)
    if (tableEditingKey.getState(view.state()) != null) {
      view.dispatch(view.state().tr().setMeta(tableEditingKey, -1))
    }
  }

  function move(_event: Event): void {
    const event = _event as MouseEvent
    const anchor = tableEditingKey.getState(view.state())
    let $anchor: ResolvedPos | undefined
    if (anchor != null) {
      // Continuing an existing cross-cell selection
      $anchor = view.state().doc.resolve(anchor)
    } else if (domInCell(view, event.target as Node) !== startDOMCell) {
      // Moving out of the initial cell — start a new cell selection
      $anchor = cellUnderMouse(view, startEvent) ?? undefined
      if (!$anchor) return stop()
    }
    if ($anchor) setCellSelection($anchor, event)
  }

  root.addEventListener('mouseup', stop)
  root.addEventListener('dragstart', stop)
  root.addEventListener('mousemove', move)

  // Don't prevent default — we still want the initial click to place the
  // cursor normally. Cell selection only starts on drag.
  return false
}

// ── Internals ──────────────────────────────────────────────────────────

/**
 * Check whether the cursor is at the end of a cell in the given
 * direction, so that further motion would move out of the cell.
 */
function atEndOfCell(view: TableInputView, axis: Axis, dir: number): number | null {
  if (!(view.state().selection instanceof TextSelection)) return null
  const { $head } = view.state().selection
  for (let d = $head.depth - 1; d >= 0; d--) {
    const parent = $head.node(d)
    const index = dir < 0 ? $head.index(d) : $head.indexAfter(d)
    if (index !== (dir < 0 ? 0 : parent.childCount)) return null
    if (
      parent.type.spec.tableRole === 'cell' ||
      parent.type.spec.tableRole === 'header_cell'
    ) {
      const cellPos = $head.before(d)
      const dirStr: 'up' | 'down' | 'left' | 'right' =
        axis === 'vert' ? (dir > 0 ? 'down' : 'up') : (dir > 0 ? 'right' : 'left')
      return view.endOfTextblock(dirStr) ? cellPos : null
    }
  }
  return null
}

/**
 * Walk from a DOM node up to the editor root, checking if we're
 * inside a TD or TH element.
 */
function domInCell(view: TableInputView, dom: Node | null): Node | null {
  const editorDom = view.dom()
  for (; dom && dom !== editorDom; dom = dom.parentNode) {
    if (dom.nodeName === 'TD' || dom.nodeName === 'TH') {
      return dom
    }
  }
  return null
}

/**
 * Find the cell that the mouse event is hovering over.
 */
function cellUnderMouse(view: TableInputView, event: MouseEvent): ResolvedPos | null {
  const mousePos = view.posAtCoords({ left: event.clientX, top: event.clientY })
  if (!mousePos) return null
  const { inside, pos } = mousePos
  const doc = view.state().doc
  return (
    (inside >= 0 && cellAround(doc.resolve(inside))) ||
    cellAround(doc.resolve(pos))
  )
}
