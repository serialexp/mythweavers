import { Mark, Node, Schema } from '../model'
import type { Plugin } from './plugin'
import { Selection } from './selection'
import { Transaction } from './transaction'

/**
 * Configuration object for creating an editor state.
 */
export interface EditorStateConfig {
  /** The schema to use. Required if no doc is provided. */
  schema?: Schema
  /** The document to use. Required if no schema is provided. */
  doc?: Node
  /** A valid selection in the document. */
  selection?: Selection
  /** Stored marks to start with. */
  storedMarks?: readonly Mark[] | null
  /** Plugins to use. */
  plugins?: readonly Plugin<unknown>[]
}

/**
 * The state of a ProseMirror editor is represented by an object of
 * this type. A state is a persistent data structure—it isn't updated,
 * but rather a new state value is computed from an old one using the
 * `apply` method.
 */
export class EditorState {
  /** The current document. */
  readonly doc: Node

  /** The selection. */
  readonly selection: Selection

  /** A set of marks to apply to the next input. */
  readonly storedMarks: readonly Mark[] | null

  /** The schema of the state's document. */
  readonly schema: Schema

  /** @internal */
  readonly plugins: readonly Plugin<unknown>[]

  /** @internal */
  readonly pluginsByKey: { [key: string]: Plugin<unknown> }

  /** @internal Plugin states keyed by plugin key */
  readonly pluginStates: { [key: string]: unknown }

  /** @internal */
  private constructor(config: {
    doc: Node
    selection: Selection
    storedMarks: readonly Mark[] | null
    schema: Schema
    plugins: readonly Plugin<unknown>[]
    pluginsByKey: { [key: string]: Plugin<unknown> }
    pluginStates: { [key: string]: unknown }
  }) {
    this.doc = config.doc
    this.selection = config.selection
    this.storedMarks = config.storedMarks
    this.schema = config.schema
    this.plugins = config.plugins
    this.pluginsByKey = config.pluginsByKey
    this.pluginStates = config.pluginStates
  }

  /**
   * Apply a transaction to this state, producing a new state.
   */
  apply(tr: Transaction): EditorState {
    return this.applyTransaction(tr).state
  }

  /**
   * Apply a transaction, returning the new state and additional info
   * (whether the transaction was filtered out).
   */
  applyTransaction(rootTr: Transaction): { state: EditorState; transactions: readonly Transaction[] } {
    // Filter the transaction through plugins
    let tr: Transaction | null = rootTr

    for (let i = 0; i < this.plugins.length; i++) {
      const plugin = this.plugins[i]
      if (plugin.spec.filterTransaction) {
        if (!plugin.spec.filterTransaction.call(plugin, tr, this)) {
          tr = null
          break
        }
      }
    }

    if (!tr) {
      return { state: this, transactions: [] }
    }

    // Apply append transactions from plugins
    const trs: Transaction[] = [tr]
    let newState = this.applyInner(tr)

    for (;;) {
      let haveNew = false
      for (let i = 0; i < this.plugins.length; i++) {
        const plugin = this.plugins[i]
        if (plugin.spec.appendTransaction) {
          const n = plugin.spec.appendTransaction.call(plugin, trs, this, newState)
          if (n?.docChanged) {
            trs.push(n)
            newState = newState.applyInner(n)
            haveNew = true
          }
        }
      }
      if (!haveNew) break
    }

    return { state: newState, transactions: trs }
  }

  /** @internal */
  private applyInner(tr: Transaction): EditorState {
    const selection = tr.selection
    const doc = tr.doc
    const storedMarks = tr.storedMarks

    // Check if any plugin has a state field that might change
    let hasPluginStateFields = false
    for (const plugin of this.plugins) {
      if (plugin.spec.state) {
        hasPluginStateFields = true
        break
      }
    }

    // Early return if nothing changed and no plugin states to update
    if (!tr.docChanged && !tr.selectionSet && !tr.storedMarksSet_ && !hasPluginStateFields) {
      return this
    }

    // Apply plugin state changes
    const pluginStates: { [key: string]: unknown } = Object.create(null)
    for (const plugin of this.plugins) {
      const stateField = plugin.spec.state
      if (stateField) {
        const oldState = this.pluginStates[plugin.key]
        pluginStates[plugin.key] = stateField.apply.call(plugin, tr, oldState, this, {
          doc,
          selection,
          storedMarks,
          schema: this.schema,
          plugins: this.plugins,
          pluginsByKey: this.pluginsByKey,
          pluginStates,
        } as EditorState)
      } else {
        // Preserve existing state for plugins without state fields
        if (plugin.key in this.pluginStates) {
          pluginStates[plugin.key] = this.pluginStates[plugin.key]
        }
      }
    }

    return new EditorState({
      doc,
      selection,
      storedMarks,
      schema: this.schema,
      plugins: this.plugins,
      pluginsByKey: this.pluginsByKey,
      pluginStates,
    })
  }

