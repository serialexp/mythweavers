import { type JSX, Show, createEffect, createMemo, createSignal, on, onCleanup, onMount } from 'solid-js'
import type { CommandContext, KeyBindings } from '../keymap'
import { keydownHandler } from '../keymap'
import { Fragment, type ResolvedPos, Slice } from '../model'
import { type EditorProps, EditorState, Selection as EditorSelection, TextSelection, Transaction } from '../state'
import { splitBlock } from '../commands/editing'
import { canJoin, liftTarget } from '../transform'
import { BlockSelector } from './BlockSelector'
import { DebugOverlay } from './DebugOverlay'
import { BlockDragDropProvider, SortableDocView, isDragging } from './DragDrop'
import { createDecorationManager } from './DecorationManager'
import { NodeView, type NodeViewMap } from './NodeView'
import { EditorContext, type EditorViewContext, useEditor } from './context'
import { DecorationSet } from './decoration'
import { type PropViewRef, callPropHandlers, collectDecorations, isEditable } from './propHelpers'
import { buildNodeIndex, domFromPos, getNodeId, pruneReverseMap, selectionFromDOM, selectionToDOM } from './selection'
import type { SelectedBlock } from './context'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface EditorProviderProps {
  /** The editor state */
  state: EditorState
  /** Callback when the state changes */
  onStateChange?: (state: EditorState) => void
  /** Custom dispatch function (for middleware, history, etc.) */
  dispatchTransaction?: (tr: Transaction) => void
  /** Whether the editor is editable (can also be controlled via props.editable) */
  editable?: boolean
  /** Custom node views */
  nodeViews?: NodeViewMap
  /** Enable block-level drag-and-drop reordering */
  blockDragDrop?: boolean
  /** Placeholder text when empty */
  placeholder?: string
  /** Auto-focus on mount */
  autoFocus?: boolean
  /** Keyboard shortcuts - compatible with ProseMirror keymap format */
  keymap?: KeyBindings
  /**
   * Editor props that take precedence over plugin props.
   * Can include handlers like handleKeyDown, handleClick, etc.
   */
  props?: EditorProps
  /**
   * Transaction recorder for the debug overlay.
   * Create one with `createTransactionRecorder()` and call
   * `recorder.record(tr)` in your dispatch path.
   */
  recorder?: import('./DebugOverlay').TransactionRecorder
  /** Callback when editor focus changes */
  onFocusChange?: (focused: boolean) => void
  /** Children rendered inside the EditorContext — toolbars, breadcrumbs, etc. */
  children?: JSX.Element
}

export interface EditorContentProps {
  /** Additional class name for the editor content area */
  class?: string
  /**
   * Show debug overlay with cursor position and document structure.
   * Can be true for default position or specify position.
   */
  debug?: boolean | 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left'
  /**
   * Show block selector handles on the left edge of ancestor blocks
   * at the current cursor position.
   */
  blockSelector?: boolean
}

/** Convenience props for EditorView (combines Provider + Content) */
export interface EditorViewProps extends EditorProviderProps, EditorContentProps {}

// ─── EditorProvider ───────────────────────────────────────────────────────────

/**
 * Sets up the editor context: state management, dispatch, decorations,
 * block selection, and all the internal wiring. Renders `children` inside
 * the EditorContext.Provider so they can use `useEditor()`.
 *
 * Use with `<EditorContent />` to render the actual contenteditable area.
 *
 * ```tsx
 * <EditorProvider state={state()} dispatchTransaction={dispatch}>
 *   <MyToolbar />
 *   <EditorContent class="my-editor" />
 * </EditorProvider>
 * ```
 */
