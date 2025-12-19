// Main components
export { EditorView } from './EditorView'
export type { EditorViewProps } from './EditorView'

// Debug overlay
export { DebugOverlay } from './DebugOverlay'
export type { DebugOverlayProps } from './DebugOverlay'

// Node rendering
export { NodeView } from './NodeView'
export type { NodeViewProps, NodeViewMap } from './NodeView'

export { TextView, InlineContent } from './TextView'
export type { TextViewProps, InlineContentProps } from './TextView'

// Context and hooks
export { EditorContext, useEditor } from './context'
export type { EditorViewContext } from './context'

// Decoration management
export { DecorationManager, createDecorationManager } from './DecorationManager'
export type { TrackedDecoration } from './DecorationManager'

// Selection utilities
export {
  selectionFromDOM,
  selectionToDOM,
  posFromDOM,
  domFromPos,
  setPosInfo,
  getPosInfo,
} from './selection'
export type { PosInfo } from './selection'

// Prop resolution utilities
export {
  someProp,
  callPropHandlers,
  collectProps,
  isEditable,
  collectAttributes,
  collectDecorations,
} from './propHelpers'
export type { PropViewRef } from './propHelpers'

// Decoration system
export {
  DecorationSet,
  widget,
  inline,
  node,
  span,
  isWidget,
  isInline,
  isNode,
  isSpan,
  resolveDecorations,
} from './decoration'
export type {
  Decoration,
  WidgetDecoration,
  InlineDecoration,
  NodeDecoration,
  SpanDecoration,
  WidgetDecorationSpec,
  InlineDecorationSpec,
  NodeDecorationSpec,
  SpanDecorationSpec,
  DecorationSource,
} from './decoration'