  /**
   * Start a transaction from this state.
   */
  tr(): Transaction {
    return new Transaction(this)
  }

  /**
   * Create a new state based on this one, but with some modifications.
   */
  reconfigure(config: { plugins?: readonly Plugin<unknown>[] }): EditorState {
    const plugins = config.plugins ?? this.plugins
    const pluginsByKey: { [key: string]: Plugin<unknown> } = Object.create(null)
    for (const plugin of plugins) {
      pluginsByKey[plugin.key] = plugin
    }

    // Initialize or transfer plugin states
    const pluginStates: { [key: string]: unknown } = Object.create(null)
    for (const plugin of plugins) {
      const stateField = plugin.spec.state
      if (stateField) {
        if (plugin.key in this.pluginStates) {
          // Transfer existing state
          pluginStates[plugin.key] = this.pluginStates[plugin.key]
        } else {
          // Initialize new state
          pluginStates[plugin.key] = stateField.init.call(plugin, { doc: this.doc, selection: this.selection }, this)
        }
      }
    }

    return new EditorState({
      doc: this.doc,
      selection: this.selection,
      storedMarks: this.storedMarks,
      schema: this.schema,
      plugins,
      pluginsByKey,
      pluginStates,
    })
  }

  /**
   * Serialize this state to JSON.
   */
  toJSON(pluginFields?: { [key: string]: Plugin<unknown> }): {
    doc: ReturnType<Node['toJSON']>
    selection: ReturnType<Selection['toJSON']>
  } {
    const result: {
      doc: ReturnType<Node['toJSON']>
      selection: ReturnType<Selection['toJSON']>
      [key: string]: unknown
    } = {
      doc: this.doc.toJSON(),
      selection: this.selection.toJSON(),
    }

    if (pluginFields) {
      for (const prop in pluginFields) {
        const plugin = pluginFields[prop]
        if (plugin.spec.state?.toJSON) {
          result[prop] = plugin.spec.state.toJSON.call(plugin, this.getPluginState(plugin))
        }
      }
    }

    return result
  }

  /**
   * Create a state from JSON.
   */
  static fromJSON(
    config: { schema: Schema; plugins?: readonly Plugin<unknown>[] },
    json: {
      doc?: { type: string; content?: unknown[]; attrs?: Record<string, unknown> }
      selection?: { type: string; anchor: number; head: number }
    },
    _pluginFields?: { [key: string]: Plugin<unknown> },
  ): EditorState {
    if (!json) throw new RangeError('Invalid input for EditorState.fromJSON')
    if (!json.doc) throw new RangeError('No doc in JSON')

    const doc = Node.fromJSON(config.schema, json.doc as Parameters<typeof Node.fromJSON>[1])
    const plugins = config.plugins || []
    const pluginsByKey: { [key: string]: Plugin<unknown> } = Object.create(null)
    for (const plugin of plugins) {
      pluginsByKey[plugin.key] = plugin
    }

    const selection = json.selection ? Selection.fromJSON(doc, json.selection) : Selection.atStart(doc)

    return new EditorState({
      doc,
      selection,
      storedMarks: null,
      schema: config.schema,
      plugins,
      pluginsByKey,
      pluginStates: {},
    })
  }

  /**
   * Create a new state.
   */
  static create(config: EditorStateConfig): EditorState {
    const schema = config.doc ? config.doc.type.schema : config.schema
    if (!schema) {
      throw new RangeError('Schema must be provided or derivable from document')
    }

    const plugins = config.plugins || []
    const pluginsByKey: { [key: string]: Plugin<unknown> } = Object.create(null)
    for (const plugin of plugins) {
      pluginsByKey[plugin.key] = plugin
    }

    let doc = config.doc
    if (!doc) {
      // Try to create a default document
      const filled = schema.topNodeType.createAndFill()
      if (filled) {
        doc = filled
      } else {
        // If createAndFill fails, create a minimal document
        const defaultContent = schema.nodes.paragraph ? schema.nodes.paragraph.create() : null
        doc = schema.topNodeType.create(null, defaultContent ? [defaultContent] : [])
      }
    }

    const selection = config.selection || Selection.atStart(doc)

    // Initialize plugin states
    const pluginStates: { [key: string]: unknown } = Object.create(null)
    for (const plugin of plugins) {
      const stateField = plugin.spec.state
      if (stateField) {
        pluginStates[plugin.key] = stateField.init.call(
          plugin,
          { doc, selection },
          undefined as unknown as EditorState, // State not yet created
        )
      }
    }

    return new EditorState({
      doc,
      selection,
      storedMarks: config.storedMarks ?? null,
      schema,
      plugins,
      pluginsByKey,
      pluginStates,
    })
  }

  /**
   * Get the state field for a plugin.
   */
  getPluginState<T>(plugin: Plugin<T>): T | undefined {
    return this.pluginStates[plugin.key] as T | undefined
  }
}
