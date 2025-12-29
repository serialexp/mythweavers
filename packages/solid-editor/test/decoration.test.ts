import { beforeEach, describe, expect, it } from 'vitest'
import { EditorState } from '../src/state'
import { createDecorationManager } from '../src/view/DecorationManager'
import {
  DecorationSet,
  type InlineDecoration,
  inline,
  isInline,
  isNode,
  isSpan,
  isWidget,
  node,
  span,
  widget,
} from '../src/view/decoration'
import { doc, p } from './schema'
import { schema } from './schema'

describe('Decoration', () => {
  describe('widget', () => {
    it('creates a widget decoration at a position', () => {
      const w = widget(5, () => null as any)

      expect(w.from).toBe(5)
      expect(w.to).toBe(5)
      expect(w.spec.type).toBe('widget')
      expect(isWidget(w)).toBe(true)
    })

    it('supports side option', () => {
      const before = widget(5, () => null as any, { side: -1 })
      const after = widget(5, () => null as any, { side: 1 })

      expect(before.spec.side).toBe(-1)
      expect(after.spec.side).toBe(1)
    })

    it('supports key option for identity', () => {
      const w = widget(5, () => null as any, { key: 'my-widget' })

      expect(w.spec.key).toBe('my-widget')
    })
  })

  describe('inline', () => {
    it('creates an inline decoration for a range', () => {
      const dec = inline(5, 15, { class: 'highlight' })

      expect(dec.from).toBe(5)
      expect(dec.to).toBe(15)
      expect(dec.attrs.class).toBe('highlight')
      expect(dec.spec.type).toBe('inline')
      expect(isInline(dec)).toBe(true)
    })

    it('supports multiple attributes', () => {
      const dec = inline(5, 15, {
        class: 'highlight',
        'data-id': '123',
        style: 'background: yellow',
      })

      expect(dec.attrs.class).toBe('highlight')
      expect(dec.attrs['data-id']).toBe('123')
      expect(dec.attrs.style).toBe('background: yellow')
    })
  })

  describe('node', () => {
    it('creates a node decoration for a node range', () => {
      const dec = node(0, 10, { class: 'selected' })

      expect(dec.from).toBe(0)
      expect(dec.to).toBe(10)
      expect(dec.attrs.class).toBe('selected')
      expect(dec.spec.type).toBe('node')
      expect(isNode(dec)).toBe(true)
    })
  })

  describe('span', () => {
    it('creates a span decoration with tag name', () => {
      const dec = span(5, 15, 'mark', { class: 'highlight' })

      expect(dec.from).toBe(5)
      expect(dec.to).toBe(15)
      expect(dec.tagName).toBe('mark')
      expect(dec.attrs?.class).toBe('highlight')
      expect(dec.spec.type).toBe('span')
      expect(isSpan(dec)).toBe(true)
    })

    it('creates a span decoration with render function', () => {
      const renderFn = (children: () => any) => children()
      const dec = span(5, 15, renderFn)

      expect(dec.from).toBe(5)
      expect(dec.to).toBe(15)
      expect(dec.render).toBe(renderFn)
      expect(dec.tagName).toBeUndefined()
      expect(isSpan(dec)).toBe(true)
    })
  })
})

