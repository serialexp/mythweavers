# Current Task: Editor Editability Bug After Regeneration

## Problem Summary
After regenerating content or generating summaries for a message, the editor for that message becomes uneditable, even though all the state variables indicate it should be editable.

## What We Know

### Debug Output Shows Correct State
When debugging, the values show:
```
isGenerating: false
isEditable: true (computed as !isGenerating)
editable prop passed to SceneEditorWrapper: true
```

Yet the editor remains uneditable - you cannot click into it or type.

### The Issue Is NOT With Prop Values
- `isGenerating` is correctly `false` after generation completes
- The `editable` prop is correctly computed as `true`
- The problem persists even with the simplest logic: `editable={!props.isGenerating}`

### The Issue Appears to Be Reactivity/Component State
The EditorView component (in `packages/solid-editor/src/view/EditorView.tsx`) doesn't seem to respond when the `editable` prop changes from `false` back to `true`.

Hypothesis: During generation, `editable` becomes `false`, the DOM `contentEditable` is set to `false`. When generation completes and `editable` becomes `true` again, something prevents the `contentEditable` from being restored.

## Component Chain
1. `Message.tsx` - passes `editable={!props.isGenerating}` to SceneEditorWrapper
2. `SceneEditorWrapper.tsx` - passes `editable={props.editable ?? true}` to SceneEditor
3. `SceneEditor.new.tsx` (in packages/ui) - passes `editable={props.editable ?? true}` to SolidEditorWrapper
4. `SolidEditorWrapper.tsx` (in packages/ui) - passes `editable={props.editable ?? true}` to EditorView
5. `EditorView.tsx` (in packages/solid-editor) - uses `contentEditable={computedEditable()}`

The `computedEditable` memo in EditorView.tsx (line 139-144):
```tsx
const computedEditable = createMemo(() => {
  // Direct prop takes precedence
  if (props.editable === false) return false
  // Then check plugin/view props (default to true)
  return isEditable(state(), props.props, true)
})
```

## Files Changed in This Session

### Working Changes (keep these)
1. `packages/ui/src/components/Editor/solid-editor/SolidEditorWrapper.tsx`
   - Line 226: Changed placeholder to show "Generating..." when not editable

2. `apps/mythweavers-story-editor/src/components/MessageList.tsx`
   - Scroll restoration now waits for content height to stabilize before restoring position
   - Removed "last edited message" priority, now just uses scroll position
   - Added `messageWrapper` around the loading message

3. `apps/mythweavers-story-editor/src/components/Message.tsx`
   - Removed localStorage tracking of last edited message in `startEditingInstruction`

### Reverted Changes
- All the `isLoading` prop threading through MessageListItems, NormalModeView, etc. was reverted
- The `isAwaitingGeneration` memo was removed

## Next Steps to Debug

1. Add debug logging in `EditorView.tsx` to see:
   - When `computedEditable` memo runs
   - What value it returns
   - Whether `contentEditable` attribute is actually being set on the DOM

2. Check if there's a SolidJS reactivity issue where `props.editable` isn't triggering the memo to recompute

3. Consider if a `createEffect` is needed in EditorView to explicitly update the DOM when editable changes

4. Check if the issue is specific to summary generation or also happens with content regeneration

## Reproduction Steps
1. Open a scene with messages
2. Click on a message's actions menu
3. Generate summaries for the message
4. Try to edit that message - it should be uneditable
5. Check console - debug output (if added) should show `editable: true`

## Key Question
Was this bug present BEFORE this session's changes? The `isGenerating` prop seems to always be `false`, which suggests the editor should always be editable. We need to determine if the EditorView component ever properly responded to `editable` prop changes, or if this is a pre-existing bug.
