import { type JSX, Show, createEffect, createMemo, createSignal, on, onCleanup, onMount } from 'solid-js'
import type { CommandContext, KeyBindings } from '../keymap'
import { keydownHandler } from '../keymap'
import { Fragment, type ResolvedPos, Slice } from '../model'
import { type EditorProps, EditorState, Selection as EditorSelection, TextSelection, Transaction } from '../state'
import { canJoin, liftTarget } from '../transform'
import { DebugOverlay } from './DebugOverlay'
import { createDecorationManager } from './DecorationManager'
import { NodeView, type NodeViewMap } from './NodeView'
import { EditorContext, type EditorViewContext } from './context'
import { DecorationSet } from './decoration'
import { type PropViewRef, callPropHandlers, collectDecorations, isEditable } from './propHelpers'
import { selectionFromDOM, selectionToDOM } from './selection'

export interface EditorViewProps {
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
  /** Additional class name for the editor */
  class?: string
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
   * Show debug overlay with cursor position and document structure.
   * Can be true for default position or specify position.
   */
  debug?: boolean | 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left'
  /** Callback when editor focus changes */
  onFocusChange?: (focused: boolean) => void
}

/**
 * The main editor view component.
 * Renders a ProseMirror-like document with SolidJS reactivity.
 */
export function EditorView(props: EditorViewProps): JSX.Element {
  let containerRef: HTMLDivElement | undefined
  const [focused, setFocused] = createSignal(false)
  const [state, setState] = createSignal(props.state)

  // Decoration manager for tracked decorations
  const decorationManager = createDecorationManager()

  // Track if we're currently updating selection to avoid loops
  let updatingSelection = false
  // Track if we're in an IME composition
  let composing = false
  // Version counter to handle RAF race conditions
  let selectionSyncVersion = 0

  // Set updatingSelection = true synchronously when state changes
  // This blocks selectionchange events that fire during DOM updates
  createEffect(
    on(
      () => props.state,
      () => {
        updatingSelection = true
      },
      { defer: false },
    ),
  )

  // Sync state from props
  createEffect(() => {
    setState(props.state)
  })

  // Default dispatch function - also maps tracked decorations
  const dispatch = (tr: Transaction) => {
    // Block selectionchange events during dispatch and render cycle
    // This prevents stale DOM selection from overwriting our model selection
    updatingSelection = true

    // Map tracked decorations through the transaction
    decorationManager.mapThrough(tr)

    if (props.dispatchTransaction) {
      props.dispatchTransaction(tr)
    } else {
      const newState = state().apply(tr)
      setState(newState)
      props.onStateChange?.(newState)
    }
    // Note: updatingSelection will be reset by the RAF in the selection sync effect
  }

  // Handle selecting a node by position range (for click-to-select on inline nodes)
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

  // Create context value
  const contextValue: EditorViewContext = {
    state: () => state(),
    dispatch,
    dom: () => containerRef ?? null,
    hasFocus: focused,
    focus: () => containerRef?.focus(),
    addDecoration: (dec) => decorationManager.add(dec),
    addDecorations: (decs) => decorationManager.addAll(decs),
    decorations: decorationManager,
  }

  // Create view reference for plugin prop handlers
  // This is a stable object that provides current state
  const getViewRef = (): PropViewRef => ({
    state: state(),
    dispatch,
    dom: containerRef ?? null,
    focus: () => containerRef?.focus(),
  })

  // Compute whether editor is editable
  const computedEditable = createMemo(() => {
    // Direct prop takes precedence
    if (props.editable === false) return false
    // Then check plugin/view props (default to true)
    return isEditable(state(), props.props, true)
  })

  // Collect decorations from all plugins and tracked decorations
  const decorations = createMemo(() => {
    const currentState = state()

    // Get plugin decorations
    const pluginDecorations = collectDecorations(currentState, props.props)

    // Get tracked decorations (this is reactive via the manager's signal)
    const trackedDecorations = decorationManager.getDecorationSet(currentState.doc)

    // Merge them together
    if (pluginDecorations.isEmpty && trackedDecorations.isEmpty) {
      return DecorationSet.empty
    }
    if (pluginDecorations.isEmpty) {
      return trackedDecorations
    }
    if (trackedDecorations.isEmpty) {
      return pluginDecorations
    }

    // Merge both sets
    return pluginDecorations.add(currentState.doc, trackedDecorations.find())
  })

  // Check for unrendered widgets after render cycle (development warning)
  createEffect(() => {
    const decs = decorations()
    // Use queueMicrotask to check after the render cycle completes
    queueMicrotask(() => {
      decs.checkUnrenderedWidgets()
    })
  })

  // Handle DOM selection changes
  const handleSelectionChange = () => {
    if (updatingSelection || composing || !containerRef) return

    const domSelection = document.getSelection()
    if (!domSelection || domSelection.rangeCount === 0) return

    // Check if selection is within our editor
    const range = domSelection.getRangeAt(0)
    if (!containerRef.contains(range.commonAncestorContainer)) return

    const currentState = state()
    const selection = selectionFromDOM(currentState.doc, domSelection)
    if (!selection) return

    // Only dispatch if selection actually changed
    if (!selection.eq(currentState.selection)) {
      console.log('[selectionchange] DOM→Model:', {
        from: selection.from,
        to: selection.to,
        currentModel: { from: currentState.selection.from, to: currentState.selection.to },
        domAnchor: { node: domSelection.anchorNode?.nodeName, offset: domSelection.anchorOffset },
      })
      updatingSelection = true
      const tr = currentState.tr().setSelection(selection)
      dispatch(tr)
      // Don't reset updatingSelection here - the selection sync effect will reset it
      // after it restores the selection to the DOM
    }
  }

  // Update DOM selection when model selection changes
  createEffect(() => {
    const currentState = state()
    if (!containerRef) return

    // Increment version - only the latest RAF should run
    const version = ++selectionSyncVersion
    console.log(
      '[effect] Scheduled RAF version:',
      version,
      'for selection:',
      currentState.selection.from,
      '-',
      currentState.selection.to,
    )

    // Defer to next frame to ensure DOM is updated
    // Set flag to prevent selectionchange handler from re-dispatching
    requestAnimationFrame(() => {
      // Skip if a newer sync was scheduled (prevents race condition)
      if (version !== selectionSyncVersion) {
        console.log('[RAF] Skipping stale version:', version, '(current:', selectionSyncVersion, ')')
        return
      }

      if (!containerRef) {
        updatingSelection = false
        return
      }

      // Always sync model to DOM - don't try to read DOM selection here
      // because after SolidJS re-render, the browser's Selection may be stale/invalid
      console.log('[RAF] Syncing Model→DOM:', currentState.selection.from, '-', currentState.selection.to)
      // Log actual model structure for debugging
      const pos = currentState.selection.from
      try {
        const $pos = currentState.doc.resolve(pos)
        const parent = $pos.parent
        console.log('[RAF] Model at pos', pos, '- parent:', parent.type.name, 'offset:', $pos.parentOffset)
        // Log all inline content in parent
        const inlineContent: string[] = []
        parent.forEach((node, offset) => {
          if (node.isText) {
            inlineContent.push(`TEXT@${offset}:"${node.text}"`)
          } else {
            inlineContent.push(`${node.type.name}@${offset}(size=${node.nodeSize})`)
          }
        })
        console.log('[RAF] Model content:', inlineContent.join(' | '))
      } catch (e) {
        console.log('[RAF] Could not resolve pos:', e)
      }
      updatingSelection = true
      const success = selectionToDOM(containerRef, currentState.selection)
      console.log('[RAF] Sync result:', success)

      // Keep flag true briefly to ignore the selectionchange event caused by selectionToDOM
      setTimeout(() => {
        updatingSelection = false
      }, 0)
    })
  })

  // Handle text input (beforeinput event)
  const handleBeforeInput = (event: InputEvent) => {
    if (!containerRef) return

    const currentState = state()
    const { inputType, data } = event

    switch (inputType) {
      case 'insertText':
      case 'insertReplacementText':
        if (data) {
          event.preventDefault()
          const { from, to } = currentState.selection
          // Log text around the insertion point
          const textBefore = currentState.doc.textBetween(Math.max(0, from - 5), from, '')
          const textAfter = currentState.doc.textBetween(to, Math.min(currentState.doc.content.size, to + 10), '')
          console.log('[insertText] Inserting', JSON.stringify(data), 'at selection:', from, '-', to)
          console.log(`[insertText] Context: "...${textBefore}|${textAfter}..."`)

          // Try plugin handleTextInput props first
          if (callPropHandlers(currentState, props.props, 'handleTextInput', getViewRef(), from, to, data)) {
            return
          }

          // Default text insertion
          const tr = currentState.tr()
          tr.replaceSelectionWith(currentState.schema.text(data), true)
          // Log text after insertion
          const newTextAround = tr.doc.textBetween(Math.max(0, from - 5), Math.min(tr.doc.content.size, from + 10), '')
          console.log(`[insertText] After insert: "...${newTextAround}..."`)
          console.log('[insertText] New selection:', tr.selection.from, '-', tr.selection.to)
          dispatch(tr)
        }
        break

      case 'insertParagraph':
      case 'insertLineBreak':
        event.preventDefault()
        // Split the current block or insert a hard break
        handleEnter(currentState)
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

      // Composition events are handled separately
      case 'insertCompositionText':
        // Let the browser handle it during composition
        break

      default:
        // For unhandled input types, prevent default to avoid DOM corruption
        // console.log("Unhandled inputType:", inputType)
        break
    }
  }

  // Handle Enter key
  const handleEnter = (currentState: EditorState) => {
    const { $from, $to } = currentState.selection
    const tr = currentState.tr()

    if (currentState.selection.empty) {
      // Check if we're in a textblock
      if ($from.parent.isTextblock) {
        // Split the paragraph
        const depth = $from.depth
        const _after = $from.after(depth)
        const _before = $from.before(depth)

        // Create new paragraph
        const paragraph = currentState.schema.nodes.paragraph?.create()
        if (paragraph) {
          tr.split($from.pos)
        }
      }
    } else {
      // Delete selection first, then split
      tr.deleteSelection()
      // For now, just delete - proper split logic would go here
    }

    dispatch(tr)
  }

  // Handle Backspace
  const handleBackspace = (currentState: EditorState) => {
    const { $from, empty } = currentState.selection
    const tr = currentState.tr()

    if (!empty) {
      // Selection exists - just delete it
      tr.deleteSelection()
      dispatch(tr)
      return
    }

    // Nothing to delete at the very start
    if ($from.pos === 0) return

    // Check if we're at the start of a textblock
    if ($from.parentOffset === 0 && $from.parent.isTextblock) {
      // Try to find a cut point before this block
      const $cut = findCutBefore($from)

      if ($cut) {
        const before = $cut.nodeBefore
        const after = $cut.nodeAfter

        // Try to join with the previous block if possible
        if (before && after && canJoin(currentState.doc, $cut.pos)) {
          tr.join($cut.pos)
          dispatch(tr)
          return
        }

        // If current block is empty and there's a previous textblock, delete current block
        if ($from.parent.content.size === 0 && before?.isTextblock) {
          // Delete the empty paragraph
          tr.delete($from.before($from.depth), $from.after($from.depth))
          // Find a valid selection in the previous block
          const $newPos = tr.doc.resolve(Math.max(0, $cut.pos - 1))
          const sel = EditorSelection.findFrom($newPos, -1, true)
          if (sel) tr.setSelection(sel)
          dispatch(tr)
          return
        }
      }

      // Try to lift the content if we can't join
      const range = $from.blockRange()
      if (range) {
        const target = liftTarget(range)
        if (target != null) {
          tr.lift(range, target)
          dispatch(tr)
          return
        }
      }

      // Nothing we can do at the start of this block
      return
    }

    // Not at start of textblock - safe to delete character before cursor
    // But we need to be careful about node boundaries
    const nodeBefore = $from.nodeBefore
    if (nodeBefore) {
      // There's content before in the same parent
      if (nodeBefore.isText) {
        // Delete one character
        tr.delete($from.pos - 1, $from.pos)
      } else {
        // Delete the whole inline node (like an image or emoji)
        tr.delete($from.pos - nodeBefore.nodeSize, $from.pos)
      }
      dispatch(tr)
    }
  }

  /**
   * Find the cut point before a position - the boundary between the current
   * block and what's before it.
   */
  function findCutBefore($pos: ResolvedPos): ResolvedPos | null {
    // Walk up the tree looking for a place where we have a sibling before us
    for (let i = $pos.depth - 1; i >= 0; i--) {
      if ($pos.index(i) > 0) {
        // There's a sibling before at this depth
        return $pos.doc.resolve($pos.before(i + 1))
      }
    }
    return null
  }

  // Handle Delete
  const handleDelete = (currentState: EditorState) => {
    const { $from, $to, empty } = currentState.selection
    const tr = currentState.tr()

    if (!empty) {
      // Selection exists - just delete it
      tr.deleteSelection()
      dispatch(tr)
      return
    }

    // Nothing to delete at the very end
    if ($to.pos >= currentState.doc.content.size) return

    // Check if we're at the end of a textblock
    const atBlockEnd = $to.parentOffset === $to.parent.content.size && $to.parent.isTextblock

    if (atBlockEnd) {
      // Try to find a cut point after this block
      const $cut = findCutAfter($to)

      if ($cut) {
        const before = $cut.nodeBefore
        const after = $cut.nodeAfter

        // Try to join with the next block if possible
        if (before && after && canJoin(currentState.doc, $cut.pos)) {
          tr.join($cut.pos)
          dispatch(tr)
          return
        }

        // If next block is empty, delete it
        if (after?.isTextblock && after.content.size === 0) {
          tr.delete($cut.pos, $cut.pos + after.nodeSize)
          dispatch(tr)
          return
        }
      }

      // Nothing we can do at the end of this block
      return
    }

    // Not at end of textblock - safe to delete character after cursor
    const nodeAfter = $to.nodeAfter
    if (nodeAfter) {
      if (nodeAfter.isText) {
        // Delete one character
        tr.delete($to.pos, $to.pos + 1)
      } else {
        // Delete the whole inline node
        tr.delete($to.pos, $to.pos + nodeAfter.nodeSize)
      }
      dispatch(tr)
    }
  }

  /**
   * Find the cut point after a position - the boundary between the current
   * block and what's after it.
   */
  function findCutAfter($pos: ResolvedPos): ResolvedPos | null {
    // Walk up the tree looking for a place where we have a sibling after us
    for (let i = $pos.depth - 1; i >= 0; i--) {
      const parent = $pos.node(i)
      if ($pos.index(i) + 1 < parent.childCount) {
        // There's a sibling after at this depth
        return $pos.doc.resolve($pos.after(i + 1))
      }
    }
    return null
  }

  // Handle Delete Word
  const handleDeleteWord = (currentState: EditorState, dir: number) => {
    const { $from, $to, empty } = currentState.selection
    const tr = currentState.tr()

    if (!empty) {
      tr.deleteSelection()
    } else {
      // Simple word deletion - just delete to word boundary
      // Full implementation would use proper word boundary detection
      const text = $from.parent.textContent
      const offset = $from.parentOffset

      if (dir < 0) {
        // Delete backward to word boundary
        let start = offset
        while (start > 0 && /\s/.test(text[start - 1])) start--
        while (start > 0 && /\S/.test(text[start - 1])) start--
        const deleteFrom = $from.pos - (offset - start)
        tr.delete(deleteFrom, $from.pos)
      } else {
        // Delete forward to word boundary
        let end = offset
        while (end < text.length && /\S/.test(text[end])) end++
        while (end < text.length && /\s/.test(text[end])) end++
        const deleteTo = $from.pos + (end - offset)
        tr.delete($from.pos, deleteTo)
      }
    }

    dispatch(tr)
  }

  // Handle Delete Line
  const handleDeleteLine = (currentState: EditorState, dir: number) => {
    const { $from } = currentState.selection
    const tr = currentState.tr()

    if (dir < 0) {
      // Delete from line start to cursor
      const lineStart = $from.pos - $from.parentOffset
      tr.delete(lineStart, $from.pos)
    } else {
      // Delete from cursor to line end
      const lineEnd = $from.pos + ($from.parent.content.size - $from.parentOffset)
      tr.delete($from.pos, lineEnd)
    }

    dispatch(tr)
  }

  // Handle composition events
  const handleCompositionStart = () => {
    composing = true
  }

  const handleCompositionEnd = (event: CompositionEvent) => {
    composing = false
    // Handle the composed text
    if (event.data && containerRef) {
      const currentState = state()
      const tr = currentState.tr()
      tr.replaceSelectionWith(currentState.schema.text(event.data), true)
      dispatch(tr)
    }
  }

  // Handle copy event
  const handleCopy = (event: ClipboardEvent) => {
    const currentState = state()
    const { from, to, empty } = currentState.selection
    if (empty) return // Nothing to copy

    // Get text between selection, with double newlines between paragraphs
    const text = currentState.doc.textBetween(from, to, '\n\n')
    event.clipboardData?.setData('text/plain', text)
    event.preventDefault()
  }

  // Handle cut event
  const handleCut = (event: ClipboardEvent) => {
    handleCopy(event)
    const currentState = state()
    if (!currentState.selection.empty) {
      const tr = currentState.tr()
      tr.deleteSelection()
      dispatch(tr)
    }
  }

  // Handle paste event
  const handlePaste = (event: ClipboardEvent) => {
    event.preventDefault()
    const text = event.clipboardData?.getData('text/plain')
    if (!text) return

    const currentState = state()
    const tr = currentState.tr()

    // Split on double newlines to create paragraphs
    const paragraphs = text.split(/\n\n+/)

    if (paragraphs.length === 1) {
      // Single paragraph - just insert text
      tr.replaceSelectionWith(currentState.schema.text(text), true)
    } else {
      // Multiple paragraphs - create paragraph nodes
      const paragraphType = currentState.schema.nodes.paragraph
      if (!paragraphType) {
        // Fallback: insert as plain text
        tr.replaceSelectionWith(currentState.schema.text(text), true)
      } else {
        const nodes = paragraphs.map((content) =>
          paragraphType.create(null, content ? currentState.schema.text(content) : null),
        )
        const fragment = Fragment.from(nodes)
        // Use openStart=1, openEnd=1 to properly split the current paragraph:
        // - First paragraph's content joins with text before cursor
        // - Last paragraph's content joins with text after cursor
        tr.replaceSelection(new Slice(fragment, 1, 1))
      }
    }

    dispatch(tr)
  }

  // Create keymap context getter for the keydown handler
  const getKeymapContext = (): CommandContext | null => {
    if (!containerRef) return null
    return {
      state: state(),
      dispatch,
      dom: containerRef,
      focus: () => containerRef?.focus(),
    }
  }

  // Create keymap handler if keymap is provided
  const keymapHandler = props.keymap ? keydownHandler(props.keymap, getKeymapContext) : null

  // Handle keyboard events (for shortcuts)
  const handleKeyDown = (event: KeyboardEvent) => {
    // First, try the keymap
    if (keymapHandler?.(event)) {
      event.preventDefault()
      return
    }

    // Then, try plugin handleKeyDown props
    if (callPropHandlers(state(), props.props, 'handleKeyDown', getViewRef(), event)) {
      event.preventDefault()
      return
    }

    // Handle Tab key (not handled by keymap by default)
    if (event.key === 'Tab') {
      event.preventDefault()
      // Could insert tab character or indent
    }
  }

  // Get document position from a point (for click handling)
  const posAtCoords = (x: number, y: number): number | null => {
    if (!containerRef) return null

    // Use caretPositionFromPoint or caretRangeFromPoint
    let range: Range | null = null

    if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(x, y)
      if (pos) {
        range = document.createRange()
        range.setStart(pos.offsetNode, pos.offset)
        range.collapse(true)
      }
    } else if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(x, y)
    }

    if (!range || !containerRef.contains(range.startContainer)) {
      return null
    }

    // Convert DOM position to document position
    // Create a minimal selection-like object for posAtCoords
    const sel = selectionFromDOM(state().doc, {
      anchorNode: range.startContainer,
      anchorOffset: range.startOffset,
      focusNode: range.startContainer,
      focusOffset: range.startOffset,
      isCollapsed: true,
      rangeCount: 1,
      getRangeAt: () => range!,
    } as unknown as Selection)

    return sel ? sel.from : null
  }

  // Handle click events
  const handleClick = (event: MouseEvent) => {
    const pos = posAtCoords(event.clientX, event.clientY)
    if (pos !== null) {
      if (callPropHandlers(state(), props.props, 'handleClick', getViewRef(), pos, event)) {
        event.preventDefault()
      }
    }
  }

  // Handle double-click events
  const handleDblClick = (event: MouseEvent) => {
    const pos = posAtCoords(event.clientX, event.clientY)
    if (pos !== null) {
      if (callPropHandlers(state(), props.props, 'handleDoubleClick', getViewRef(), pos, event)) {
        event.preventDefault()
      }
    }
  }

  // Track clicks for triple-click detection
  let lastClickTime = 0
  let lastClickPos: number | null = null
  let clickCount = 0

  const handleMouseDown = (event: MouseEvent) => {
    const now = Date.now()
    const pos = posAtCoords(event.clientX, event.clientY)

    // Detect triple-click (three clicks within 500ms at same position)
    if (now - lastClickTime < 500 && pos !== null && pos === lastClickPos) {
      clickCount++
      if (clickCount >= 3) {
        if (callPropHandlers(state(), props.props, 'handleTripleClick', getViewRef(), pos, event)) {
          event.preventDefault()
        }
        clickCount = 0
      }
    } else {
      clickCount = 1
    }

    lastClickTime = now
    lastClickPos = pos
  }

  // Handle focus
  const handleFocus = () => {
    setFocused(true)
    props.onFocusChange?.(true)
  }

  const handleBlur = () => {
    setFocused(false)
    props.onFocusChange?.(false)
  }

  // Setup event listeners
  onMount(() => {
    document.addEventListener('selectionchange', handleSelectionChange)

    if (props.autoFocus && containerRef) {
      containerRef.focus()
    }
  })

  onCleanup(() => {
    document.removeEventListener('selectionchange', handleSelectionChange)
  })

  // Compute placeholder visibility
  const showPlaceholder = () => {
    const currentState = state()
    return (
      props.placeholder &&
      currentState.doc.content.size === 2 && // Just opening and closing tags
      currentState.doc.textContent === ''
    )
  }

  const debugPosition = () => {
    if (props.debug === true) return 'bottom-right'
    if (typeof props.debug === 'string') return props.debug
    return undefined
  }

  return (
    <EditorContext.Provider value={contextValue}>
      <div style={{ position: 'relative' }} class="solid-editor-wrapper">
        <div
          ref={containerRef}
          class={`solid-editor ${props.class ?? ''} ${focused() ? 'solid-editor-focused' : ''}`}
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
            node={state().doc}
            pos={0}
            nodeViews={props.nodeViews}
            decorations={decorations()}
            selection={state().selection}
            onSelectNode={handleSelectNode}
          />
          {showPlaceholder() && (
            <div
              class="solid-editor-placeholder"
              style={{
                position: 'absolute',
                top: '0',
                left: '0',
                'pointer-events': 'none',
                opacity: '0.5',
              }}
            >
              {props.placeholder}
            </div>
          )}
        </div>
        <Show when={props.debug}>
          <DebugOverlay state={state()} position={debugPosition()} />
        </Show>
      </div>
    </EditorContext.Provider>
  )
}

export default EditorView
