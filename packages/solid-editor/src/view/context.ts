import { createContext, useContext } from 'solid-js'
import type { EditorState, Transaction } from '../state'
import type { DecorationManager, TrackedDecoration } from './DecorationManager'
import type { Decoration } from './decoration'

/**
 * Information about a selected block node (UI-level concept, not model-level).
 * Used for block-level operations like changing block type, wrapping, etc.
 */
export interface SelectedBlock {
  /** The node ID of the selected block */
  nodeId: string
  /** The document position of the block */
  pos: number
  /** The depth in the document tree */
  depth: number
  /** The node type name (e.g., "paragraph", "blockquote") */
  typeName: string
}

/**
 * Interface for the editor view that gets exposed via context
 */
export interface EditorViewContext {
  /** The current editor state */
  state: () => EditorState
  /** Dispatch a transaction to update the state */
  dispatch: (tr: Transaction) => void
  /** The DOM element containing the editor */
  dom: () => HTMLElement | null
  /** Whether the editor is currently focused */
  hasFocus: () => boolean
  /** Focus the editor */
  focus: () => void
  /**
   * Add a decoration that automatically tracks its position.
   * Returns a TrackedDecoration with a remove() method.
   */
  addDecoration: (decoration: Decoration) => TrackedDecoration
  /**
   * Add multiple decorations that automatically track their positions.
   */
  addDecorations: (decorations: Decoration[]) => TrackedDecoration[]
  /**
   * Access to the decoration manager for advanced usage.
   */
  decorations: DecorationManager
  /**
   * The currently selected block (for block-level toolbar operations).
   * Defaults to the textblock at the cursor. Can be overridden by clicking
   * a block selector handle or breadcrumb.
   */
  selectedBlock: () => SelectedBlock | null
  /**
   * Explicitly select a block by node ID. Passing null resets to auto-detect
   * from cursor position.
   */
  selectBlock: (nodeId: string | null) => void
  /**
   * Get the ancestor chain of blocks at the current cursor position.
   * Each entry has { nodeId, pos, depth, typeName }.
   */
  blockAncestors: () => SelectedBlock[]
  /**
   * Find the document position at the given screen coordinates.
   * Returns `{ pos, inside }` where `inside` is the position of the
   * innermost node containing the point (useful for cells with merged
   * rows/columns), or -1 if no such node is found.
   */
  posAtCoords: (coords: { left: number; top: number }) => { pos: number; inside: number } | null
  /**
   * Check whether the cursor is at the visual end of a textblock in the
   * given direction. Uses a model-based heuristic (parentOffset checks).
   */
  endOfTextblock: (dir: 'up' | 'down' | 'left' | 'right') => boolean
  /**
   * The root node for event listeners (document or shadow root).
   */
  root: Document | ShadowRoot
  /**
   * The wrapper DOM element (.solidjs-editor-wrapper) that contains the
   * contenteditable div. Useful for rendering overlays (drag handles,
   * block selectors, etc.) outside the contenteditable area.
   */
  wrapperDom: () => HTMLElement | null
}

/**
 * Context for accessing the editor view from anywhere in the component tree
 */
export const EditorContext = createContext<EditorViewContext>()

/**
 * Hook to access the editor view context
 * @throws Error if used outside of an EditorView
 */
export function useEditor(): EditorViewContext {
  const context = useContext(EditorContext)
  if (!context) {
    throw new Error('useEditor must be used within an EditorView')
  }
  return context
}