describe('DecorationSet', () => {
  describe('create', () => {
    it('creates an empty set when given no decorations', () => {
      const d = doc(p('hello'))
      const set = DecorationSet.create(d, [])

      expect(set.isEmpty).toBe(true)
      expect(set.size).toBe(0)
    })

    it('creates a set with decorations', () => {
      const d = doc(p('hello'))
      const set = DecorationSet.create(d, [inline(1, 5, { class: 'a' }), inline(3, 6, { class: 'b' })])

      expect(set.isEmpty).toBe(false)
      expect(set.size).toBe(2)
    })

    it('sorts decorations by position', () => {
      const d = doc(p('hello world'))
      const set = DecorationSet.create(d, [
        inline(8, 12, { class: 'c' }),
        inline(1, 5, { class: 'a' }),
        inline(4, 9, { class: 'b' }),
      ])

      const all = set.find()
      expect(all[0].from).toBe(1)
      expect(all[1].from).toBe(4)
      expect(all[2].from).toBe(8)
    })

    it('sorts widgets by side at same position', () => {
      const d = doc(p('hello'))
      const set = DecorationSet.create(d, [
        widget(5, () => null as any, { side: 1 }),
        widget(5, () => null as any, { side: -1 }),
        widget(5, () => null as any, { side: 0 }),
      ])

      const widgets = set.findWidgetsAt(5)
      expect(widgets[0].spec.side).toBe(-1)
      expect(widgets[1].spec.side).toBe(0)
      expect(widgets[2].spec.side).toBe(1)
    })
  })

  describe('find', () => {
    it('returns all decorations when no range specified', () => {
      const d = doc(p('hello world'))
      const set = DecorationSet.create(d, [inline(1, 5, { class: 'a' }), inline(7, 12, { class: 'b' })])

      expect(set.find().length).toBe(2)
    })

    it('finds decorations in a range', () => {
      const d = doc(p('hello world'))
      const set = DecorationSet.create(d, [
        inline(1, 3, { class: 'a' }),
        inline(5, 8, { class: 'b' }),
        inline(10, 12, { class: 'c' }),
      ])

      const found = set.find(4, 9)
      expect(found.length).toBe(1)
      expect((found[0] as InlineDecoration).attrs.class).toBe('b')
    })

    it('finds overlapping decorations', () => {
      const d = doc(p('hello world'))
      const set = DecorationSet.create(d, [inline(1, 8, { class: 'a' }), inline(5, 12, { class: 'b' })])

      const found = set.find(6, 7)
      expect(found.length).toBe(2)
    })
  })

  describe('findWidgetsAt', () => {
    it('finds widgets at a specific position', () => {
      const d = doc(p('hello'))
      const set = DecorationSet.create(d, [
        widget(3, () => null as any),
        widget(5, () => null as any),
        inline(1, 4, { class: 'a' }),
      ])

      expect(set.findWidgetsAt(3).length).toBe(1)
      expect(set.findWidgetsAt(5).length).toBe(1)
      expect(set.findWidgetsAt(4).length).toBe(0)
    })
  })

  describe('findInlineIn', () => {
    it('finds inline decorations in a range', () => {
      const d = doc(p('hello world'))
      const set = DecorationSet.create(d, [
        inline(1, 5, { class: 'a' }),
        widget(3, () => null as any),
        inline(7, 12, { class: 'b' }),
      ])

      const found = set.findInlineIn(1, 6)
      expect(found.length).toBe(1)
      expect(found[0].attrs.class).toBe('a')
    })
  })

  describe('findSpansIn', () => {
    it('finds span decorations in a range', () => {
      const d = doc(p('hello world'))
      const set = DecorationSet.create(d, [span(1, 5, 'mark'), inline(3, 8, { class: 'a' }), span(7, 12, 'strong')])

      const found = set.findSpansIn(1, 6)
      expect(found.length).toBe(1)
      expect(found[0].tagName).toBe('mark')
    })
  })

  describe('findNodeAt', () => {
    it('finds node decoration at exact position', () => {
      const d = doc(p('hello'))
      const set = DecorationSet.create(d, [node(0, 7, { class: 'selected' }), inline(1, 5, { class: 'a' })])

      const found = set.findNodeAt(0, 7)
      expect(found).toBeDefined()
      expect(found!.attrs.class).toBe('selected')
    })

    it('returns undefined if no exact match', () => {
      const d = doc(p('hello'))
      const set = DecorationSet.create(d, [node(0, 7, { class: 'selected' })])

      expect(set.findNodeAt(0, 5)).toBeUndefined()
      expect(set.findNodeAt(1, 7)).toBeUndefined()
    })
  })

  describe('add', () => {
    it('adds decorations to an existing set', () => {
      const d = doc(p('hello'))
      const set1 = DecorationSet.create(d, [inline(1, 3, { class: 'a' })])

      const set2 = set1.add(d, [inline(4, 6, { class: 'b' })])

      expect(set1.size).toBe(1)
      expect(set2.size).toBe(2)
    })

    it('returns same set when adding empty array', () => {
      const d = doc(p('hello'))
      const set = DecorationSet.create(d, [inline(1, 3, { class: 'a' })])

      expect(set.add(d, [])).toBe(set)
    })
  })

  describe('remove', () => {
    it('removes decorations by reference', () => {
      const d = doc(p('hello'))
      const dec1 = inline(1, 3, { class: 'a' })
      const dec2 = inline(4, 6, { class: 'b' })
      const set = DecorationSet.create(d, [dec1, dec2])

      const newSet = set.remove([dec1])

      expect(newSet.size).toBe(1)
      expect(newSet.find()[0]).toBe(dec2)
    })

    it('removes decorations by key', () => {
      const d = doc(p('hello'))
      const set = DecorationSet.create(d, [
        inline(1, 3, { class: 'a' }, { key: 'remove-me' }),
        inline(4, 6, { class: 'b' }, { key: 'keep-me' }),
      ])

      const newSet = set.remove([
        inline(0, 0, {}, { key: 'remove-me' }), // Different decoration, same key
      ])

      expect(newSet.size).toBe(1)
    })

    it('returns same set when nothing removed', () => {
      const d = doc(p('hello'))
      const dec = inline(1, 3, { class: 'a' })
      const set = DecorationSet.create(d, [dec])

      const other = inline(4, 6, { class: 'b' })
      expect(set.remove([other])).toBe(set)
    })
  })

  describe('map', () => {
    it('maps decorations through insertions', () => {
      const d = doc(p('hello'))
      const state = EditorState.create({ doc: d, schema })

      const set = DecorationSet.create(d, [
        inline(3, 6, { class: 'a' }), // "llo"
      ])

      // Insert "XX" at position 2 (before the decoration)
      const tr = state.tr().insertText('XX', 2)
      const newSet = set.map(tr.mapping, tr.doc)

      const dec = newSet.find()[0] as InlineDecoration
      expect(dec.from).toBe(5) // 3 + 2
      expect(dec.to).toBe(8) // 6 + 2
    })

    it('maps decorations through deletions', () => {
      const d = doc(p('hello world'))
      const state = EditorState.create({ doc: d, schema })

      const set = DecorationSet.create(d, [
        inline(7, 12, { class: 'a' }), // "world"
      ])

      // Delete "llo " (positions 3-7)
      const tr = state.tr().delete(3, 7)
      const newSet = set.map(tr.mapping, tr.doc)

      const dec = newSet.find()[0] as InlineDecoration
      expect(dec.from).toBe(3) // 7 - 4
      expect(dec.to).toBe(8) // 12 - 4
    })

    it('removes decorations that are deleted', () => {
      const d = doc(p('hello world'))
      const state = EditorState.create({ doc: d, schema })

      const set = DecorationSet.create(d, [
        inline(3, 6, { class: 'a' }), // "lo "
      ])

      // Delete the entire decorated range
      const tr = state.tr().delete(2, 8)
      const newSet = set.map(tr.mapping, tr.doc)

      expect(newSet.isEmpty).toBe(true)
    })

    it('removes inline decorations that become empty', () => {
      const d = doc(p('hello'))
      const state = EditorState.create({ doc: d, schema })

      const set = DecorationSet.create(d, [
        inline(2, 4, { class: 'a' }), // "ll"
      ])

      // Delete "ll"
      const tr = state.tr().delete(2, 4)
      const newSet = set.map(tr.mapping, tr.doc)

      expect(newSet.isEmpty).toBe(true)
    })

    it('keeps widgets at their mapped position', () => {
      const d = doc(p('hello'))
      const state = EditorState.create({ doc: d, schema })

      const set = DecorationSet.create(d, [widget(3, () => null as any)])

      // Insert "XX" before the widget
      const tr = state.tr().insertText('XX', 1)
      const newSet = set.map(tr.mapping, tr.doc)

      const w = newSet.findWidgetsAt(5)
      expect(w.length).toBe(1)
    })

    it('maps span decorations', () => {
      const d = doc(p('hello world'))
      const state = EditorState.create({ doc: d, schema })

      const set = DecorationSet.create(d, [span(3, 8, 'mark')])

      // Insert at beginning
      const tr = state.tr().insertText('XX', 1)
      const newSet = set.map(tr.mapping, tr.doc)

      const spans = newSet.findSpansIn(0, 20)
      expect(spans[0].from).toBe(5)
      expect(spans[0].to).toBe(10)
    })
  })
})

