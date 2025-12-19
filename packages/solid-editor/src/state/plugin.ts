import type { Node, Slice } from '../model'
import type { EditorState } from './state'
import type { Transaction } from './transaction'

// Forward reference for EditorView - actual type imported at runtime would cause circular deps
interface EditorViewRef {
  state: EditorState
  dispatch: (tr: Transaction) => void
  dom: HTMLElement | null
  focus: () => void
}

/**
 * Props that plugins can provide to customize editor behavior.
 * Compatible with ProseMirror's EditorProps.
 */
export interface EditorProps {
  /**
   * Handle keyboard events. Return true to prevent default handling.
   */
  handleKeyDown?: (view: EditorViewRef, event: KeyboardEvent) => boolean | undefined

  /**
   * Handle text input before it's applied. Return true to prevent default.
   */
  handleTextInput?: (view: EditorViewRef, from: number, to: number, text: string) => boolean | undefined

  /**
   * Handle click events. Called with position info.
   */
  handleClick?: (view: EditorViewRef, pos: number, event: MouseEvent) => boolean | undefined

  /**
   * Handle double-click events.
   */
  handleDoubleClick?: (view: EditorViewRef, pos: number, event: MouseEvent) => boolean | undefined

  /**
   * Handle triple-click events.
   */
  handleTripleClick?: (view: EditorViewRef, pos: number, event: MouseEvent) => boolean | undefined

  /**
   * Handle paste events. Return true to prevent default handling.
   */
  handlePaste?: (view: EditorViewRef, event: ClipboardEvent, slice: Slice) => boolean | undefined

  /**
   * Handle drop events.
   */
  handleDrop?: (view: EditorViewRef, event: DragEvent, slice: Slice, moved: boolean) => boolean | undefined

  /**
   * Handle scroll-to-selection. Return true to prevent default scrolling.
   */
  handleScrollToSelection?: (view: EditorViewRef) => boolean

  /**
   * Control whether the editor is editable.
   */
  editable?: (state: EditorState) => boolean

  /**
   * Provide attributes for the editor's root DOM element.
   */
  attributes?: Record<string, string> | ((state: EditorState) => Record<string, string> | null)

  /**
   * Transform pasted HTML before parsing.
   */
  transformPastedHTML?: (html: string, view: EditorViewRef) => string

  /**
   * Transform pasted text before inserting.
   */
  transformPastedText?: (text: string, plain: boolean, view: EditorViewRef) => string

  /**
   * Provide decorations to render in the editor.
   * Can be a DecorationSet or a function that computes one from the state.
   * Decorations from all plugins are merged together.
   *
   * Note: Import DecorationSet from the view module.
   */
  decorations?: (state: EditorState) => DecorationSetRef | null

  /**
   * Handle DOM events on the editor. Each key is an event name, and the value
   * is a handler function. Return true to prevent default handling.
   */
  handleDOMEvents?: {
    [eventName: string]: (view: EditorViewRef, event: Event) => boolean | undefined
  }
}

// Forward reference for DecorationSet to avoid circular imports
interface DecorationSetRef {
  find(start?: number, end?: number): unknown[]
  isEmpty: boolean
}

/**
 * A plugin spec can define a few different things:
 *
 * - `props` can define properties to pass to the editor view
 * - `state` can define a plugin state, which is managed for you
 * - `filterTransaction` can filter transactions
 * - `appendTransaction` can add transactions
 * - `view` can define view-level functionality
 */
export interface PluginSpec<PluginState = unknown> {
  /**
   * A unique key for this plugin. If not provided, one will be
   * generated automatically.
   */
  key?: PluginKey<PluginState>

  /**
   * Props to pass to the editor view. These can provide event handlers,
   * control editability, supply decorations, etc.
   */
  props?: EditorProps

  /**
   * A state field that the plugin can use to store state that needs
   * to be persisted between transactions.
   */
  state?: StateField<PluginState>

  /**
   * When present, this will be called before a transaction is applied
   * by the state, allowing the plugin to cancel it (by returning false).
   */
  filterTransaction?: (this: Plugin<PluginState>, tr: Transaction, state: EditorState) => boolean

  /**
   * Allows the plugin to append another transaction to be applied after
   * the given array of transactions. When another plugin has appended
   * a transaction after this was called, the function will be called
   * again with the extended array.
   */
  appendTransaction?: (
    this: Plugin<PluginState>,
    transactions: readonly Transaction[],
    oldState: EditorState,
    newState: EditorState,
  ) => Transaction | null | undefined

  /**
   * Can be used to define view-level functionality. When the plugin is
   * used by an editor view, the view method will be called with the
   * view as argument, and should return an object.
   */
  view?: (view: EditorViewRef) => PluginView

  /**
   * Arbitrary additional properties can be stored in plugin specs.
   */
  [key: string]: unknown
}

/**
 * A plugin state field spec makes it possible for plugins to add
 * extra fields to the editor state.
 */
export interface StateField<T> {
  /**
   * Initialize the value of the field.
   */
  init: (config: { doc?: Node; selection?: unknown }, instance: EditorState) => T

  /**
   * Apply the given transaction to this state field, producing a new
   * field value. Note that the `newState` argument is the state that
   * results from applying the transaction, not the old state.
   */
  apply: (tr: Transaction, value: T, oldState: EditorState, newState: EditorState) => T

  /**
   * Convert this field to JSON. Can be left null to indicate that the
   * field cannot be serialized.
   */
  toJSON?: (value: T) => unknown

  /**
   * Deserialize the JSON representation of this field.
   */
  fromJSON?: (config: { doc?: Node }, json: unknown, state: EditorState) => T
}

/**
 * A key is used to tag plugins in a way that makes it possible to
 * find them, given an editor state.
 */
export class PluginKey<T = unknown> {
  /**
   * Create a plugin key.
   */
  constructor(readonly name: string = 'key') {}

  /**
   * Get the active plugin with this key, if any, from an editor state.
   */
  get(state: EditorState): Plugin<T> | undefined {
    return state.pluginsByKey[this.key] as Plugin<T> | undefined
  }

  /**
   * Get the plugin's state from an editor state.
   */
  getState(state: EditorState): T | undefined {
    const plugin = this.get(state)
    return plugin && state.getPluginState(plugin)
  }

  /**
   * The key used internally.
   */
  get key(): string {
    return this.name
  }
}

/**
 * Plugins bundle functionality that can be added to an editor. They
 * are part of the persistent data structure—every state has a set of
 * active plugins stored in it.
 */
export class Plugin<T = unknown> {
  /**
   * The plugin's spec object.
   */
  readonly spec: PluginSpec<T>

  /**
   * A key for this plugin.
   */
  readonly key: string

  /**
   * Create a plugin.
   */
  constructor(spec: PluginSpec<T>) {
    this.spec = spec
    this.key = spec.key ? spec.key.key : createKey('plugin')
  }

  /**
   * Extract the plugin's state field from an editor state.
   */
  getState(state: EditorState): T | undefined {
    return state.getPluginState(this)
  }

  /**
   * Get the props defined by this plugin.
   */
  get props(): EditorProps {
    return this.spec.props || {}
  }
}

/**
 * A view plugin can define methods that react to changes in the editor
 * view's state or the surrounding DOM.
 */
export interface PluginView {
  /**
   * Called when the view is updated with a new state or the viewport
   * changes.
   */
  update?: (view: EditorViewRef, prevState: EditorState) => void

  /**
   * Called when the plugin view is destroyed.
   */
  destroy?: () => void
}

// Key generation
let keyIndex = 0
function createKey(name: string): string {
  return `${name}$${++keyIndex}`
}
