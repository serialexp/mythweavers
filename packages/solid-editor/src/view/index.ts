// Main components
export { EditorView, EditorProvider, EditorContent } from './EditorView'
export type { EditorViewProps, EditorProviderProps, EditorContentProps } from './EditorView'

// Debug overlay and transaction recorder
export { DebugOverlay, createTransactionRecorder } from './DebugOverlay'
export type {
  DebugOverlayProps,
  TransactionRecorder,
  Recording,
  RecordedEvent,
  RecordedTransaction,
  RecordedSelectionEvent,
} from './DebugOverlay'

// Node rendering
export { NodeView, WidgetsAt } from './NodeView'
export type { NodeViewProps, NodeViewMap } from './NodeView'

export { TextView, InlineContent } from './TextView'
export type { TextViewProps, InlineContentProps } from './TextView'

// Block selection
export { BlockSelector } from './BlockSelector'

// Drag and drop
export { SortableDocView, BlockDragDropProvider, createBlockMoveTransaction } from './DragDrop'

// Context and hooks
export { EditorContext, useEditor } from './context'
export type { EditorViewContext, SelectedBlock } from './context'

// Decoration management
export { DecorationManager, createDecorationManager } from './DecorationManager'
export type { TrackedDecoration } from './DecorationManager'

// Selection utilities
export {
  selectionFromDOM,
  selectionToDOM,
  posFromDOM,
  domFromPos,
  registerNodeId,
  getNodeId,
  getElementByNodeId,
  pruneReverseMap,
  // Backwards compatibility (deprecated)
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