describe('DecorationManager', () => {
  let manager: ReturnType<typeof createDecorationManager>

  beforeEach(() => {
    manager = createDecorationManager()
  })

  describe('add', () => {
    it('adds a decoration and returns TrackedDecoration', () => {
      const dec = inline(5, 10, { class: 'test' })
      const tracked = manager.add(dec)

      expect(tracked.id).toBeDefined()
      expect(tracked.decoration).toBe(dec)
      expect(typeof tracked.remove).toBe('function')
      expect(manager.size).toBe(1)
    })

    it('assigns unique IDs', () => {
      const t1 = manager.add(inline(1, 2, {}))
      const t2 = manager.add(inline(3, 4, {}))

      expect(t1.id).not.toBe(t2.id)
    })
  })

  describe('addAll', () => {
    it('adds multiple decorations', () => {
      const tracked = manager.addAll([inline(1, 2, {}), inline(3, 4, {}), inline(5, 6, {})])

      expect(tracked.length).toBe(3)
      expect(manager.size).toBe(3)
    })
  })

  describe('remove', () => {
    it('removes a decoration by ID', () => {
      const tracked = manager.add(inline(1, 5, {}))

      expect(manager.size).toBe(1)
      manager.remove(tracked.id)
      expect(manager.size).toBe(0)
    })

    it('returns false when ID not found', () => {
      expect(manager.remove('nonexistent')).toBe(false)
    })
  })

  describe('TrackedDecoration.remove', () => {
    it('removes via the tracked decoration handle', () => {
      const tracked = manager.add(inline(1, 5, {}))

      expect(manager.size).toBe(1)
      tracked.remove()
      expect(manager.size).toBe(0)
    })
  })

  describe('removeWhere', () => {
    it('removes decorations matching predicate', () => {
      manager.addAll([
        inline(1, 2, { class: 'keep' }),
        inline(3, 4, { class: 'remove' }),
        inline(5, 6, { class: 'remove' }),
        inline(7, 8, { class: 'keep' }),
      ])

      const removed = manager.removeWhere((dec) => (dec as InlineDecoration).attrs?.class === 'remove')

      expect(removed).toBe(2)
      expect(manager.size).toBe(2)
    })
  })

  describe('clear', () => {
    it('removes all decorations', () => {
      manager.addAll([inline(1, 2, {}), inline(3, 4, {})])

      manager.clear()
      expect(manager.size).toBe(0)
    })
  })

  describe('getDecorationSet', () => {
    it('returns DecorationSet with all decorations', () => {
      const d = doc(p('hello world'))
      manager.addAll([inline(1, 5, { class: 'a' }), inline(7, 12, { class: 'b' })])

      const set = manager.getDecorationSet(d)
      expect(set.size).toBe(2)
    })

    it('returns empty set when no decorations', () => {
      const d = doc(p('hello'))
      const set = manager.getDecorationSet(d)

      expect(set.isEmpty).toBe(true)
    })
  })

  describe('mapThrough', () => {
    it('maps decorations through a transaction', () => {
      const d = doc(p('hello world'))
      const state = EditorState.create({ doc: d, schema })

      manager.add(inline(7, 12, { class: 'a' })) // "world"

      // Insert "XX" at position 2
      const tr = state.tr().insertText('XX', 2)
      manager.mapThrough(tr)

      const set = manager.getDecorationSet(tr.doc)
      const dec = set.find()[0] as InlineDecoration
      expect(dec.from).toBe(9) // 7 + 2
      expect(dec.to).toBe(14) // 12 + 2
    })

    it('removes decorations that get deleted', () => {
      const d = doc(p('hello world'))
      const state = EditorState.create({ doc: d, schema })

      manager.add(inline(3, 6, { class: 'a' })) // "lo "

      // Delete the decorated range
      const tr = state.tr().delete(2, 8)
      manager.mapThrough(tr)

      expect(manager.size).toBe(0)
    })

    it('does nothing when doc unchanged', () => {
      const d = doc(p('hello'))
      const state = EditorState.create({ doc: d, schema })

      manager.add(inline(1, 5, { class: 'a' }))

      // Transaction that doesn't change the doc
      const tr = state.tr()
      manager.mapThrough(tr)

      const set = manager.getDecorationSet(d)
      const dec = set.find()[0] as InlineDecoration
      expect(dec.from).toBe(1)
      expect(dec.to).toBe(5)
    })

    it('handles multiple decorations', () => {
      const d = doc(p('hello world'))
      const state = EditorState.create({ doc: d, schema })

      manager.addAll([
        inline(1, 3, { class: 'a' }), // "el"
        inline(7, 12, { class: 'b' }), // "world"
        widget(5, () => null as any),
      ])

      // Insert at position 4
      const tr = state.tr().insertText('XX', 4)
      manager.mapThrough(tr)

      const set = manager.getDecorationSet(tr.doc)
      expect(set.size).toBe(3)

      const inlines = set.findInlineIn(0, 20)
      expect(inlines[0].from).toBe(1)
      expect(inlines[0].to).toBe(3)
      expect(inlines[1].from).toBe(9) // 7 + 2
      expect(inlines[1].to).toBe(14) // 12 + 2
    })

    it('handles typing inside a decorated range', () => {
      const d = doc(p('hello'))
      const state = EditorState.create({ doc: d, schema })

      // Decorate "ell" (positions 2-5)
      manager.add(inline(2, 5, { class: 'highlight' }))

      // Type "X" at position 3 (inside the decoration)
      const tr = state.tr().insertText('X', 3)
      manager.mapThrough(tr)

      const set = manager.getDecorationSet(tr.doc)
      const dec = set.find()[0] as InlineDecoration

      // Decoration should expand: "eXll" (positions 2-6)
      expect(dec.from).toBe(2)
      expect(dec.to).toBe(6)
    })

    it('handles typing at the start of a decorated range', () => {
      const d = doc(p('hello'))
      const state = EditorState.create({ doc: d, schema })

      manager.add(inline(2, 5, { class: 'highlight' }))

      // Type at position 2 (start of decoration)
      const tr = state.tr().insertText('X', 2)
      manager.mapThrough(tr)

      const set = manager.getDecorationSet(tr.doc)
      const dec = set.find()[0] as InlineDecoration

      // Decoration should shift right: positions 3-6
      expect(dec.from).toBe(3)
      expect(dec.to).toBe(6)
    })
  })
})

