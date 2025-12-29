// Active paragraph tracking
export { createActiveParagraphPlugin, activeParagraphPluginKey } from './activeParagraph'

// Paragraph state visualization
export { createParagraphStatePlugin, createParagraphStateNodeView } from './paragraphState'

// Paragraph actions menu (Portal-based - legacy)
export { createParagraphActionsPlugin, ParagraphActionsMenu } from './paragraphActions'
export type { ParagraphActionsConfig, ParagraphActionsProps } from './paragraphActions'

// Paragraph actions decoration (widget-based - new)
export { createParagraphActionsDecorations } from './paragraphActionsDecoration'

// Auto-assign IDs to paragraphs
export { createAssignIdPlugin, assignIdPluginKey } from './assignId'
