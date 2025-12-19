# Plugin Props System Plan

This document describes how to add ProseMirror-compatible plugin props to solid-editor.

## Current State

solid-editor already has:
- `Plugin` class with `spec`, `key`, `getState()`
- `PluginSpec` with `state`, `filterTransaction`, `appendTransaction`, `view`
- `StateField` for plugin state management
- `PluginKey` for plugin lookup
- `PluginView` interface with `update()` and `destroy()`

## What's Missing

### 1. EditorProps Interface

Add to `src/state/plugin.ts`:

```typescript
/**
 * Props that plugins can provide to customize editor behavior.
 * Compatible with ProseMirror's EditorProps.
 */
export interface EditorProps {
  /**
   * Handle keyboard events. Return true to prevent default handling.
   */
  handleKeyDown?: (view: EditorView, event: KeyboardEvent) => boolean | void

  /**
   * Handle text input before it's applied. Return true to prevent default.
   */
  handleTextInput?: (
    view: EditorView,
    from: number,
    to: number,
    text: string
  ) => boolean | void

  /**
   * Handle click events. Called with position info.
   */
  handleClick?: (
    view: EditorView,
    pos: number,
    event: MouseEvent
  ) => boolean | void

  /**
   * Handle double-click events.
   */
  handleDoubleClick?: (
    view: EditorView,
    pos: number,
    event: MouseEvent
  ) => boolean | void

  /**
   * Handle paste events. Return true to prevent default handling.
   */
  handlePaste?: (
    view: EditorView,
    event: ClipboardEvent,
    slice: Slice
  ) => boolean | void

  /**
   * Handle drop events.
   */
  handleDrop?: (
    view: EditorView,
    event: DragEvent,
    slice: Slice,
    moved: boolean
  ) => boolean | void

  /**
   * Provide decorations to render in the view.
   * For SolidJS: return a reactive DecorationSource.
   */
  decorations?: (state: EditorState) => DecorationSource | null

  /**
   * Custom node views. Maps node type names to view constructors.
   * For SolidJS: constructors return SolidJS components.
   */
  nodeViews?: Record<string, NodeViewConstructor>

  /**
   * Control whether the editor is editable.
   */
  editable?: (state: EditorState) => boolean

  /**
   * Provide attributes for the editor's root DOM element.
   */
  attributes?: (state: EditorState) => Record<string, string> | null
}
```

### 2. Update PluginSpec

```typescript
export interface PluginSpec<PluginState = unknown> {
  key?: PluginKey<PluginState>
  state?: StateField<PluginState>
  filterTransaction?: (tr: Transaction, state: EditorState) => boolean
  appendTransaction?: (...) => Transaction | null
  view?: (view: EditorView) => PluginView

  // NEW: Plugin props
  props?: EditorProps
}
```

### 3. Add someProp() to EditorView

In `src/view/EditorView.tsx`, add method to resolve props from plugins:

```typescript
/**
 * Get a prop value, checking view props first, then plugins in order.
 * Returns first truthy value or undefined.
 */
function someProp<K extends keyof EditorProps>(
  state: EditorState,
  viewProps: EditorProps | undefined,
  propName: K
): EditorProps[K] | undefined {
  // Check view props first
  if (viewProps?.[propName]) {
    return viewProps[propName]
  }

  // Check plugins in order
  for (const plugin of state.plugins) {
    const prop = plugin.spec.props?.[propName]
    if (prop) return prop
  }

  return undefined
}

/**
 * Call all handlers for a prop until one returns true.
 */
function callPropHandlers<K extends keyof EditorProps>(
  state: EditorState,
  viewProps: EditorProps | undefined,
  propName: K,
  ...args: Parameters<NonNullable<EditorProps[K]>>
): boolean {
  // Check view props first
  const viewHandler = viewProps?.[propName]
  if (viewHandler && (viewHandler as Function)(...args)) {
    return true
  }

  // Check plugins in order
  for (const plugin of state.plugins) {
    const handler = plugin.spec.props?.[propName]
    if (handler && (handler as Function)(...args)) {
      return true
    }
  }

  return false
}
```

### 4. Integrate Props with EditorView

