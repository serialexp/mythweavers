# Solid Editor - Current Task Tracking

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
- [x] `transform.ts` - Transform class with basic methods (replace, replaceWith, delete, insert, insertText)

### Tests (128 passing)
- [x] `test/node.test.ts` - 28 tests
- [x] `test/resolve.test.ts` - 15 tests
- [x] `test/slice.test.ts` - 36 tests
- [x] `test/mapping.test.ts` - 10 tests
- [x] `test/step.test.ts` - 21 tests
- [x] `test/transform.test.ts` - 18 tests

---

## TODO

### Transform Layer - Additional Steps
- [ ] `ReplaceAroundStep` - Replace while preserving a gap
- [ ] `AddMarkStep` - Add a mark to a range
- [ ] `RemoveMarkStep` - Remove a mark from a range
- [ ] `AddNodeMarkStep` - Add a mark to a node
- [ ] `RemoveNodeMarkStep` - Remove a mark from a node
- [ ] `AttrStep` - Change node attributes

### Transform Layer - High-level API
- [x] `Transform` class - Basic version with replace, delete, insert, insertText
- [ ] Structure helpers (`lift`, `wrap`, `setBlockType`, `split`, `join`)
- [ ] Mark helpers (`addMark`, `removeMark`)
- [ ] Advanced replace helpers (`replaceRange`, `deleteRange`) - simplified `replaceStep` done

### State Layer (`src/state/`)
- [ ] `EditorState` - Immutable editor state
- [ ] `Transaction` - Extends Transform with selection and metadata
- [ ] `Selection` - TextSelection, NodeSelection, AllSelection
- [ ] `Plugin` - Plugin system for extending behavior

### View Layer (`src/view/`)
- [ ] `EditorView` - Main view class (SolidJS reactive)
- [ ] DOM rendering with fine-grained reactivity
- [ ] Input handling (keyboard, mouse, clipboard, drag/drop)
- [ ] Decorations system
- [ ] NodeView for custom node rendering

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

## Notes

- Using SolidJS for fine-grained reactivity instead of ProseMirror's update cycle
- Test-driven approach: port ProseMirror tests to vitest
- Simplified content validation compared to ProseMirror's full ContentMatch state machine
