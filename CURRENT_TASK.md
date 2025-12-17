# Current Task: UI Design System

## Current: Solid Editor Selection & Rendering Issues (Dec 17, 2025) - IN PROGRESS

### Issue 1: Paragraph background flashing on typing - FIXED

**Symptom:** When typing in the editor, the paragraph background color flashes/blinks.

**Root cause:** Two issues causing component recreation instead of in-place updates:
1. `BlockChildren` used `<For>` which tracks items by reference identity. Since `getChildren()` creates new objects on every call, all components were recreated.
2. `NodeView` used SolidJS `<Switch>/<Match>` which re-evaluates conditions reactively, potentially triggering recreation even when the same branch matches.

**Fix applied:**
1. Changed `<For>` to `<Index>` in `BlockChildren` - `<Index>` tracks by array index, so when the paragraph node object changes, the component updates in place instead of being recreated.
2. Changed `<Switch>/<Match>` to plain JavaScript `switch` in `NodeView` - runs once at component mount. Since a node's type never changes (paragraph stays paragraph), this is safe and avoids reactive re-evaluation.

**Files modified:**
- `packages/solid-editor/src/view/NodeView.tsx`

### Issue 2: Position info becoming stale - FIXED

**Problem:** After typing, clicking in the editor would place cursor at wrong position. Debug logs showed `domFromPos` walking to doc element with stale `nodeSize`.

**Root cause:** `setPosInfo()` was only called in ref callbacks (which run once on mount). When document changed, position info stored in WeakMap became stale.

**Fix applied:** Added `createEffect` in `DocView`, `ParagraphView`, `HeadingView`, `DefaultNodeView`, and custom `ParagraphStateView` to update position info reactively whenever `props.pos` or `props.node` changes.

### Issue 3: Block node content position offset - FIXED

**Problem:** Clicking in text placed cursor at wrong position (off by 1 per paragraph depth).

**Root cause:** Block node views were passing `startPos={props.pos}` to `InlineContent`, but for block nodes content starts at `pos + 1` (after the opening token). Only `doc` node has no opening token.

**Fix applied:** Changed `ParagraphView`, `HeadingView`, `DefaultNodeView`, and custom `ParagraphStateView` to pass `startPos={props.pos + 1}` to `InlineContent`.

### Other fixes in this session:

1. **Menu disappearing on focus loss** - Added `isFocused` prop to `ParagraphActionsMenu` and `InlineMenu`, menus hide when editor loses focus
2. **Button pressed state** - Added `manualPress` prop to Button component for manual press tracking (needed when `preventDefault` blocks CSS `:active`)
3. **Ghost button pressed styling** - Added `pressedGhostStyle` with proper specificity to override hover state

---

## Previous: Solid Editor Bug Fixes & Improvements (Dec 17, 2025) - COMPLETE

### Theme-Aware Portals
- Created `ThemeClassContext` so portals can inherit the correct theme class
- Updated `ThemeProvider` and `ThemeComparison` to provide context
- `InlineMenu` and `ParagraphActionsMenu` now apply theme class to portal content
- Can use `ThemeComparison` in stories while portals still get correct styling

### Selection Bug Fixes

1. **Off-by-one selection bug** - Fixed in `NodeView.tsx`
   - `DocView` was passing `startPos={props.pos + 1}` to `BlockChildren`
   - But `doc` node has no opening token (unlike other block nodes)
   - Changed to `startPos={props.pos}` - selection now marks correct text

2. **Menu disappearing on click** - Fixed in `InlineMenu.tsx`
   - Added `onMouseDown={(e) => e.preventDefault()}` to all buttons
   - Prevents browser from modifying selection when clicking outside contenteditable

3. **Selection jumping to position 1 on toggle** - Fixed in `EditorView.tsx`
   - When removing marks, DOM changes caused `selectionchange` to fire
   - `handleSelectionChange` was processing stale DOM selection
   - Added `on()` with `defer: false` to set `updatingSelection = true` synchronously when `props.state` changes
   - This blocks `selectionchange` events during SolidJS DOM updates

### Paragraph Actions Menu Fixes

