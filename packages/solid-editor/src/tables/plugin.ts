/**
 * Table editing plugin.
 *
 * Combines all table-related input handling into a single plugin:
 * - Arrow key navigation across cell boundaries
 * - Shift-arrow for cell selection extension
 * - Triple-click to select a cell
 * - Mouse drag to create cell selections
 * - Cell selection decorations (highlighted cells)
 * - Selection normalization (constraining invalid cross-cell text selections)
 * - Delete/Backspace on cell selections
 */

import { Plugin, PluginKey } from '../state/plugin'
import type { EditorState, Transaction } from '../state'
import { CellSelection, drawCellSelection, normalizeSelection } from './cellselection'
import { deleteCellSelection } from './commands'
import { tableEditingKey } from './util'
import {
  arrow,
  shiftArrow,
  handleTripleClick as tripleClickHandler,
  handleMouseDown as mouseDownHandler,
  type TableInputView,
} from './input'

/** Plugin key for identifying the table editing plugin. */
export const tableEditingPluginKey = new PluginKey<number | null>('tableEditing')

export interface TableEditingOptions {
  /**
   * When true, allow NodeSelection on table nodes.
   * When false (default), table node selections are normalized to CellSelection.
   */
  allowTableNodeSelection?: boolean
}

/**
 * Create the table editing plugin.
 *
 * This plugin should be included in the editor's plugin list when tables
 * are used. It provides:
 *
 * - Keyboard navigation across cell boundaries (arrow keys)
 * - Cell selection via shift-arrow, shift-click, and mouse drag
 * - Decorations for selected cells
 * - Normalization of edge-case selections
 * - Delete/Backspace handling for cell selections
 */
export function tableEditing(options: TableEditingOptions = {}): Plugin {
  const { allowTableNodeSelection = false } = options

  // Key handlers mapped by key name. We match these manually in
  // handleKeyDown rather than using keydownHandler, because our arrow
  // commands need a TableInputView (not CommandContext).
  const arrowLeft = arrow('horiz', -1)
  const arrowRight = arrow('horiz', 1)
  const arrowUp = arrow('vert', -1)
  const arrowDown = arrow('vert', 1)
  const shiftLeft = shiftArrow('horiz', -1)
  const shiftRight = shiftArrow('horiz', 1)
  const shiftUp = shiftArrow('vert', -1)
  const shiftDown = shiftArrow('vert', 1)

  const isMac = typeof navigator !== 'undefined' && /Mac|iP(hone|[oa]d)/.test(navigator.platform)

  return new Plugin({
    key: tableEditingPluginKey as PluginKey,

    // State: tracks the anchor cell position during mouse-drag selection.
    // null when not dragging, a position number when dragging.
    state: {
      init() { return null as number | null },
      apply(tr, value) {
        const v = value as number | null
        const set = tr.getMeta(tableEditingKey)
        if (set != null) return set === -1 ? null : set as number
        if (v == null || !tr.docChanged) return v
        // Map the stored anchor position through document changes
        const { deleted, pos } = tr.mapping.mapResult(v)
        return deleted ? null : pos
      },
    },

    props: {
      decorations(state: EditorState) {
        return drawCellSelection(state)
      },

      handleKeyDown(view, event) {
        const tableView = buildTableInputView(view)
        if (!tableView) return false

        const { key, shiftKey, metaKey, ctrlKey } = event
        const mod = isMac ? metaKey : ctrlKey

        // Delete/Backspace on cell selection
        if (key === 'Backspace' || key === 'Delete') {
          if (mod || !mod) { // both plain and Mod variants
            if (deleteCellSelection(tableView.state(), tableView.dispatch)) return true
          }
        }

        // Arrow keys (with and without shift)
        if (shiftKey) {
          switch (key) {
            case 'ArrowLeft': return shiftLeft(tableView.state(), tableView.dispatch, tableView)
            case 'ArrowRight': return shiftRight(tableView.state(), tableView.dispatch, tableView)
            case 'ArrowUp': return shiftUp(tableView.state(), tableView.dispatch, tableView)
            case 'ArrowDown': return shiftDown(tableView.state(), tableView.dispatch, tableView)
          }
        } else {
          switch (key) {
            case 'ArrowLeft': return arrowLeft(tableView.state(), tableView.dispatch, tableView)
            case 'ArrowRight': return arrowRight(tableView.state(), tableView.dispatch, tableView)
            case 'ArrowUp': return arrowUp(tableView.state(), tableView.dispatch, tableView)
            case 'ArrowDown': return arrowDown(tableView.state(), tableView.dispatch, tableView)
          }
        }

        return false
      },

      handleTripleClick(view, pos) {
        const tableView = buildTableInputView(view)
        if (!tableView) return false
        return tripleClickHandler(tableView, pos)
      },

      handleDOMEvents: {
        mousedown(view, event) {
          const tableView = buildTableInputView(view)
          if (!tableView) return false
          return mouseDownHandler(tableView, event as MouseEvent)
        },
      },
    },

    appendTransaction(transactions, oldState, newState) {
      return normalizeSelection(
        newState,
        undefined,
        allowTableNodeSelection,
      ) as Transaction | undefined
    },
  })
}

/**
 * Build a TableInputView from the plugin's EditorViewRef.
 * The view ref has the basic state/dispatch/dom, but we need to add
 * posAtCoords and endOfTextblock. These are on the EditorViewContext
 * but not on the plugin's view ref (which is a simpler interface).
 *
 * We look for them on the view object — if the view implements the
 * extended interface (which our EditorViewContext does), use them.
 * Otherwise, fall back to no-ops.
 */
function buildTableInputView(view: {
  state: EditorState
  dispatch: (tr: Transaction) => void
  dom: HTMLElement | null
  focus: () => void
  posAtCoords?: ((coords: { left: number; top: number }) => { pos: number; inside: number } | null)
  endOfTextblock?: ((dir: 'up' | 'down' | 'left' | 'right') => boolean)
  root?: Document | ShadowRoot
}): TableInputView | null {
  const { posAtCoords, endOfTextblock } = view
  if (!posAtCoords || !endOfTextblock) return null
  const root = view.root ?? document

  return {
    state: () => view.state,
    dispatch: view.dispatch,
    dom: () => view.dom,
    posAtCoords,
    endOfTextblock,
    root,
  }
}
