// Solid-editor based implementation for the story editor
export { SolidEditorWrapper } from './SolidEditorWrapper'
export type { SolidEditorWrapperProps } from './SolidEditorWrapper'

// Schema - schemaSpec can be shared with ProseMirror, storySchema is the solid-editor instance
export { storySchema, schemaSpec } from './schema'
export type { StorySchema, MentionType } from './schema'

// Custom node views
export { MentionView } from './MentionView'

// Inline menu for text formatting
export { InlineMenu } from './InlineMenu'
export type { InlineMenuConfig, InlineMenuProps, TranslationLanguage } from './InlineMenu'

export {
  paragraphsToDoc,
  docToParagraphs,
  getParagraphIdAtPos,
  getParagraphRange,
} from './paragraph-conversion'

// Plugins for the solid-editor
export {
  createActiveParagraphPlugin,
  activeParagraphPluginKey,
  createParagraphStatePlugin,
  createParagraphStateNodeView,
  createParagraphActionsPlugin,
  ParagraphActionsMenu,
  createAssignIdPlugin,
  assignIdPluginKey,
} from '../solid-editor-plugins'
export type { ParagraphActionsConfig, ParagraphActionsProps } from '../solid-editor-plugins'