1. **Positioning** - Fixed viewport-relative coordinates
   - Was incorrectly adding scroll offsets with `position: fixed`
   - Now uses `rect.top` and `rect.left` directly from `getBoundingClientRect()`

2. **Scroll tracking** - Menu stays anchored to paragraph
   - Added scroll event listener that updates position on scroll
   - Uses `capture: true` to catch scroll events on any scrollable container

3. **Story handlers** - Added working action handlers to `Editor.story.tsx`
   - Move up/down (reorders paragraphs)
   - Delete paragraph
   - Set state (draft/revise/ai/final)

### Debug Logging Added (to be cleaned up)
- `InlineMenu.tsx` - toggleMark logging
- `transform.ts` - addMark logging

---

## Previous: Block Renderers Investigation (Dec 15, 2025) - RESOLVED

### Conclusion: No New Feature Needed

After investigating ProseMirror's approach, we determined that **block renderers are not needed as a separate system**. The existing primitives handle all use cases:

1. **NodeViews** (`nodeViews` prop) - Already allows custom rendering per node type. Consumers can check `node.attrs` to vary rendering within a type.

2. **Transform.setBlockType()** - Already exists for changing block types (paragraph → heading, etc.)

3. **Node Decorations** - Already supported for transient styling (highlighting current paragraph, etc.)

**The pattern for block styling:**
- **Persistent styles** (saved with document): Store in `node.attrs`, render via nodeViews
- **Transient styles** (UI state): Use node decorations
- **Block type changes** (paragraph → heading): Use `tr.setBlockType()`

Any higher-level commands (like `toggleHeading()`, `makeBlockquote()`) are consumer-level concerns or separate packages, following ProseMirror's pattern where `prosemirror-commands` is separate from core.

---

## Previous: Solid Editor Plugins (Dec 16, 2025) - COMPLETE

Implemented plugins for the solid-editor story editor wrapper:

1. **Active Paragraph Plugin** (`plugins/activeParagraph.ts`)
   - Tracks cursor position, adds `.active-paragraph` class decoration

2. **Paragraph State Plugin** (`plugins/paragraphState.tsx`)
   - Custom nodeView with `data-state`, `data-extra`, `id` attributes

3. **Paragraph Actions Menu** (`plugins/paragraphActions.tsx`)
   - Floating SolidJS component with move/delete/AI/state actions

4. **Assign ID Plugin** (`plugins/assignId.ts`)
   - Auto-assigns UUIDs to paragraphs via `appendTransaction`

5. **Added `setNodeMarkup()`** to solid-editor Transform class

**Decision:** AI suggestions will use a popup/modal approach rather than inline decorations (simpler, same UX benefit).

---

## Next Up: Phase 4 - Rich Content

**Phase 4 items to evaluate:**

1. **Inline nodes (mentions, links)** - May need view layer work for editable inline nodes
2. **Copy/paste with formatting** - Preserve marks when pasting HTML

**Phase 5 items:**
- Mobile keyboard support
- Performance optimization

---

## Previous Session (Dec 14, 2025) - Phase 2: Core Editing Complete

### Completed: Phase 2 Core Editing

All Phase 2 features implemented and tested (362 total tests passing):

1. **Enter Key / Split Block** (`src/commands/editing.ts`)
   - `splitBlock` command splits paragraphs at cursor
   - `splitBlockKeepMarks` variant preserves active marks
   - Handles selection deletion before split
   - Cursor positioned at start of new paragraph

2. **Backspace/Delete Edge Cases** (`src/commands/editing.ts`)
   - `joinBackward` joins with previous block at start of paragraph
   - `joinForward` joins with next block at end of paragraph
   - `deleteBackward` / `deleteForward` with proper boundary handling
   - Correct `findCutBefore` / `findCutAfter` position finding

3. **Selection Across Paragraphs**
   - Cross-paragraph selections work correctly
   - Delete spanning paragraphs merges content
   - 28 editing command tests

4. **History Plugin** (`src/plugins/history.ts`) - Full ProseMirror-compatible
   - `Branch` class holds undo/redo stacks with `Item` entries
   - `HistoryState` tracks done/undone branches with timing info
   - Step inversion for undo (`step.invert(doc)`)
   - Transaction grouping by time (500ms) and adjacency
   - Selection bookmark restoration
   - `addToHistory: false` metadata support
   - `rebased()` method for future collaboration support
   - Step merging for efficiency
   - Commands: `undo`, `redo`, `undoDepth`, `redoDepth`, `closeHistory`
   - 15 history tests

