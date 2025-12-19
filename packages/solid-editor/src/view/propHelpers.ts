import type { EditorProps, EditorState } from '../state'
import { type Decoration, DecorationSet } from './decoration'

/**
 * Interface for the view reference passed to prop handlers.
 * This matches the EditorViewRef in plugin.ts.
 */
export interface PropViewRef {
  state: EditorState
  dispatch: (tr: any) => void
  dom: HTMLElement | null
  focus: () => void
}

/**
 * Get the first defined value for a prop, checking view props first, then plugins in order.
 * Used for non-handler props like `editable` or `attributes`.
 *
 * @param state - The editor state containing plugins
 * @param viewProps - Props passed directly to the EditorView
 * @param propName - The name of the prop to look up
 * @returns The first defined value, or undefined
 */
export function someProp<K extends keyof EditorProps>(
  state: EditorState,
  viewProps: EditorProps | undefined,
  propName: K,
): EditorProps[K] | undefined {
  // Check view props first (they take precedence)
  if (viewProps?.[propName] !== undefined) {
    return viewProps[propName]
  }

  // Check plugins in order
  for (const plugin of state.plugins) {
    const prop = plugin.spec.props?.[propName]
    if (prop !== undefined) {
      return prop
    }
  }

  return undefined
}

/**
 * Call all handlers for an event prop until one returns true.
 * Handlers are called in order: view props first, then plugins.
 *
 * @param state - The editor state containing plugins
 * @param viewProps - Props passed directly to the EditorView
 * @param propName - The name of the handler prop
 * @param args - Arguments to pass to the handlers
 * @returns true if any handler returned true (handled the event)
 */
export function callPropHandlers<K extends keyof EditorProps>(
  state: EditorState,
  viewProps: EditorProps | undefined,
  propName: K,
  ...args: EditorProps[K] extends ((...a: infer A) => any) | undefined ? A : never[]
): boolean {
  // Check view props first
  const viewHandler = viewProps?.[propName]
  if (viewHandler && typeof viewHandler === 'function') {
    const result = (viewHandler as Function)(...args)
    if (result === true) return true
  }

  // Check plugins in order
  for (const plugin of state.plugins) {
    const handler = plugin.spec.props?.[propName]
    if (handler && typeof handler === 'function') {
      const result = (handler as Function)(...args)
      if (result === true) return true
    }
  }

  return false
}

/**
 * Collect all values for a prop from all plugins.
 * Used for props where multiple plugins can contribute (like decorations).
 *
 * @param state - The editor state containing plugins
 * @param viewProps - Props passed directly to the EditorView
 * @param propName - The name of the prop to collect
 * @returns Array of all defined values
 */
export function collectProps<K extends keyof EditorProps>(
  state: EditorState,
  viewProps: EditorProps | undefined,
  propName: K,
): NonNullable<EditorProps[K]>[] {
  const results: NonNullable<EditorProps[K]>[] = []

  // Collect from view props first
  if (viewProps?.[propName] !== undefined) {
    results.push(viewProps[propName] as NonNullable<EditorProps[K]>)
  }

  // Collect from plugins in order
  for (const plugin of state.plugins) {
    const prop = plugin.spec.props?.[propName]
    if (prop !== undefined) {
      results.push(prop as NonNullable<EditorProps[K]>)
    }
  }

  return results
}

/**
 * Check if the editor should be editable by evaluating the editable prop.
 * Returns true if editable (the default), or if any editable prop returns true.
 *
 * @param state - The editor state
 * @param viewProps - Props passed directly to the EditorView
 * @param defaultEditable - Default value if no editable prop is defined
 * @returns Whether the editor should be editable
 */
export function isEditable(state: EditorState, viewProps: EditorProps | undefined, defaultEditable = true): boolean {
  const editableProp = someProp(state, viewProps, 'editable')
  if (editableProp === undefined) {
    return defaultEditable
  }
  return editableProp(state)
}

/**
 * Collect attributes from all attribute props.
 * Merges attributes from view props and all plugins.
 *
 * @param state - The editor state
 * @param viewProps - Props passed directly to the EditorView
 * @returns Merged attributes object
 */
export function collectAttributes(state: EditorState, viewProps: EditorProps | undefined): Record<string, string> {
  const result: Record<string, string> = {}

  // Helper to merge attributes from a single source
  const mergeAttrs = (
    attrs: Record<string, string> | ((state: EditorState) => Record<string, string> | null) | undefined,
  ) => {
    if (!attrs) return
    const resolved = typeof attrs === 'function' ? attrs(state) : attrs
    if (resolved) {
      Object.assign(result, resolved)
    }
  }

  // Merge from view props first (lowest priority - will be overwritten by plugins)
  mergeAttrs(viewProps?.attributes)

  // Merge from plugins in order (later plugins override earlier ones)
  for (const plugin of state.plugins) {
    mergeAttrs(plugin.spec.props?.attributes)
  }

  return result
}

/**
 * Collect decorations from all plugins.
 * All decoration sets are merged into a single DecorationSet.
 *
 * @param state - The editor state
 * @param viewProps - Props passed directly to the EditorView
 * @returns Merged DecorationSet containing all decorations
 */
export function collectDecorations(state: EditorState, viewProps: EditorProps | undefined): DecorationSet {
  const allDecorations: Decoration[] = []

  // Collect from view props first
  if (viewProps?.decorations) {
    const decSet = viewProps.decorations(state)
    if (decSet && !decSet.isEmpty) {
      allDecorations.push(...(decSet.find() as Decoration[]))
    }
  }

  // Collect from plugins in order
  for (const plugin of state.plugins) {
    const decorationsFn = plugin.spec.props?.decorations
    if (decorationsFn) {
      const decSet = decorationsFn(state)
      if (decSet && !decSet.isEmpty) {
        allDecorations.push(...(decSet.find() as Decoration[]))
      }
    }
  }

  if (allDecorations.length === 0) {
    return DecorationSet.empty
  }

  return DecorationSet.create(state.doc, allDecorations)
}