export function EditorProvider(props: EditorProviderProps): JSX.Element {
  let containerRef: HTMLDivElement | undefined
  const [focused, setFocused] = createSignal(false)

  // Internal state signal — only used in uncontrolled mode (no dispatchTransaction).
  const [internalState, setInternalState] = createSignal(props.state)

  const state = () => (props.dispatchTransaction ? props.state : internalState())

  // Decoration manager for tracked decorations
  const decorationManager = createDecorationManager()

  // Track if we're currently updating selection to avoid loops
  let updatingSelection = false
  // Track if we're in an IME composition
  let composing = false
  // Version counter to handle RAF race conditions
  let selectionSyncVersion = 0

  // Set updatingSelection = true synchronously when state changes
  createEffect(
    on(
      state,
      () => {
        updatingSelection = true
      },
      { defer: false },
    ),
  )

  // Default dispatch function
  const dispatch = (tr: Transaction) => {
    updatingSelection = true
    decorationManager.mapThrough(tr)

    if (props.dispatchTransaction) {
      props.dispatchTransaction(tr)
    } else {
      const newState = internalState().apply(tr)
      setInternalState(newState)
      props.onStateChange?.(newState)
    }

    // Prune stale entries from the reverse DOM map on document changes
    if (tr.docChanged) {
      const activeIds = new Set<string>()
      const newDoc = (props.dispatchTransaction ? props.state : internalState()).doc
      newDoc.descendants((node) => { activeIds.add(node.id); return undefined })
      pruneReverseMap(activeIds)
    }

    // Clear block selection override when the cursor moves
    if (tr.selectionSet) {
      setOverrideBlockId(null)
    }
  }

  // Handle selecting a node by position range
  const handleSelectNode = (from: number, to: number) => {
    const currentState = state()
    try {
      const $from = currentState.doc.resolve(from)
      const $to = currentState.doc.resolve(to)
      const selection = TextSelection.between($from, $to)
      const tr = currentState.tr().setSelection(selection)
      dispatch(tr)
    } catch (_e) {
      // Invalid position, ignore
    }
  }

  // ─── Block selection ──────────────────────────────────────────────
  const [overrideBlockId, setOverrideBlockId] = createSignal<string | null>(null)

  const blockAncestors = createMemo((): SelectedBlock[] => {
    const currentState = state()
    const { $from } = currentState.selection
    const ancestors: SelectedBlock[] = []
    for (let d = 1; d <= $from.depth; d++) {
      const node = $from.node(d)
      if (node.isBlock) {
        ancestors.push({
          nodeId: node.id,
          pos: $from.before(d),
          depth: d,
          typeName: node.type.name,
        })
      }
    }
    return ancestors
  })

  const selectedBlock = createMemo((): SelectedBlock | null => {
    const ancestors = blockAncestors()
    if (ancestors.length === 0) return null
    const override = overrideBlockId()
    if (override) {
      const found = ancestors.find((a) => a.nodeId === override)
      if (found) return found
    }
    return ancestors[ancestors.length - 1]
  })

  const selectBlock = (nodeId: string | null) => {
    setOverrideBlockId(nodeId)
  }

  // ─── Context value ────────────────────────────────────────────────

  // The context stores functions that the EditorContent component will call
  // to register its container ref and event handlers. This avoids prop drilling
  // while keeping the contenteditable div as a separate component.
  const [contentRef, setContentRef] = createSignal<HTMLDivElement | null>(null)
  const [wrapperRef, setWrapperRef] = createSignal<HTMLDivElement | null>(null)

  // Alias: containerRef is the contenteditable div (set by EditorContent)
  // We use a derived getter so all existing code that reads containerRef works.
  const getContainerRef = () => contentRef()

  /**
   * Find document position at screen coordinates. Returns `{ pos, inside }`
   * where `inside` is the position of the deepest node containing the point,
   * useful for determining which cell a click landed in (merged cells etc.).
   */
  const posAtCoordsWithInside = (x: number, y: number): { pos: number; inside: number } | null => {
    const ref = getContainerRef()
    if (!ref) return null
    let range: Range | null = null
    if (document.caretPositionFromPoint) {
      const cp = document.caretPositionFromPoint(x, y)
      if (cp) { range = document.createRange(); range.setStart(cp.offsetNode, cp.offset); range.collapse(true) }
    } else if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(x, y)
    }
    if (!range || !ref.contains(range.startContainer)) return null
    const sel = selectionFromDOM(state().doc, {
      anchorNode: range.startContainer, anchorOffset: range.startOffset,
      focusNode: range.startContainer, focusOffset: range.startOffset,
      isCollapsed: true, rangeCount: 1, getRangeAt: () => range!,
    } as unknown as globalThis.Selection)
    const pos = sel ? sel.from : null
    if (pos === null) return null

    // Compute `inside`: walk from the hit DOM node up toward the editor root,
    // finding the deepest block node that contains the point.
    let inside = -1
    const index = buildNodeIndex(state().doc)
    let domNode: globalThis.Node | null = range.startContainer
    while (domNode && domNode !== ref) {
      const nodeId = getNodeId(domNode)
      if (nodeId) {
        const entry = index.get(nodeId)
        if (entry && entry.node.isBlock) {
          inside = entry.pos
          break
        }
      }
      domNode = domNode.parentNode
    }
    return { pos, inside }
  }

  /**
   * Check whether the cursor is at the visual edge of a textblock in the
   * given direction. Uses model-based checks (parentOffset). This is a
   * simplified version that doesn't handle bidi text but is correct for
   * LTR content and sufficient for table navigation.
   */
  const endOfTextblock = (dir: 'up' | 'down' | 'left' | 'right'): boolean => {
    const currentState = state()
    const sel = currentState.selection
    if (!(sel instanceof TextSelection)) return false
    const { $head } = sel
    if (!$head.parent.isTextblock) return false

    if (dir === 'left' || dir === 'up') {
      return $head.parentOffset === 0
    }
    // dir === 'right' || dir === 'down'
    return $head.parentOffset === $head.parent.content.size
  }

  const contextValue: EditorViewContext = {
    state: () => state(),
    dispatch,
    dom: () => getContainerRef() ?? null,
    hasFocus: focused,
    focus: () => getContainerRef()?.focus(),
    addDecoration: (dec) => decorationManager.add(dec),
    addDecorations: (decs) => decorationManager.addAll(decs),
    decorations: decorationManager,
    selectedBlock,
    selectBlock,
    blockAncestors,
    posAtCoords: (coords) => posAtCoordsWithInside(coords.left, coords.top),
    endOfTextblock: (dir) => endOfTextblock(dir),
    root: typeof document !== 'undefined' ? document : (undefined as unknown as Document),
    wrapperDom: () => wrapperRef(),
  }

  // Expose internals needed by EditorContent via context
  // We use a separate internal context to avoid polluting the public API.
  const internalValue: EditorInternals = {
    state,
    dispatch,
    focused,
    setFocused,
    setContentRef,
    setWrapperRef,
    handleSelectNode,
    decorationManager,
    updatingSelection: () => updatingSelection,
    setUpdatingSelection: (v) => { updatingSelection = v },
    composing: () => composing,
    setComposing: (v) => { composing = v },
    selectionSyncVersion: () => selectionSyncVersion,
    incrementSyncVersion: () => ++selectionSyncVersion,
    nodeViews: () => props.nodeViews,
    editable: () => props.editable,
    placeholder: () => props.placeholder,
    autoFocus: () => props.autoFocus,
    keymap: () => props.keymap,
    editorProps: () => props.props,
    recorder: () => props.recorder,
    onFocusChange: () => props.onFocusChange,
    blockDragDrop: () => props.blockDragDrop,
  }

  return (
    <EditorContext.Provider value={contextValue}>
      <EditorInternalsContext.Provider value={internalValue}>
        <Show when={props.blockDragDrop} fallback={props.children}>
          <BlockDragDropProvider state={state} dispatch={dispatch}>
            {props.children}
          </BlockDragDropProvider>
        </Show>
      </EditorInternalsContext.Provider>
    </EditorContext.Provider>
  )
}