5. **Copy/Paste** (`src/view/EditorView.tsx`)
   - Copy extracts text with `\n\n` between paragraphs
   - Cut copies then deletes selection
   - Paste single line as text, multi-line creates paragraph nodes
   - Proper clipboard event handling

6. **Plugin State Management** (`src/state/state.ts`)
   - `pluginStates` storage in EditorState
   - Plugin state initialization via `state.init()`
   - Plugin state updates via `state.apply()` on transactions
   - `getPluginState()` retrieval

### Files Created/Modified

```
packages/solid-editor/
├── src/commands/
│   ├── editing.ts        # NEW: splitBlock, joinBackward, joinForward, etc.
│   └── index.ts          # Modified: Export editing commands, add to keymap
├── src/plugins/
│   ├── history.ts        # NEW: Full history plugin with undo/redo
│   └── index.ts          # NEW: Plugin exports
├── src/state/
│   └── state.ts          # Modified: Plugin state management
├── src/view/
│   └── EditorView.tsx    # Modified: Copy/cut/paste handlers
├── src/index.ts          # Modified: Export plugins
├── test/
│   ├── editing.test.ts   # NEW: 28 editing command tests
│   └── history.test.ts   # NEW: 15 history plugin tests
```

### Phase 2 Complete!

All core editing features implemented:
- Document model, transforms, state, plugins (Phase 1)
- Split/join paragraphs (Enter, Backspace at boundaries)
- Full undo/redo with collaboration-ready architecture
- Copy/paste with multi-paragraph support
- 362 tests passing

---

## Previous Session (Dec 14, 2025) - Browser Testing

### Completed: Cursor Movement Commands

1. **Commands Module** (`src/commands/`)
   - Created comprehensive cursor commands: `cursorLeft`, `cursorRight`, `cursorUp`, `cursorDown`
   - Line navigation: `cursorLineStart`, `cursorLineEnd`
   - Document navigation: `cursorDocStart`, `cursorDocEnd`
   - Word navigation: `cursorWordLeft`, `cursorWordRight`

2. **Selection Extension Commands**
   - `selectLeft`, `selectRight`, `selectUp`, `selectDown`
   - `selectLineStart`, `selectLineEnd`
   - `selectDocStart`, `selectDocEnd`, `selectAll`
   - `selectWordLeft`, `selectWordRight`

3. **Base Keymap**
   - `baseKeymap` with standard arrow key bindings
   - `macKeymap` with Mac-specific additions (Ctrl+A/E for line start/end)

4. **Unit Tests**: 33 cursor tests (319 total tests passing)

### Completed: Browser Integration Tests

**Setup completed:**
- Installed `@vitest/browser`, `@vitest/browser-playwright`, `playwright`, `@solidjs/testing-library`
- Created `vitest.browser.config.ts` for browser test configuration
- Added `test:browser` and `test:browser:run` npm scripts
- Created `test/cursor.browser.test.tsx` with 16 browser tests

**Current status:** 16/16 browser tests passing

**Resolved issues:**

1. **Mod key platform handling:** The `Mod` modifier maps to `Meta` on Mac but `Ctrl` on Linux/Windows. Browser tests now detect platform and use the correct modifier key.

2. **DOM selection boundary limitations:** The browser's DOM cannot represent document positions 0 (before first paragraph) or `doc.content.size` (after last paragraph). When `selectAll` sets selection from 0 to size, the DOM-to-model sync adjusts these to the first/last representable text positions. Tests now account for this with range-based assertions.

**Test design:**
- Tests start from initial cursor position (1)
- Use commands like `Home` that work regardless of starting position
- Check bounds rather than exact positions for forward movement
- Platform-aware modifier key detection for cross-platform testing

### Files Created/Modified