describe('collectDecorations', () => {
  it('collects decorations from viewProps.decorations function', async () => {
    const { collectDecorations } = await import('../src/view/propHelpers')

    const d = doc(p('hello'))
    const state = EditorState.create({ doc: d, schema })

    // Create a decorations function like what we pass via props
    const decorationsFn = (st: EditorState) => {
      return DecorationSet.create(st.doc, [widget(3, () => null as any, { key: 'test-widget' })])
    }

    const viewProps = { decorations: decorationsFn }
    const result = collectDecorations(state, viewProps)

    expect(result.size).toBe(1)
    expect(result.findWidgetsAt(3).length).toBe(1)
    expect(result.findWidgetsAt(3)[0].spec.key).toBe('test-widget')
  })

  it('returns empty set when no decorations function', async () => {
    const { collectDecorations } = await import('../src/view/propHelpers')

    const d = doc(p('hello'))
    const state = EditorState.create({ doc: d, schema })

    const result = collectDecorations(state, undefined)
    expect(result.isEmpty).toBe(true)
  })
})

describe('Widget positions in paragraph', () => {
  it('widget at end of paragraph content is found at correct position', () => {
    const d = doc(p('hello'))

    // Let's discover the actual positions
    const paragraph = d.child(0)
    console.log('doc.nodeSize:', d.nodeSize)
    console.log('paragraph.nodeSize:', paragraph.nodeSize)
    console.log('paragraph.content.size:', paragraph.content.size)

    // In our schema: doc contains paragraphs
    // doc.nodeSize = 2 (doc boundaries) + paragraph.nodeSize = 2 + 7 = 9
    expect(d.nodeSize).toBe(9)
    expect(paragraph.nodeSize).toBe(7) // 1 (open) + 5 (content) + 1 (close)
    expect(paragraph.content.size).toBe(5) // just the text content

    // The paragraph position within the doc
    // In a doc, child nodes start at position 1 (after doc opening)
    let paragraphPos = 0
    d.forEach((node, offset) => {
      if (node === paragraph) paragraphPos = offset
    })
    console.log('paragraphPos:', paragraphPos)

    // Position for widget at end of paragraph content:
    // contentStart = paragraphPos + 1
    // contentEnd = paragraphPos + 1 + content.size
    const contentEndPos = paragraphPos + 1 + paragraph.content.size
    console.log('contentEndPos:', contentEndPos)

    // Create widget at that position
    const set = DecorationSet.create(d, [widget(contentEndPos, () => null as any, { side: 1, key: 'end-widget' })])

    // Should be findable at that position
    const widgets = set.findWidgetsAt(contentEndPos)
    expect(widgets.length).toBe(1)
    expect(widgets[0].spec.key).toBe('end-widget')
  })

  it('widget created at range.to - 1 matches end of content position', () => {
    const d = doc(p('hello'))
    const paragraph = d.child(0)

    // Get the actual paragraph position
    let paragraphPos = 0
    d.forEach((node, offset) => {
      if (node === paragraph) paragraphPos = offset
    })

    // This simulates what getParagraphRange returns
    const range = { from: paragraphPos, to: paragraphPos + paragraph.nodeSize }
    console.log('range:', range)

    // Our decoration code uses range.to - 1
    const widgetPos = range.to - 1

    // The NodeView looks for widgets at: props.pos + 1 + props.node.content.size
    const nodeViewWidgetPos = paragraphPos + 1 + paragraph.content.size

    console.log('widgetPos (range.to - 1):', widgetPos)
    console.log('nodeViewWidgetPos:', nodeViewWidgetPos)

    // They should match!
    expect(widgetPos).toBe(nodeViewWidgetPos)
  })
})