// ─── Internal context (not public API) ────────────────────────────────────────

interface EditorInternals {
  state: () => EditorState
  dispatch: (tr: Transaction) => void
  focused: () => boolean
  setFocused: (v: boolean) => void
  setContentRef: (el: HTMLDivElement | null) => void
  setWrapperRef: (el: HTMLDivElement | null) => void
  handleSelectNode: (from: number, to: number) => void
  decorationManager: ReturnType<typeof createDecorationManager>
  updatingSelection: () => boolean
  setUpdatingSelection: (v: boolean) => void
  composing: () => boolean
  setComposing: (v: boolean) => void
  selectionSyncVersion: () => number
  incrementSyncVersion: () => number
  nodeViews: () => NodeViewMap | undefined
  editable: () => boolean | undefined
  placeholder: () => string | undefined
  autoFocus: () => boolean | undefined
  keymap: () => KeyBindings | undefined
  editorProps: () => EditorProps | undefined
  recorder: () => import('./DebugOverlay').TransactionRecorder | undefined
  onFocusChange: () => ((focused: boolean) => void) | undefined
  blockDragDrop: () => boolean | undefined
}

import { createContext, useContext } from 'solid-js'

const EditorInternalsContext = createContext<EditorInternals>()

function useInternals(): EditorInternals {
  const ctx = useContext(EditorInternalsContext)
  if (!ctx) throw new Error('EditorContent must be used within an EditorProvider')
  return ctx
}