```
packages/solid-editor/
├── src/commands/
│   ├── cursor.ts          # NEW: All cursor movement commands
│   └── index.ts           # NEW: Exports + baseKeymap, macKeymap
├── src/index.ts           # Modified: Added commands export
├── src/transform/index.ts # Modified: Fixed Mappable type export for browser
├── test/
│   ├── cursor.test.ts     # NEW: 33 unit tests for cursor commands
│   └── cursor.browser.test.tsx  # NEW: 16 browser integration tests
├── vitest.config.ts       # Modified: Exclude browser tests
├── vitest.browser.config.ts     # NEW: Browser test config
└── package.json           # Modified: Added browser test deps and scripts
```

### Phase 1 Complete!

All browser tests passing. Phase 1 (Minimal Viable Editor) is now complete:
- Document model with schema, nodes, marks, positions
- Transform system with steps, mapping
- State management with selections, transactions, plugins
- Plugin props (handleKeyDown, handleTextInput, handleClick, etc.)
- Decoration system (widget, inline, node, span) with auto-mapping
- Commands (cursor movement, selection extension, word/line/doc navigation)
- Keymap system with platform-aware Mod handling
- View layer with SolidJS components
- Browser integration tests (16 tests)
- Unit tests (319 tests)

---

## Previous Session (Dec 14, 2025)

Completed **Phase 3: Plugin System** for solid-editor:

1. **Plugin Props System**
   - Added `EditorProps` interface with handlers (handleKeyDown, handleTextInput, handleClick, etc.)
   - Added `props` field to `PluginSpec`
   - Implemented `someProp()` and `callPropHandlers()` for prop resolution
   - Integrated with EditorView for keyboard, text input, and click handling

2. **Decoration System** (4 types)
   - `widget(pos, component)` - Render SolidJS components at positions
   - `inline(from, to, attrs)` - Add attributes to text spans
   - `node(from, to, attrs)` - Add attributes to block elements
   - `span(from, to, tagOrRender)` - Wrap content in custom elements/components

3. **Tracked Decorations** (SolidJS advantage!)
   - `DecorationManager` stores decorations and auto-maps through transactions
   - No manual `map()` calls needed - positions adjust automatically
   - `useEditor().addDecoration()` for easy usage
   - Decorations removed when their content is deleted

4. **Tests**: Added 47 decoration tests

---

## Context

We've built a design system in `/packages/ui` using:
- SolidJS
- Vanilla Extract CSS
- Histoire for component documentation
- Dual themes: Chronicle (dark/fantasy) and Starlight (light/sci-fi)

---

## Completed Components

### Tier 1: Foundation
| Component | Features |
|-----------|----------|
| **Button** | Variants (primary, secondary, ghost, danger), sizes (sm, md, lg), iconOnly mode, spin effect on hover |
| **IconButton** | Circular icon button, variants, sizes, scale on hover |
| **Input** | Sizes, focus/disabled/invalid states |
| **Textarea** | Sizes, resize options, states |
| **Modal** | Portal-based, focus trap, escape/backdrop close, sizes, footer support, full a11y |

### Tier 2: Interactive Patterns
| Component | Features |
|-----------|----------|
| **Select** | Styled native select, sizes, custom dropdown arrow |
| **Dropdown** | Action menu with DropdownItem, DropdownDivider, alignRight, icon/danger support |
| **FormField** | Label, required/optional indicators, help text, error messages |

### Tier 3: Feedback & Display
| Component | Features |
|-----------|----------|
| **Tabs** | Tabs, TabList, Tab, TabPanel - underline/pills variants, icons, disabled |
| **Spinner** | Sizes (sm, md, lg, xl), accessible |
| **Badge** | Variants (default, primary, secondary, success, warning, error, info), sizes, icons |
| **Toast** | Variants, auto-dismiss, ToastContainer, title/message, close button |

### Tier 4: Layout Components
| Component | Features |
|-----------|----------|
| **Stack** | Vertical/horizontal flex, HStack/VStack shortcuts, gap sizes (xs-2xl), align/justify, wrap support |
| **Container** | Max-width sizes (sm-2xl, full), horizontal padding options, center content mode |
| **Grid** | Column counts (1-12, auto-fit), row counts, gap sizes, GridItem with col/row spanning |
| **Divider** | Horizontal/vertical, solid/dashed/dotted variants, color options (subtle/default/strong), spacing |

