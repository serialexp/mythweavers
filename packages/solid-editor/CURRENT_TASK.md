# Solid Editor - Current Task Tracking

## Project Goal

**Build a SolidJS-native rich text editor where extending the UI is as simple as writing components.**

ProseMirror is powerful but extending its UI is painful. NodeViews require manual DOM manipulation (`dom`, `contentDOM`, `update()`, `destroy()`). Decorations are imperative. Plugins manage state awkwardly. As soon as you have more than a basic set of plugins, complexity explodes.

**Solid Editor fixes this by making everything SolidJS-native:**

- **NodeViews are just components** - Write `<ImageNode src={attrs.src} />` instead of manual DOM creation
- **Marks render as components** - `<LinkMark href={attrs.href}>{children}</LinkMark>` with reactive props
- **Plugins use signals/stores** - Standard SolidJS state management, not PM's `PluginState` pattern
- **Decorations are declarative JSX** - Compose UI naturally instead of building decoration specs
- **Everything is reactive** - Fine-grained updates, not document-wide re-renders

The Model and Transform layers are intentionally close to ProseMirror - these are battle-tested algorithms. The innovation is in the View layer where SolidJS reactivity makes plugin/extension development dramatically simpler.

---

## Completed

### Model Layer (`src/model/`)
- [x] `compareDeep.ts` - Deep comparison utility
- [x] `types.ts` - Attrs type
- [x] `mark.ts` - Mark class
- [x] `fragment.ts` - Fragment class
- [x] `node.ts` - Node and TextNode classes
- [x] `schema.ts` - Schema, NodeType, MarkType, ContentMatch
- [x] `resolvedpos.ts` - ResolvedPos and NodeRange
- [x] `slice.ts` - Slice, ReplaceError, replace algorithm

### Transform Layer (`src/transform/`)
- [x] `map.ts` - StepMap, Mapping, MapResult, Mappable interface
- [x] `step.ts` - Step base class, StepResult
- [x] `replace_step.ts` - ReplaceStep
- [x] `replace_around_step.ts` - ReplaceAroundStep for wrapping/lifting
- [x] `attr_step.ts` - AttrStep, DocAttrStep for changing node attributes
- [x] `mark_step.ts` - AddMarkStep, RemoveMarkStep, AddNodeMarkStep, RemoveNodeMarkStep
- [x] `structure.ts` - Structure helpers (liftTarget, findWrapping, canSplit, canJoin, etc.)
- [x] `transform.ts` - Transform class with full API (replace, delete, insert, addMark, removeMark, wrap, lift, split, join, setBlockType)

### State Layer (`src/state/`)
- [x] `selection.ts` - Selection, TextSelection, NodeSelection, AllSelection
- [x] `transaction.ts` - Transaction (extends Transform with selection/metadata)
- [x] `state.ts` - EditorState
- [x] `plugin.ts` - Plugin, PluginKey, PluginSpec

### Tests (239 passing)
- [x] `test/node.test.ts` - 28 tests
- [x] `test/resolve.test.ts` - 15 tests
- [x] `test/slice.test.ts` - 36 tests
- [x] `test/mapping.test.ts` - 10 tests
- [x] `test/step.test.ts` - 21 tests
- [x] `test/transform.test.ts` - 31 tests
- [x] `test/mark_step.test.ts` - 18 tests
- [x] `test/replace_around_step.test.ts` - 10 tests
- [x] `test/attr_step.test.ts` - 20 tests
- [x] `test/structure.test.ts` - 13 tests
- [x] `test/state.test.ts` - 37 tests

---

## TODO

### Transform Layer - Additional Steps
- [x] `ReplaceAroundStep` - Replace while preserving a gap
- [x] `AttrStep` - Change node attributes
- [x] `DocAttrStep` - Change document attributes

### Transform Layer - High-level API
- [x] `Transform` class - Basic version with replace, delete, insert, insertText
- [x] Transform mark methods (`addMark`, `removeMark`) - integrated with Transform class
- [x] Structure helpers (`lift`, `wrap`, `setBlockType`, `split`, `join`)
- [ ] Advanced replace helpers (`replaceRange`, `deleteRange`) - simplified `replaceStep` done

### State Layer (`src/state/`)
- [x] `EditorState` - Immutable editor state
- [x] `Transaction` - Extends Transform with selection and metadata
- [x] `Selection` - TextSelection, NodeSelection, AllSelection
- [x] `Plugin` - Plugin system for extending behavior

### View Layer (`src/view/`) - **The Core Innovation**
- [x] `EditorView` - Main view component using SolidJS reactive primitives
- [x] `NodeView` components - Nodes render as SolidJS components, not manual DOM
- [x] `MarkView` components - Marks render as wrapper components with reactive props
- [x] Decorations as JSX - Declarative decoration rendering
- [x] Input handling (keyboard, mouse, clipboard, drag/drop)
- [x] Fine-grained reactivity - Only re-render what changed, not the whole document
- [x] `DebugOverlay` - Debug UI showing cursor position, document tree, and JSON output

### Commands (`src/commands/`)
- [ ] Basic editing commands (delete, insert, newline)
- [ ] History commands (undo, redo)
- [ ] Mark commands (toggle bold, italic, etc.)

### Additional
- [ ] Keymap handling
- [ ] Input rules (auto-formatting)
- [ ] History plugin (undo/redo stack)
- [ ] Collaborative editing support (nice to have)

---

## Recent Bug Fixes

### Position Calculation Fix (Dec 2024)

Fixed an off-by-one error in cursor position calculation that caused characters to be inserted at the wrong position when there are inline atoms (mentions) in the document.

**Root Cause:**
- `BlockChildren` passes `nodeStart = parentContentStart + offset` to child blocks, which is already the **content start position**
- `posFromDOM` and textblock views (ParagraphView, HeadingView) were incorrectly adding +1 to this, treating it as the node opening position

**Files Changed:**
- `src/view/selection.ts` - Removed +1 adjustment in `posFromDOM` and `domFromPos` for block nodes
- `src/view/NodeView.tsx` - Fixed `ParagraphView`, `HeadingView`, and `DefaultNodeView` to pass `startPos={props.pos}` to `InlineContent` (not `props.pos + 1`)

**Debug Overlay Added:**
- New `DebugOverlay` component (`src/view/DebugOverlay.tsx`) shows:
  - Current cursor position
  - Document tree with node types, positions, and sizes
  - Cursor indicator (`|`) within text nodes
  - Range selection highlighting
  - JSON output with copy button
- Enable via `<EditorView debug />` or `<EditorView debug="top-right" />`

---

## Design Notes

- **Model/Transform layers mirror ProseMirror** - Proven algorithms, no need to reinvent
- **View layer is the innovation** - SolidJS components replace manual DOM manipulation
- **Test-driven approach** - Port ProseMirror tests to vitest to ensure correctness
- **Simplified content validation** - Compared to ProseMirror's full ContentMatch state machine
- **Plugin API designed for components** - Plugins return JSX, use signals, compose naturally