Update `EditorViewProps`:

```typescript
export interface EditorViewProps {
  state: EditorState
  onStateChange?: (state: EditorState) => void
  dispatchTransaction?: (tr: Transaction) => void
  editable?: boolean
  nodeViews?: NodeViewMap
  class?: string
  placeholder?: string
  autoFocus?: boolean
  keymap?: KeyBindings

  // NEW: Direct props (take precedence over plugin props)
  props?: EditorProps
}
```

Update event handlers to use prop resolution:

```typescript
const handleKeyDown = (event: KeyboardEvent) => {
  // Try keymap first
  if (keymapHandler?.(event)) {
    event.preventDefault()
    return
  }

  // Try plugin handleKeyDown props
  if (callPropHandlers(state(), props.props, 'handleKeyDown', viewContext, event)) {
    event.preventDefault()
    return
  }

  // Default handling...
}
```

### 5. Decoration System (Future)

Decorations need their own implementation. Key types:

```typescript
/**
 * A decoration adds visual elements to the document view.
 */
export abstract class Decoration {
  abstract from: number
  abstract to: number

  static widget(pos: number, toDOM: () => JSX.Element, spec?: WidgetSpec): Decoration
  static inline(from: number, to: number, attrs: Record<string, string>): Decoration
  static node(from: number, to: number, attrs: Record<string, string>): Decoration
}

/**
 * A set of decorations, indexed for efficient lookup.
 */
export class DecorationSet {
  static empty: DecorationSet
  static create(doc: Node, decorations: Decoration[]): DecorationSet

  find(start?: number, end?: number): Decoration[]
  map(mapping: Mapping, doc: Node): DecorationSet
  add(doc: Node, decorations: Decoration[]): DecorationSet
  remove(decorations: Decoration[]): DecorationSet
}

export type DecorationSource = DecorationSet | ((state: EditorState) => DecorationSet)
```

For SolidJS, widget decorations return JSX elements instead of DOM nodes.

### 6. NodeView for SolidJS

```typescript
/**
 * Constructor for custom node views.
 * Returns a SolidJS component that renders the node.
 */
export type NodeViewConstructor = (
  node: Node,
  view: EditorView,
  getPos: () => number | undefined
) => {
  /** The SolidJS component to render */
  component: () => JSX.Element
  /** Called when the node updates */
  update?: (node: Node) => boolean
  /** Called when the node is removed */
  destroy?: () => void
  /** Whether the node content is editable */
  contentDOM?: HTMLElement
}
```

## Implementation Order

1. **Add `props` to PluginSpec** - Simple addition
2. **Implement `someProp()` / `callPropHandlers()`** - Prop resolution
3. **Wire up handleKeyDown from props** - First integration point
4. **Add handleTextInput, handleClick, etc.** - More handlers
5. **Implement basic DecorationSet** - For visual plugins
6. **Add nodeViews integration** - Custom node rendering
7. **Add editable prop** - Conditional editing

## Usage Example

```typescript
// Create a plugin with props
const highlightPlugin = new Plugin({
  state: {
    init: () => [],
    apply: (tr, highlights) => {
      // Update highlights based on transaction
      return computeHighlights(tr.doc)
    }
  },
  props: {
    decorations: (state) => {
      const highlights = highlightPlugin.getState(state)
      return DecorationSet.create(state.doc, highlights.map(h =>
        Decoration.inline(h.from, h.to, { class: 'highlight' })
      ))
    }
  }
})

// Use in EditorView
<EditorView
  state={state}
  plugins={[highlightPlugin]}
  props={{
    handleKeyDown: (view, event) => {
      if (event.key === 'Escape') {
        // Custom escape handling
        return true
      }
    }
  }}
/>
```

## Compatibility Notes

- **Command signature**: Same as ProseMirror `(state, dispatch?, view?) => boolean`
- **Keymap format**: Same as ProseMirror `"Mod-z"`, `"Ctrl-Shift-a"`
- **Plugin spec**: Same structure, props work the same way
- **Prop resolution**: Same order (view props > plugins in order)

The main difference is that view-level rendering uses SolidJS components instead of direct DOM manipulation.