### Editor Components (moved from separate package)
| Component | Features |
|-----------|----------|
| **ProseMirrorEditor** | Full-featured rich text editor with paragraph management |
| **SceneEditor** | High-level scene editor with AI integration hooks |
| **Editor** | Simple single-paragraph editor |
| **RewriteModal** | Modal for custom rewrite instructions |
| **GenerateBetweenModal** | Modal for generating content between paragraphs |

---

## Theme System

- **Chronicle** (dark/fantasy): Warm blacks, parchment/amber, gold accents
- **Starlight** (light/sci-fi): Light backgrounds, blue primary, red secondary
- Global styles scoped to theme containers (won't affect non-themed UI)
- Design tokens via `createThemeContract`
- Separate theme export (`@mythweavers/ui/theme`) for build-time usage without SolidJS

---

## Package Exports

```typescript
// Full package with all components
import { Button, Modal, ProseMirrorEditor } from '@mythweavers/ui'

// Theme-only (safe for build-time/vanilla-extract)
import { tokens, chronicleTheme, starlightTheme } from '@mythweavers/ui/theme'

// Styles
import '@mythweavers/ui/styles'
```

---

## Bundle Size

- CSS: 32.5 kB (gzip: 5.9 kB)
- JS: 424.7 kB (gzip: 114.9 kB) - includes ProseMirror
- Theme only: 3.1 kB (gzip: 0.9 kB)

---

## Files of Interest

- `/packages/ui/src/components/` - All components including Editor
- `/packages/ui/src/theme/` - Token system and themes
- `/packages/ui/src/components/Editor/` - ProseMirror-based editor
- `/packages/ui/histoire.config.ts` - Histoire configuration
- `/packages/ui/src/story-utils/ThemeComparison.tsx` - Side-by-side theme display

---

## Solid Editor (`packages/solid-editor`)

A from-scratch rich text editor built on SolidJS's fine-grained reactivity, inspired by ProseMirror's architecture but adapted to SolidJS idioms.

### Completed Modules

| Module | Status | Tests | Features |
|--------|--------|-------|----------|
| **Model** | Complete | 79 tests | Schema, NodeType, MarkType, Node, TextNode, Fragment, Mark, ResolvedPos, Slice |
| **Transform** | Complete | 90 tests | Step, StepMap, Mapping, ReplaceStep, ReplaceAroundStep, AttrStep, MarkSteps, Transform, structure helpers |
| **State** | Complete | 37 tests | EditorState, Transaction, Selection (Text/Node/All), Plugin system |
| **Decorations** | Complete | 47 tests | DecorationSet, widget/inline/node/span, DecorationManager, auto-mapping |
| **Commands** | Complete | 33 tests | Cursor movement, selection extension, word/line/doc navigation, baseKeymap |
| **View** | Initial | - | EditorView, NodeView, TextView, selection sync, input handling |

**Total: 319 tests passing**

### Architecture

```
solid-editor/src/
├── model/       # Document model (schema, nodes, marks, positions)
├── transform/   # Document transformations (steps, mapping)
├── state/       # Editor state, selection, transactions, plugins
│   └── plugin.ts        # Plugin, PluginSpec, EditorProps interface
├── commands/    # Editing commands (cursor, selection, etc.)
│   ├── cursor.ts        # Cursor movement & selection extension commands
│   └── index.ts         # Exports + baseKeymap, macKeymap
├── keymap/      # Keyboard shortcut handling
│   └── index.ts         # keymap(), keydownHandler(), Command type
└── view/        # SolidJS components for rendering and input
    ├── EditorView.tsx       # Main editor component
    ├── NodeView.tsx         # Renders block nodes (doc, paragraph, heading, etc.)
    ├── TextView.tsx         # Renders inline content with marks and decorations
    ├── context.ts           # Editor context for nested components
    ├── selection.ts         # DOM <-> model selection sync
    ├── propHelpers.ts       # someProp(), callPropHandlers(), collectDecorations()
    ├── decoration.ts        # Decoration types (widget, inline, node, span)
    └── DecorationManager.ts # Tracked decorations with auto-mapping
```

### Remaining Work

**Phase 1: Minimal Viable Editor** ✅ Complete
- [x] Basic document model
- [x] Bold/italic marks (in model)
- [x] View layer with SolidJS components
- [x] Text input handling (beforeinput event)
- [x] Basic selection sync (DOM <-> model)
- [x] Keymap system (ProseMirror-compatible)
- [x] Cursor movement (arrow keys) - `cursorLeft/Right/Up/Down`, `cursorLineStart/End`, `cursorDocStart/End`, `cursorWordLeft/Right`
- [x] Selection extension - `selectLeft/Right/Up/Down`, `selectLineStart/End`, `selectDocStart/End`, `selectAll`, `selectWordLeft/Right`
- [x] Base keymap with standard bindings
- [x] Browser testing / edge case fixes (16 browser tests passing)

**Phase 2: Core Editing** ✅ Complete
- [x] Copy/paste (plain text with multi-paragraph support)
- [x] Undo/redo (full ProseMirror-compatible history plugin with rebasing)
- [x] Multiple paragraphs (Enter key splitting via splitBlock)
- [x] Selection across paragraphs
- [x] Backspace/delete edge cases (joinBackward/joinForward)

**Phase 3: Plugin System** ✅ Complete
- [x] Basic Plugin/PluginKey/StateField
- [x] Plugin props (handleKeyDown, handleTextInput, handleClick, handleDoubleClick, handleTripleClick)
- [x] EditorProps interface with handler types
- [x] someProp() / callPropHandlers() for prop resolution
- [x] Editable prop support via plugins
- [x] Decoration system (widget, inline, node, span) with 47 tests
  - Widget decorations render SolidJS components at positions
  - Inline decorations add attributes to text spans
  - Node decorations add attributes to block elements
  - Span decorations wrap content in custom elements/components
  - DecorationSet with efficient lookup and mapping
  - **Tracked decorations** that auto-adjust positions on document changes
  - DecorationManager with `addDecoration()` / `removeDecoration()` API
- See `packages/solid-editor/PLUGIN_PROPS_PLAN.md` for original plan

**Phase 4: Rich Content**
- [ ] Custom node types (headings, blockquotes)
- [ ] Inline nodes (mentions, links)
- [ ] Copy/paste with formatting

**Phase 5: Production Features**
- [x] IME/composition handling (basic)
- [ ] Mobile keyboard support
- [ ] Performance optimization

### Key Advantages over ProseMirror

| ProseMirror | Solid Editor |
|-------------|--------------|
| Immutable state + transactions | SolidJS store with `produce` |
| Plugin system | Component composition / context |
| Decorations require manual `map()` on every transaction | **Tracked decorations auto-adjust positions** |
| Widget decorations return DOM nodes | **Widget decorations return JSX components** |
| NodeViews (escape hatch) | Native SolidJS components |
| Manual DOM reconciliation | SolidJS handles it |
| Span decorations need complex setup | **`span(5, 15, (children) => <Tooltip>{children()}</Tooltip>)`** |

### Decoration API

```typescript
// Four decoration types
widget(pos, () => <Cursor />)                    // Insert component at position
inline(from, to, { class: "highlight" })         // Add attributes to text
node(from, to, { class: "selected" })            // Add attributes to block
span(from, to, "mark", { class: "yellow" })      // Wrap in element
span(from, to, (children) => <Tooltip>{children()}</Tooltip>)  // Wrap in component

// Tracked decorations (auto-adjust on document changes)
const { addDecoration, decorations } = useEditor()
const tracked = addDecoration(span(20, 40, "mark"))
// User types inside range... decoration automatically expands!
tracked.remove()  // Clean up when done

// Plugin-provided decorations (for computed/derived decorations)
new Plugin({
  props: {
    decorations: (state) => DecorationSet.create(state.doc, [...])
  }
})
```

---

## UI Package Next Steps

### Enhancements
- Keyboard navigation for Dropdown (arrow keys)
- `prefers-reduced-motion` support
- More Toast positioning options (top, bottom-left, etc.)

### Additional Components (if needed)
- Avatar
- Card
- Tooltip
- Progress bar
- Switch/Toggle
