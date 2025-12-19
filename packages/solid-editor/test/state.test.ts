import { describe, expect, it } from 'vitest'
import {
  AllSelection,
  EditorState,
  NodeSelection,
  Plugin,
  PluginKey,
  Selection,
  TextSelection,
  Transaction,
} from '../src/state'
import { blockquote, doc, p } from './schema'
import { schema } from './schema'

describe('Selection', () => {
  describe('TextSelection', () => {
    it('can be created from a resolved position', () => {
      const d = doc(p('hello'))
      const $pos = d.resolve(3)
      const sel = new TextSelection($pos)

      expect(sel.from).toBe(3)
      expect(sel.to).toBe(3)
      expect(sel.empty).toBe(true)
    })

    it('can be created with anchor and head', () => {
      const d = doc(p('hello world'))
      const $anchor = d.resolve(2)
      const $head = d.resolve(7)
      const sel = new TextSelection($anchor, $head)

      expect(sel.anchor).toBe(2)
      expect(sel.head).toBe(7)
      expect(sel.from).toBe(2)
      expect(sel.to).toBe(7)
      expect(sel.empty).toBe(false)
    })

    it('has $cursor for cursor selections', () => {
      const d = doc(p('hello'))
      const $pos = d.resolve(3)
      const sel = new TextSelection($pos)

      expect(sel.$cursor).not.toBeNull()
      expect(sel.$cursor!.pos).toBe(3)
    })

    it('returns null for $cursor when selection is not empty', () => {
      const d = doc(p('hello'))
      const sel = TextSelection.create(d, 2, 5)

      expect(sel.$cursor).toBeNull()
    })

    it('can be serialized to JSON', () => {
      const d = doc(p('hello'))
      const sel = TextSelection.create(d, 2, 5)
      const json = sel.toJSON()

      expect(json.type).toBe('text')
      expect(json.anchor).toBe(2)
      expect(json.head).toBe(5)
    })

    it('can be deserialized from JSON', () => {
      const d = doc(p('hello'))
      const sel = TextSelection.fromJSON(d, { anchor: 2, head: 5 })

      expect(sel.anchor).toBe(2)
      expect(sel.head).toBe(5)
    })
  })

  describe('NodeSelection', () => {
    it('can select a node', () => {
      const d = doc(p('hello'), blockquote(p('world')))
      const $pos = d.resolve(7) // before blockquote
      const sel = new NodeSelection($pos)

      expect(sel.node.type.name).toBe('blockquote')
      expect(sel.from).toBe(7)
    })

    it('can be serialized to JSON', () => {
      const d = doc(blockquote(p('hello')))
      const sel = NodeSelection.create(d, 0)
      const json = sel.toJSON()

      expect(json.type).toBe('node')
      expect(json.anchor).toBe(0)
    })
  })

  describe('AllSelection', () => {
    it('selects the entire document', () => {
      const d = doc(p('hello'), p('world'))
      const sel = new AllSelection(d)

      expect(sel.from).toBe(0)
      expect(sel.to).toBe(d.content.size)
    })

    it('can be serialized to JSON', () => {
      const d = doc(p('hello'))
      const sel = new AllSelection(d)
      const json = sel.toJSON()

      expect(json.type).toBe('all')
    })
  })

  describe('Selection.findFrom', () => {
    it('finds a selection in text content', () => {
      const d = doc(p('hello'))
      const $pos = d.resolve(3)
      const sel = Selection.findFrom($pos, 1)

      expect(sel).not.toBeNull()
      expect(sel).toBeInstanceOf(TextSelection)
    })

    it('finds a selection at document start', () => {
      const d = doc(p('hello'))
      const sel = Selection.atStart(d)

      expect(sel).not.toBeNull()
    })

    it('finds a selection at document end', () => {
      const d = doc(p('hello'))
      const sel = Selection.atEnd(d)

      expect(sel).not.toBeNull()
    })
  })
})

