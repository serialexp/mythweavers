import { createContext, useContext } from 'solid-js'
import type { EditorState, Transaction } from '../state'
import type { DecorationManager, TrackedDecoration } from './DecorationManager'
import type { Decoration } from './decoration'

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
