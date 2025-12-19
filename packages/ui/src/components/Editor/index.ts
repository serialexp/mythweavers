// Main editor components
export { SceneEditor } from './SceneEditor.new'
export { ProseMirrorEditor } from './components/ProseMirrorEditor'
export { RewriteModal, GenerateBetweenModal } from './components/EditorModals'

// Solid-editor based implementation (experimental)
export { SolidEditorWrapper, storySchema } from './solid-editor'
export type { SolidEditorWrapperProps } from './solid-editor'

// Simpler editor (if needed)
export { Editor } from './Editor'

// Schema
export { contentSchema } from './schema'

// Utilities
export * from './utils/paragraph-conversion'

// Types from @mythweavers/shared
export type {
  Paragraph,
  ParagraphState,
  PlotPointAction,
  InventoryAction,
  Comment,
  ContentNode,
  TextNode,
  BlockNode,
  TextMark,
} from '@mythweavers/shared'

export {
  contentNodeToText,
  paragraphToText,
  paragraphsToText,
  parseContentSchema,
} from '@mythweavers/shared'

// Editor-specific types
export type {
  SceneEditorProps,
  EditorCharacter,
  EditorLocation,
  EditorScene,
  EditorTreeNode,
  AiHelpType,
} from './SceneEditorProps'
export type { ProseMirrorEditorProps } from './components/ProseMirrorEditor'
export type { TranslationLanguage, InlineMenuConfig } from './prosemirror-plugins/inline-menu'

// CSS styles - exported for direct use if needed
export * from './scene-editor.css'
// Only export non-conflicting items from style.css (blockMenu/inlineMenu conflict with scene-editor.css)
export { editor, row } from './style.css'