// ─── EditorContent ────────────────────────────────────────────────────────────

/**
 * The contenteditable area of the editor. Must be used inside an `<EditorProvider>`.
 * Renders the document, handles input, selection sync, and optional overlays.
 */
export function EditorContent(props: EditorContentProps): JSX.Element {
  let containerRef: HTMLDivElement | undefined
  const int = useInternals()
  const editor = useEditor()

  // Compute whether editor is editable
  const computedEditable = createMemo(() => {
    if (int.editable() === false) return false
    return isEditable(int.state(), int.editorProps(), true)
  })

  // When blockDragDrop is enabled, inject SortableDocView as the doc nodeView
  const effectiveNodeViews = createMemo(() => {
    const nv = int.nodeViews()
    if (int.blockDragDrop()) {
      return { ...nv, doc: SortableDocView }
    }
    return nv
  })

  // Collect decorations from all plugins and tracked decorations
  const decorations = createMemo(() => {
    const currentState = int.state()
    const pluginDecorations = collectDecorations(currentState, int.editorProps())
    const trackedDecorations = int.decorationManager.getDecorationSet(currentState.doc)

    if (pluginDecorations.isEmpty && trackedDecorations.isEmpty) return DecorationSet.empty
    if (pluginDecorations.isEmpty) return trackedDecorations
    if (trackedDecorations.isEmpty) return pluginDecorations
    return pluginDecorations.add(currentState.doc, trackedDecorations.find())
  })

  // Check for unrendered widgets after render cycle
  createEffect(() => {
    const decs = decorations()
    queueMicrotask(() => { decs.checkUnrenderedWidgets() })
  })

  // Create view reference for plugin prop handlers
  const getViewRef = (): PropViewRef => ({
    state: int.state(),
    dispatch: int.dispatch,
    dom: containerRef ?? null,
    focus: () => containerRef?.focus(),
    posAtCoords: editor.posAtCoords,
    endOfTextblock: editor.endOfTextblock,
    root: editor.root,
  })

  // ─── Selection sync ──────────────────────────────────────────────

  const handleSelectionChange = () => {
    if (int.updatingSelection() || int.composing() || isDragging() || !containerRef) return

    const domSelection = document.getSelection()
    if (!domSelection || domSelection.rangeCount === 0) return

    const range = domSelection.getRangeAt(0)
    const ancestor = range.commonAncestorContainer
    if (!ancestor || !(ancestor instanceof Node)) return
    try {
      if (!containerRef.contains(ancestor)) return
    } catch {
      return
    }

    const currentState = int.state()
    const selection = selectionFromDOM(currentState.doc, domSelection)
    if (!selection) return

    if (!selection.eq(currentState.selection)) {
      int.recorder()?.recordSelection({
        trigger: 'selectionchange',
        dom: {
          anchorNodeName: domSelection.anchorNode?.nodeName ?? '?',
          anchorOffset: domSelection.anchorOffset,
          focusNodeName: domSelection.focusNode?.nodeName ?? '?',
          focusOffset: domSelection.focusOffset,
          anchorText: domSelection.anchorNode?.nodeType === 3 ? domSelection.anchorNode.textContent?.slice(0, 40) : undefined,
          focusText: domSelection.focusNode?.nodeType === 3 ? domSelection.focusNode.textContent?.slice(0, 40) : undefined,
        },
        modelFrom: selection.from,
        modelTo: selection.to,
        previousModel: { from: currentState.selection.from, to: currentState.selection.to },
        dispatched: true,
        summary: `DOM(${domSelection.anchorOffset})→model(${selection.from})`,
      })

      int.setUpdatingSelection(true)
      const tr = currentState.tr().setSelection(selection)
      int.dispatch(tr)
    }
  }

  // Update DOM selection when model selection changes
  createEffect(() => {
    const currentState = int.state()
    if (!containerRef) return

    const version = int.incrementSyncVersion()

    requestAnimationFrame(() => {
      if (version !== int.selectionSyncVersion()) return
      if (!containerRef) {
        int.setUpdatingSelection(false)
        return
      }

      int.setUpdatingSelection(true)
      selectionToDOM(containerRef, currentState.selection, currentState.doc)

      if (int.recorder()?.recording()) {
        const domResult = domFromPos(containerRef, currentState.selection.from, currentState.doc)
        int.recorder()!.recordSelection({
          trigger: 'sync-to-dom',
          dom: {
            anchorNodeName: domResult?.node.nodeName ?? '?',
            anchorOffset: domResult?.offset ?? -1,
            focusNodeName: domResult?.node.nodeName ?? '?',
            focusOffset: domResult?.offset ?? -1,
            anchorText: domResult?.node.nodeType === 3 ? domResult.node.textContent?.slice(0, 40) : undefined,
          },
          modelFrom: currentState.selection.from,
          modelTo: currentState.selection.to,
          previousModel: { from: currentState.selection.from, to: currentState.selection.to },
          dispatched: false,
          reverseMap: domResult ? {
            pos: currentState.selection.from,
            nodeName: domResult.node.nodeName,
            offset: domResult.offset,
            text: domResult.node.nodeType === 3 ? domResult.node.textContent?.slice(0, 40) : undefined,
          } : undefined,
          summary: `model(${currentState.selection.from})→DOM(${domResult?.offset ?? '?'})`,
        })
      }

      setTimeout(() => { int.setUpdatingSelection(false) }, 0)
    })
  })

  // ─── Input handling ──────────────────────────────────────────────

  const handleBeforeInput = (event: InputEvent) => {
    if (!containerRef) return
    const currentState = int.state()
    const { inputType, data } = event

    switch (inputType) {
      case 'insertText':
      case 'insertReplacementText':
        if (data) {
          event.preventDefault()
          const { from, to } = currentState.selection
          if (callPropHandlers(currentState, int.editorProps(), 'handleTextInput', getViewRef(), from, to, data)) return
          const tr = currentState.tr()
          tr.replaceSelectionWith(currentState.schema.text(data), true)
          int.dispatch(tr)
        }
        break
      case 'insertParagraph':
      case 'insertLineBreak':
        event.preventDefault()
        splitBlock(currentState, int.dispatch)
        break
      case 'deleteContentBackward':
        event.preventDefault()
        handleBackspace(currentState)
        break
      case 'deleteContentForward':
        event.preventDefault()
        handleDelete(currentState)
        break
      case 'deleteWordBackward':
        event.preventDefault()
        handleDeleteWord(currentState, -1)
        break
      case 'deleteWordForward':
        event.preventDefault()
        handleDeleteWord(currentState, 1)
        break
      case 'deleteSoftLineBackward':
      case 'deleteHardLineBackward':
        event.preventDefault()
        handleDeleteLine(currentState, -1)
        break
      case 'deleteSoftLineForward':
      case 'deleteHardLineForward':
        event.preventDefault()
        handleDeleteLine(currentState, 1)
        break
      case 'insertCompositionText':
        break
      default:
        break
    }
  }

  const handleBackspace = (currentState: EditorState) => {
    const { $from, empty } = currentState.selection
    const tr = currentState.tr()

    if (!empty) { tr.deleteSelection(); int.dispatch(tr); return }
    if ($from.pos === 0) return

    if ($from.parentOffset === 0 && $from.parent.isTextblock) {
      const $cut = findCutBefore($from)
      if ($cut) {
        const before = $cut.nodeBefore
        const after = $cut.nodeAfter
        if (before && after && canJoin(currentState.doc, $cut.pos)) {
          tr.join($cut.pos); int.dispatch(tr); return
        }
        if ($from.parent.content.size === 0 && before?.isTextblock) {
          tr.delete($from.before($from.depth), $from.after($from.depth))
          const $newPos = tr.doc.resolve(Math.max(0, $cut.pos - 1))
          const sel = EditorSelection.findFrom($newPos, -1, true)
          if (sel) tr.setSelection(sel)
          int.dispatch(tr); return
        }
      }
      const range = $from.blockRange()
      if (range) {
        const target = liftTarget(range)
        if (target != null) { tr.lift(range, target); int.dispatch(tr); return }
      }
      return
    }

    const nodeBefore = $from.nodeBefore
    if (nodeBefore) {
      if (nodeBefore.isText) tr.delete($from.pos - 1, $from.pos)
      else tr.delete($from.pos - nodeBefore.nodeSize, $from.pos)
      int.dispatch(tr)
    }
  }

  function findCutBefore($pos: ResolvedPos): ResolvedPos | null {
    for (let i = $pos.depth - 1; i >= 0; i--) {
      if ($pos.index(i) > 0) return $pos.doc.resolve($pos.before(i + 1))
    }
    return null
  }

  const handleDelete = (currentState: EditorState) => {
    const { $from, $to, empty } = currentState.selection
    const tr = currentState.tr()

    if (!empty) { tr.deleteSelection(); int.dispatch(tr); return }
    if ($to.pos >= currentState.doc.content.size) return

    const atBlockEnd = $to.parentOffset === $to.parent.content.size && $to.parent.isTextblock
    if (atBlockEnd) {
      const $cut = findCutAfter($to)
      if ($cut) {
        const before = $cut.nodeBefore
        const after = $cut.nodeAfter
        if (before && after && canJoin(currentState.doc, $cut.pos)) {
          tr.join($cut.pos); int.dispatch(tr); return
        }
        if (after?.isTextblock && after.content.size === 0) {
          tr.delete($cut.pos, $cut.pos + after.nodeSize); int.dispatch(tr); return
        }
      }
      return
    }

    const nodeAfter = $to.nodeAfter
    if (nodeAfter) {
      if (nodeAfter.isText) tr.delete($to.pos, $to.pos + 1)
      else tr.delete($to.pos, $to.pos + nodeAfter.nodeSize)
      int.dispatch(tr)
    }
  }

  function findCutAfter($pos: ResolvedPos): ResolvedPos | null {
    for (let i = $pos.depth - 1; i >= 0; i--) {
      const parent = $pos.node(i)
      if ($pos.index(i) + 1 < parent.childCount) return $pos.doc.resolve($pos.after(i + 1))
    }
    return null
  }

  const handleDeleteWord = (currentState: EditorState, dir: number) => {
    const { $from, empty } = currentState.selection
    const tr = currentState.tr()
    if (!empty) { tr.deleteSelection() } else {
      const text = $from.parent.textContent
      const offset = $from.parentOffset
      if (dir < 0) {
        let start = offset
        while (start > 0 && /\s/.test(text[start - 1])) start--
        while (start > 0 && /\S/.test(text[start - 1])) start--
        tr.delete($from.pos - (offset - start), $from.pos)
      } else {
        let end = offset
        while (end < text.length && /\S/.test(text[end])) end++
        while (end < text.length && /\s/.test(text[end])) end++
        tr.delete($from.pos, $from.pos + (end - offset))
      }
    }
    int.dispatch(tr)
  }

  const handleDeleteLine = (currentState: EditorState, dir: number) => {
    const { $from } = currentState.selection
    const tr = currentState.tr()
    if (dir < 0) tr.delete($from.pos - $from.parentOffset, $from.pos)
    else tr.delete($from.pos, $from.pos + ($from.parent.content.size - $from.parentOffset))
    int.dispatch(tr)
  }

  const handleCompositionStart = () => { int.setComposing(true) }
  const handleCompositionEnd = (event: CompositionEvent) => {
    int.setComposing(false)
    if (event.data && containerRef) {
      const tr = int.state().tr()
      tr.replaceSelectionWith(int.state().schema.text(event.data), true)
      int.dispatch(tr)
    }
  }

  /**
   * Call handleDOMEvents handlers from view props and all plugins for a
   * given event type. Returns true if any handler handled the event.
   */
  const callDOMEventHandlers = (eventName: string, event: Event): boolean => {
    const viewRef = getViewRef()
    // Check view props first
    const viewHandler = int.editorProps()?.handleDOMEvents?.[eventName]
    if (viewHandler) {
      const result = viewHandler(viewRef, event)
      if (result === true) return true
    }
    // Check plugin handlers
    for (const plugin of int.state().plugins) {
      const handler = plugin.spec.props?.handleDOMEvents?.[eventName]
      if (handler) {
        const result = handler(viewRef, event)
        if (result === true) return true
      }
    }
    return false
  }

  const handleCopy = (event: ClipboardEvent) => {
    if (callDOMEventHandlers('copy', event)) return
    const currentState = int.state()
    const { from, to, empty } = currentState.selection
    if (empty) return
    event.clipboardData?.setData('text/plain', currentState.doc.textBetween(from, to, '\n\n'))
    event.preventDefault()
  }

  const handleCut = (event: ClipboardEvent) => {
    if (callDOMEventHandlers('cut', event)) return
    // Default cut: copy as plain text, then delete selection
    const currentState = int.state()
    const { from, to, empty } = currentState.selection
    if (empty) return
    event.clipboardData?.setData('text/plain', currentState.doc.textBetween(from, to, '\n\n'))
    event.preventDefault()
    const tr = currentState.tr(); tr.deleteSelection(); int.dispatch(tr)
  }

  const handlePaste = (event: ClipboardEvent) => {
    if (callDOMEventHandlers('paste', event)) return
    event.preventDefault()
    // Default paste: plain text only
    const text = event.clipboardData?.getData('text/plain')
    if (!text) return
    const currentState = int.state()
    const tr = currentState.tr()
    const paragraphs = text.split(/\n\n+/)
    if (paragraphs.length === 1) {
      tr.replaceSelectionWith(currentState.schema.text(text), true)
    } else {
      const paragraphType = currentState.schema.nodes.paragraph
      if (!paragraphType) { tr.replaceSelectionWith(currentState.schema.text(text), true) }
      else {
        const nodes = paragraphs.map((content) =>
          paragraphType.create(null, content ? currentState.schema.text(content) : null))
        tr.replaceSelection(new Slice(Fragment.from(nodes), 1, 1))
      }
    }
    int.dispatch(tr)
  }

  // ─── Keyboard ────────────────────────────────────────────────────

  const getKeymapContext = (): CommandContext | null => {
    if (!containerRef) return null
    return { state: int.state(), dispatch: int.dispatch, dom: containerRef, focus: () => containerRef?.focus() }
  }

  const keymapHandler = int.keymap() ? keydownHandler(int.keymap()!, getKeymapContext) : null

  const handleKeyDown = (event: KeyboardEvent) => {
    if (keymapHandler?.(event)) { event.preventDefault(); return }
    if (callPropHandlers(int.state(), int.editorProps(), 'handleKeyDown', getViewRef(), event)) {
      event.preventDefault(); return
    }
    if (event.key === 'Tab') event.preventDefault()
  }

  // ─── Click handling ──────────────────────────────────────────────

  const posAtCoords = (x: number, y: number): number | null => {
    if (!containerRef) return null
    let range: Range | null = null
    if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(x, y)
      if (pos) { range = document.createRange(); range.setStart(pos.offsetNode, pos.offset); range.collapse(true) }
    } else if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(x, y)
    }
    if (!range || !containerRef.contains(range.startContainer)) return null
    const sel = selectionFromDOM(int.state().doc, {
      anchorNode: range.startContainer, anchorOffset: range.startOffset,
      focusNode: range.startContainer, focusOffset: range.startOffset,
      isCollapsed: true, rangeCount: 1, getRangeAt: () => range!,
    } as unknown as Selection)
    return sel ? sel.from : null
  }

  const handleClick = (event: MouseEvent) => {
    const pos = posAtCoords(event.clientX, event.clientY)
    if (pos !== null) {
      if (callPropHandlers(int.state(), int.editorProps(), 'handleClick', getViewRef(), pos, event)) event.preventDefault()
    }
  }

  const handleDblClick = (event: MouseEvent) => {
    const pos = posAtCoords(event.clientX, event.clientY)
    if (pos !== null) {
      if (callPropHandlers(int.state(), int.editorProps(), 'handleDoubleClick', getViewRef(), pos, event)) event.preventDefault()
    }
  }

  let lastClickTime = 0
  let lastClickPos: number | null = null
  let clickCount = 0

  const handleMouseDown = (event: MouseEvent) => {
    // Let plugins (e.g. table editing) intercept mousedown first
    if (callDOMEventHandlers('mousedown', event)) return

    const now = Date.now()
    const pos = posAtCoords(event.clientX, event.clientY)
    if (now - lastClickTime < 500 && pos !== null && pos === lastClickPos) {
      clickCount++
      if (clickCount >= 3) {
        if (callPropHandlers(int.state(), int.editorProps(), 'handleTripleClick', getViewRef(), pos, event)) event.preventDefault()
        clickCount = 0
      }
    } else { clickCount = 1 }
    lastClickTime = now
    lastClickPos = pos
  }

  // ─── Focus ───────────────────────────────────────────────────────

  const handleFocus = () => { int.setFocused(true); int.onFocusChange()?.(true) }
  const handleBlur = () => { int.setFocused(false); int.onFocusChange()?.(false) }

  // ─── Lifecycle ───────────────────────────────────────────────────

  onMount(() => {
    document.addEventListener('selectionchange', handleSelectionChange)
    if (int.autoFocus() && containerRef) containerRef.focus()
  })

  onCleanup(() => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  })

  // Register the content ref with the provider
  onMount(() => { if (containerRef) int.setContentRef(containerRef) })
  onCleanup(() => { int.setContentRef(null) })

  // ─── Computed ────────────────────────────────────────────────────

  const showPlaceholder = () => {
    const currentState = int.state()
    return int.placeholder() && currentState.doc.content.size === 2 && currentState.doc.textContent === ''
  }

  const debugPosition = () => {
    if (props.debug === true) return 'bottom-right'
    if (typeof props.debug === 'string') return props.debug
    return undefined
  }

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <div style={{ position: 'relative' }} class="solidjs-editor-wrapper" ref={(el) => int.setWrapperRef(el)}>
      <div
        ref={(el) => { containerRef = el }}
        class={`solidjs-editor ${props.class ?? ''} ${int.focused() ? 'solidjs-editor-focused' : ''}`}
        contentEditable={computedEditable()}
        role="textbox"
        aria-multiline="true"
        aria-readonly={!computedEditable()}
        spellcheck={true}
        onBeforeInput={handleBeforeInput}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        onDblClick={handleDblClick}
        onMouseDown={handleMouseDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onCopy={handleCopy}
        onCut={handleCut}
        onPaste={handlePaste}
        style={{
          position: 'relative',
          outline: 'none',
          'white-space': 'pre-wrap',
          'word-wrap': 'break-word',
        }}
      >
        <NodeView
          node={int.state().doc}
          pos={0}
          nodeViews={effectiveNodeViews()}
          decorations={decorations()}
          selection={int.state().selection}
          onSelectNode={int.handleSelectNode}
        />
        {showPlaceholder() && (
          <div
            class="solidjs-editor-placeholder"
            style={{ position: 'absolute', top: '7px', left: '20px', 'pointer-events': 'none', opacity: '0.5' }}
          >
            {int.placeholder()}
          </div>
        )}
      </div>
      <Show when={props.blockSelector}>
        <BlockSelector />
      </Show>
      <Show when={props.debug}>
        <DebugOverlay state={int.state()} position={debugPosition()} recorder={int.recorder()} />
      </Show>
    </div>
  )
}

// ─── EditorView (convenience wrapper) ─────────────────────────────────────────

/**
 * Convenience component that combines EditorProvider + EditorContent.
 * For simple use cases where you don't need a toolbar inside the editor context.
 *
 * For toolbars that need `useEditor()`, use the Provider/Content split instead:
 * ```tsx
 * <EditorProvider state={state()} dispatchTransaction={dispatch}>
 *   <MyToolbar />
 *   <EditorContent class="my-editor" />
 * </EditorProvider>
 * ```
 */
export function EditorView(props: EditorViewProps): JSX.Element {
  return (
    <EditorProvider
      state={props.state}
      onStateChange={props.onStateChange}
      dispatchTransaction={props.dispatchTransaction}
      editable={props.editable}
      nodeViews={props.nodeViews}
      blockDragDrop={props.blockDragDrop}
      placeholder={props.placeholder}
      autoFocus={props.autoFocus}
      keymap={props.keymap}
      props={props.props}
      recorder={props.recorder}
      onFocusChange={props.onFocusChange}
    >
      <EditorContent
        class={props.class}
        debug={props.debug}
        blockSelector={props.blockSelector}
      />
    </EditorProvider>
  )
}

export default EditorView
