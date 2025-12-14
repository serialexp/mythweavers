# Solid Editor: A SolidJS-native Rich Text Editor

A from-scratch rich text editor built on SolidJS's fine-grained reactivity, inspired by ProseMirror's architecture but adapted to SolidJS idioms.

## Status: Phase 1 - Document Model Complete

### Prerequisites
- [x] Clone ProseMirror source for reference (`/home/bart/Projects/prosemirror`)
  - `prosemirror-model` - Document model, schema, nodes, marks
  - `prosemirror-state` - Editor state, selection, transactions
  - `prosemirror-transform` - Document transformations, steps
  - `prosemirror-view` - DOM rendering, input handling
- [ ] Study how ProseMirror handles contenteditable quirks
- [ ] Understand the transaction/step model

### Document Model - DONE
Package: `packages/solid-editor`
- [x] Schema, NodeType, MarkType
- [x] Node, TextNode classes
- [x] Fragment class
- [x] Mark class
- [x] ResolvedPos, NodeRange classes
- [x] Test builder utility (like prosemirror-test-builder)
- [x] 43 tests passing (ported from prosemirror-model)

---

## Architecture Overview

### Core Concepts to Port

**1. Document Model** (`solid-editor/model`)
- Schema definition (node types, mark types)
- Document tree structure (nodes, fragments)
- Content expressions (what can contain what)
- Positions and indexing

**2. State Management** (`solid-editor/state`)
- SolidJS store for document state
- Selection (text, node, all)
- Transaction batching for undo/redo

**3. Transforms** (`solid-editor/transform`)
- Steps (insert, delete, replace, add/remove mark)
- Step mapping (position tracking through changes)
- Invertible operations for undo

**4. View Layer** (`solid-editor/view`)
- Contenteditable integration
- Input handling (typing, IME, composition)
- Selection synchronization (DOM <-> model)
- Node views as SolidJS components

---

## SolidJS Advantages

### What We Gain
- **Fine-grained reactivity**: No need for manual diffing/patching
- **Native components**: Node views are just SolidJS components
- **Simpler state**: SolidJS stores replace EditorState + EditorView split
- **No plugin system needed**: Just compose with SolidJS patterns
- **Smaller surface area**: Only implement what we need

### Architectural Differences from ProseMirror
| ProseMirror | Solid Editor |
|-------------|--------------|
| Immutable state + transactions | SolidJS store with `produce` |
| Plugin system | Component composition / context |
| Decorations | Conditional rendering |
| NodeViews (escape hatch) | Native SolidJS components |
| Manual DOM reconciliation | SolidJS handles it |

---

## Implementation Phases

### Phase 1: Minimal Viable Editor
- [x] Basic document model (doc > paragraph > text)
- [ ] Text input handling
- [ ] Cursor movement
- [ ] Basic selection
- [x] Bold/italic marks (in model, not view yet)

### Phase 2: Core Editing
- [ ] Copy/paste (plain text)
- [ ] Undo/redo
- [ ] Multiple paragraphs
- [ ] Selection across paragraphs
- [ ] Backspace/delete edge cases

### Phase 3: Rich Content
- [ ] Custom node types (headings, blockquotes)
- [ ] Inline nodes (mentions, links)
- [ ] Copy/paste with formatting
- [ ] Drag and drop

### Phase 4: Production Features
- [ ] IME/composition handling
- [ ] Mobile keyboard support
- [ ] Collaborative editing (CRDT?)
- [ ] Performance optimization

---

## ProseMirror Source Reference

Key files to study:

```
prosemirror-model/src/
├── schema.ts      # Schema definition
├── node.ts        # Node class
├── fragment.ts    # Fragment (list of nodes)
├── mark.ts        # Mark class
├── content.ts     # Content expressions
└── index.ts       # Position helpers

prosemirror-state/src/
├── state.ts       # EditorState
├── selection.ts   # Selection types
├── transaction.ts # Transaction
└── plugin.ts      # Plugin system (skip)

prosemirror-transform/src/
├── step.ts        # Step base class
├── replace_step.ts
├── mark_step.ts
├── map.ts         # Position mapping
└── transform.ts   # Transform class

prosemirror-view/src/
├── index.ts       # EditorView
├── input.ts       # Input handling (THE HARD PART)
├── selection.ts   # DOM selection sync
├── domobserver.ts # Mutation observer
└── capturekeys.ts # Keyboard handling
```

---

## Browser Quirks to Watch For

Things ProseMirror handles that we'll need to copy:

- [ ] Android GBoard backspace behavior
- [ ] Samsung keyboard composition
- [ ] iOS autocorrect interactions
- [ ] IME composition (CJK input)
- [ ] Firefox contenteditable differences
- [ ] Safari selection edge cases
- [ ] Clipboard HTML parsing inconsistencies
- [ ] Drag-and-drop across browsers

---

## Questions to Resolve

1. **Contenteditable vs Canvas?**
   - Contenteditable: Browser handles text rendering, we handle structure
   - Canvas: Full control but reimplement everything (text shaping, selection, cursor)
   - **Leaning toward**: Contenteditable (like ProseMirror)

2. **State structure?**
   - One big store vs multiple granular stores
   - How to make undo/redo efficient with SolidJS stores

3. **When to sync DOM -> Model?**
   - On every input event?
   - On blur?
   - Debounced?

---

## Notes

### 2024-12-14: Document Model Ported

Ported the core document model from prosemirror-model to `packages/solid-editor`:

**What we built:**
- `Schema` - defines node types and mark types
- `NodeType` / `MarkType` - type descriptors
- `Node` / `TextNode` - actual document nodes
- `Fragment` - list of child nodes
- `Mark` - formatting marks (bold, italic, etc.)

**Simplifications made:**
- Skipped full content expression parsing (the complex regex-based validator)
- Using simpler content validation for now
- No DOM parsing/serialization yet (from_dom.ts, to_dom.ts)
- No ResolvedPos yet (needed for sophisticated position handling)

**Test builder pattern works great:**
```typescript
const myDoc = doc(p("Hello ", em("world"), "!"));
```

**Next steps:**
1. Add ResolvedPos for position resolution
2. Add transforms (steps) for document modifications
3. Build the view layer with SolidJS components