describe('EditorState', () => {
  describe('create', () => {
    it('can create a state with a schema', () => {
      const state = EditorState.create({ schema })

      expect(state.doc).toBeDefined()
      expect(state.selection).toBeDefined()
      expect(state.schema).toBe(schema)
    })

    it('can create a state with a document', () => {
      const d = doc(p('hello'))
      const state = EditorState.create({ doc: d })

      expect(state.doc).toBe(d)
      expect(state.selection.from).toBe(1)
    })

    it('can create a state with a selection', () => {
      const d = doc(p('hello world'))
      const sel = TextSelection.create(d, 2, 7)
      const state = EditorState.create({ doc: d, selection: sel })

      expect(state.selection.from).toBe(2)
      expect(state.selection.to).toBe(7)
    })
  })

  describe('tr', () => {
    it('creates a transaction', () => {
      const state = EditorState.create({ schema })
      const tr = state.tr()

      expect(tr).toBeInstanceOf(Transaction)
      expect(tr.doc).toBe(state.doc)
    })
  })

  describe('apply', () => {
    it('applies a transaction to produce a new state', () => {
      const state = EditorState.create({ doc: doc(p('hello')) })
      const tr = state.tr().insertText(' world', 6)
      const newState = state.apply(tr)

      expect(newState).not.toBe(state)
      expect(newState.doc.textContent).toBe('hello world')
    })

    it('preserves state when transaction makes no changes', () => {
      const state = EditorState.create({ doc: doc(p('hello')) })
      const tr = state.tr() // empty transaction
      const newState = state.apply(tr)

      expect(newState).toBe(state)
    })

    it('updates selection through document changes', () => {
      const d = doc(p('hello'))
      const state = EditorState.create({
        doc: d,
        selection: TextSelection.create(d, 6), // at end
      })

      const tr = state.tr().insertText('!', 6)
      const newState = state.apply(tr)

      // Selection should be mapped
      expect(newState.selection.from).toBe(7)
    })
  })

  describe('setSelection', () => {
    it('can change selection in a transaction', () => {
      const state = EditorState.create({ doc: doc(p('hello world')) })
      const tr = state.tr().setSelection(TextSelection.create(state.doc, 2, 7))
      const newState = state.apply(tr)

      expect(newState.selection.from).toBe(2)
      expect(newState.selection.to).toBe(7)
    })
  })

  describe('storedMarks', () => {
    it('can set stored marks', () => {
      const state = EditorState.create({ doc: doc(p('hello')) })
      const tr = state.tr().setStoredMarks([schema.marks.em.create()])
      const newState = state.apply(tr)

      expect(newState.storedMarks).not.toBeNull()
      expect(newState.storedMarks!.length).toBe(1)
      expect(newState.storedMarks![0].type.name).toBe('em')
    })
  })

  describe('plugins', () => {
    it('can be created with plugins', () => {
      const plugin = new Plugin({})
      const state = EditorState.create({ schema, plugins: [plugin] })

      expect(state.plugins.length).toBe(1)
      expect(state.plugins[0]).toBe(plugin)
    })

    it('can reconfigure plugins', () => {
      const plugin1 = new Plugin({})
      const plugin2 = new Plugin({})
      const state = EditorState.create({ schema, plugins: [plugin1] })
      const newState = state.reconfigure({ plugins: [plugin2] })

      expect(newState.plugins.length).toBe(1)
      expect(newState.plugins[0]).toBe(plugin2)
    })
  })

  describe('toJSON/fromJSON', () => {
    it('can serialize and deserialize state', () => {
      const d = doc(p('hello'))
      const state = EditorState.create({
        doc: d,
        selection: TextSelection.create(d, 3),
      })

      const json = state.toJSON()
      const restored = EditorState.fromJSON({ schema }, json)

      expect(restored.doc.textContent).toBe('hello')
      expect(restored.selection.from).toBe(3)
    })
  })
})

describe('Transaction', () => {
  it('extends Transform', () => {
    const state = EditorState.create({ doc: doc(p('hello')) })
    const tr = state.tr()

    // Transaction should have Transform methods
    expect(typeof tr.insert).toBe('function')
    expect(typeof tr.delete).toBe('function')
    expect(typeof tr.replace).toBe('function')
  })

  it('tracks selection changes', () => {
    const state = EditorState.create({ doc: doc(p('hello')) })
    const tr = state.tr()

    expect(tr.selectionSet).toBe(false)

    tr.setSelection(TextSelection.create(state.doc, 3))
    expect(tr.selectionSet).toBe(true)
  })

  it('can store metadata', () => {
    const state = EditorState.create({ schema })
    const tr = state.tr()

    tr.setMeta('test', 'value')
    expect(tr.getMeta('test')).toBe('value')
  })

  it('can store metadata with plugin key', () => {
    const key = new PluginKey('testPlugin')
    const state = EditorState.create({ schema })
    const tr = state.tr()

    tr.setMeta(key, { data: 123 })
    expect(tr.getMeta(key)).toEqual({ data: 123 })
  })

  it('tracks scroll into view', () => {
    const state = EditorState.create({ schema })
    const tr = state.tr()

    expect(tr.scrolledIntoView).toBe(false)

    tr.scrollIntoView()
    expect(tr.scrolledIntoView).toBe(true)
  })

  it('has a timestamp', () => {
    const state = EditorState.create({ schema })
    const before = Date.now()
    const tr = state.tr()
    const after = Date.now()

    expect(tr.time).toBeGreaterThanOrEqual(before)
    expect(tr.time).toBeLessThanOrEqual(after)
  })
})

describe('Plugin', () => {
  it('can be created with a spec', () => {
    const plugin = new Plugin({})
    expect(plugin.spec).toBeDefined()
    expect(plugin.key).toBeDefined()
  })

  it('can use a PluginKey', () => {
    const key = new PluginKey('myPlugin')
    const plugin = new Plugin({ key })

    expect(plugin.key).toBe(key.key)
  })

  it('can filter transactions', () => {
    let filtered = false
    const plugin = new Plugin({
      filterTransaction() {
        filtered = true
        return false // reject all transactions
      },
    })

    const state = EditorState.create({ schema, plugins: [plugin] })
    const tr = state.tr().insertText('x', 1)
    const result = state.applyTransaction(tr)

    expect(filtered).toBe(true)
    expect(result.state).toBe(state) // state unchanged
  })

  it('can append transactions', () => {
    let appendCalled = false
    const plugin = new Plugin({
      appendTransaction(_trs, _oldState, _newState) {
        appendCalled = true
        return null
      },
    })

    const state = EditorState.create({
      doc: doc(p('hello')),
      plugins: [plugin],
    })
    const tr = state.tr().insertText('!', 6)
    state.apply(tr)

    expect(appendCalled).toBe(true)
  })
})

describe('PluginKey', () => {
  it('can retrieve a plugin from state', () => {
    const key = new PluginKey('test')
    const plugin = new Plugin({ key })
    const state = EditorState.create({ schema, plugins: [plugin] })

    expect(key.get(state)).toBe(plugin)
  })

  it('returns undefined for missing plugin', () => {
    const key = new PluginKey('missing')
    const state = EditorState.create({ schema })

    expect(key.get(state)).toBeUndefined()
  })
})
