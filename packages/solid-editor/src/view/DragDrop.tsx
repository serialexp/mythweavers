/**
 * Block-level drag-and-drop for solidjs-editor.
 *
 * Provides sortable reordering of top-level document blocks (paragraphs,
 * headings, blockquotes, lists, tables, etc.) using solidjs-dnd.
 *
 * Architecture:
 * - DragDropProvider wraps the editor content (set up by EditorProvider)
 * - SortableDocView replaces DocView for the doc node, wrapping children
 *   in a SortableContext
 * - Each top-level block gets a SortableBlockWrapper with a drag handle
 * - Drops dispatch a Transaction that deletes + inserts the block at its
 *   new position
 */

import { Show, type JSX, createSignal, createEffect, onMount, onCleanup } from 'solid-js'
import { Portal } from 'solid-js/web'
import {
  DragDropProvider,
  SortableContext,
  createSortable,
  closestCenter,
  createPointerSensor,
  verticalListStrategy,
  type DragEvent as DndDragEvent,
  type UniqueId,
} from '@serialexp/solidjs-dnd'
import type { Node as PMNode } from '../model'
import type { EditorState } from '../state'
import type { Transaction } from '../state/transaction'
import { KeyedFor } from './KeyedFor'
import { NodeView, WidgetsAt, type NodeViewProps } from './NodeView'
import { DecorationSet, type NodeDecoration } from './decoration'
import { registerNodeId, getElementByNodeId } from './selection'
import { useEditor } from './context'

// ─── Move transaction ────────────────────────────────────────────────────────

/**
 * Build a Transaction that moves a top-level block from one position to another.
 *
 * Finds the source and target blocks by node ID, deletes the source, then
 * inserts it at the target position (using the mapping to adjust for the
 * deletion).
 */
export function createBlockMoveTransaction(
  state: EditorState,
  sourceNodeId: string,
  overNodeId: string,
): Transaction | null {
  const doc = state.doc
  let sourceIndex = -1
  let targetIndex = -1

  // Find indices of source and target
  for (let i = 0; i < doc.childCount; i++) {
    const child = doc.child(i)
    if (child.id === sourceNodeId) sourceIndex = i
    if (child.id === overNodeId) targetIndex = i
  }

  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return null

  // Compute position of source block
  let sourcePos = 0
  for (let i = 0; i < sourceIndex; i++) {
    sourcePos += doc.child(i).nodeSize
  }

  const sourceNode = doc.child(sourceIndex)
  const tr = state.tr()

  // Delete the source block
  tr.delete(sourcePos, sourcePos + sourceNode.nodeSize)

  // Compute insert position in the post-delete document.
  // After deletion, indices shift: if source was before target, the target
  // index decreases by 1 in the new document.
  const adjustedTargetIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex

  let insertPos = 0
  for (let i = 0; i < adjustedTargetIndex; i++) {
    insertPos += tr.doc.child(i).nodeSize
  }

  // If we're moving down (source was before target), insert AFTER the target block
  if (sourceIndex < targetIndex) {
    insertPos += tr.doc.child(adjustedTargetIndex).nodeSize
  }

  tr.insert(insertPos, sourceNode)

  return tr
}

// ─── DragDrop context ────────────────────────────────────────────────────────

/**
 * Context for communicating drag state to the editor.
 * The dragging signal suppresses selection sync during drag operations.
 */
const [isDragging, setIsDragging] = createSignal(false)

export { isDragging }

// ─── SortableBlockWrapper ────────────────────────────────────────────────────

interface SortableBlockWrapperProps {
  nodeId: string
  children: JSX.Element
}

/**
 * Makes a block sortable WITHOUT adding wrapper DOM nodes inside contenteditable.
 *
 * We can't add wrapper divs between the doc element and its block children
 * because the selection mapping code expects the DOM structure to match the
 * model exactly. Extra wrapper divs break position resolution.
 *
 * Instead, we:
 * 1. Render children directly (no wrapper) — the block element (p, h1, etc.)
 *    is a direct child of the doc div, preserving the expected DOM structure
 * 2. After render, find the block's DOM element via getElementByNodeId and
 *    apply sortable.ref for measurement/collision detection
 * 3. Apply transform styles directly to the block element during drag
 * 4. Render the drag handle via Portal into the editor wrapper (outside
 *    contenteditable), positioned absolutely to track the block element
 */
function SortableBlockWrapper(props: SortableBlockWrapperProps): JSX.Element {
  const editor = useEditor()
  const sortable = createSortable({ id: props.nodeId })
  let handleRef: HTMLDivElement | undefined
  // Capture the block element once, locally. We deliberately do NOT re-query
  // `getElementByNodeId(props.nodeId)` later: the global reverseNodeMap can
  // be transiently overwritten by other consumers registering the same ID
  // (notably DragOverlay, which re-renders the active node via NodeView and
  // whose ref callback calls registerNodeId, overwriting our entry with a
  // detached clone element after drop). A local ref is stable for the
  // lifetime of this wrapper.
  let blockElement: HTMLElement | undefined

  // After the block renders, find its DOM element and register with sortable.
  onMount(() => {
    blockElement = getElementByNodeId(props.nodeId)
    if (blockElement) {
      sortable.ref(blockElement)
    }
  })

  // Position the drag handle next to its block element.
  //
  // The handle is position:absolute inside the wrapper (position:relative).
  // Its `top` is in wrapper-content coordinates — relative to the wrapper's
  // padding edge, independent of wrapper.scrollTop.
  //
  //   visual_top(handle) = wrapperRect.top + top - wrapper.scrollTop
  //
  // We want visual_top(handle) ≈ blockRect.top + 4, so:
  //
  //   top = blockRect.top - wrapperRect.top + wrapper.scrollTop + 4
  //
  // Without the + scrollTop term, scrolling an internally-scrollable wrapper
  // makes the handle drift at 2x speed: once from the wrapper's own scroll,
  // and again from the recomputed (but scroll-unaware) offset.
  const updateHandlePosition = () => {
    if (!handleRef) return
    const wrapper = editor.wrapperDom()
    if (!blockElement || !wrapper) {
      handleRef.style.display = 'none'
      return
    }
    const wrapperRect = wrapper.getBoundingClientRect()
    const blockRect = blockElement.getBoundingClientRect()
    handleRef.style.display = ''
    handleRef.style.top = `${blockRect.top - wrapperRect.top + wrapper.scrollTop + 4}px`
  }

  // Apply transform styles directly to the block element during drag
  createEffect(() => {
    if (!blockElement) return

    const t = sortable.transform()
    if (t.x === 0 && t.y === 0) {
      blockElement.style.transform = ''
    } else {
      blockElement.style.transform = `translate3d(${t.x}px, ${t.y}px, 0)`
    }

    blockElement.style.transition = sortable.isDragging() || sortable.isSettling()
      ? 'none'
      : 'transform 200ms ease'

    if (sortable.isDragging()) {
      blockElement.classList.add('solidjs-editor-sortable-dragging')
    } else {
      blockElement.classList.remove('solidjs-editor-sortable-dragging')
    }

    // Update handle position to track block during drag
    updateHandlePosition()
  })

  // Update handle on scroll/resize. We listen on the wrapper (for its own
  // scroll), and on window with capture:true so we also catch scroll events
  // from any ancestor scroll container (page scroll, demo wrappers, etc.).
  // During auto-scroll while dragging, the drag translate may not change
  // every frame, so these listeners keep the handle aligned.
  onMount(() => {
    const wrapper = editor.wrapperDom()
    if (wrapper) {
      wrapper.addEventListener('scroll', updateHandlePosition, { passive: true })
    }
    window.addEventListener('scroll', updateHandlePosition, { passive: true, capture: true })
    window.addEventListener('resize', updateHandlePosition, { passive: true })

    onCleanup(() => {
      const wrapper = editor.wrapperDom()
      if (wrapper) {
        wrapper.removeEventListener('scroll', updateHandlePosition)
      }
      window.removeEventListener('scroll', updateHandlePosition, { capture: true } as EventListenerOptions)
      window.removeEventListener('resize', updateHandlePosition)
    })
  })

  // Clean up block element styles
  onCleanup(() => {
    if (blockElement) {
      blockElement.style.transform = ''
      blockElement.style.transition = ''
      blockElement.classList.remove('solidjs-editor-sortable-dragging')
    }
  })

  return (
    <>
      {/* Block content rendered directly — no wrapper div */}
      {props.children}

      {/* Drag handle portaled into the editor wrapper (outside contenteditable) */}
      <Show when={editor.wrapperDom()}>
        {(wrapper) => (
          <Portal mount={wrapper()}>
            <div
              ref={(el) => { handleRef = el; sortable.activatorRef(el) }}
              class="solidjs-editor-drag-handle"
              classList={{ 'solidjs-editor-drag-handle-active': sortable.isDragging() }}
            >
              <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
                <circle cx="2" cy="2" r="1.5" />
                <circle cx="8" cy="2" r="1.5" />
                <circle cx="2" cy="8" r="1.5" />
                <circle cx="8" cy="8" r="1.5" />
                <circle cx="2" cy="14" r="1.5" />
                <circle cx="8" cy="14" r="1.5" />
              </svg>
            </div>
          </Portal>
        )}
      </Show>
    </>
  )
}

// ─── SortableDocView ─────────────────────────────────────────────────────────

/**
 * Get node decoration for a specific node position.
 */
function getNodeDecoration(
  decorations: DecorationSet | undefined,
  from: number,
  to: number,
): NodeDecoration | undefined {
  if (!decorations) return undefined
  return decorations.findNodeAt(from, to)
}

/**
 * Merge attributes from a node decoration into element props.
 */
function withNodeDecorationAttrs(baseClass: string, nodeDec: NodeDecoration | undefined): Record<string, string> {
  const attrs: Record<string, string> = { class: baseClass }
  if (nodeDec?.attrs) {
    if (nodeDec.attrs.class) {
      attrs.class = `${baseClass} ${nodeDec.attrs.class}`
    }
    for (const [key, value] of Object.entries(nodeDec.attrs)) {
      if (key !== 'class') {
        attrs[key] = value
      }
    }
  }
  return attrs
}

/**
 * A doc-level node view that wraps top-level blocks with sortable behavior.
 *
 * Use this as a custom node view for the 'doc' type:
 * ```tsx
 * <EditorProvider
 *   state={state()}
 *   nodeViews={{ doc: SortableDocView }}
 *   blockDragDrop
 * >
 * ```
 */
export function SortableDocView(props: NodeViewProps): JSX.Element {
  const nodeDec = () => getNodeDecoration(props.decorations, props.pos, props.pos + props.node.nodeSize)
  const attrs = () => withNodeDecorationAttrs('solidjs-editor-doc', nodeDec())

  // Collect child node IDs for SortableContext
  const childIds = (): UniqueId[] => {
    const ids: UniqueId[] = []
    props.node.forEach((child) => {
      ids.push(child.id)
    })
    return ids
  }

  // Collect children for rendering
  const getChildren = () => {
    const children: PMNode[] = []
    props.node.forEach((child) => {
      children.push(child)
    })
    return children
  }

  // Compute position for a child at a given index
  const childPos = (index: number): number => {
    let pos = props.pos // doc content starts at pos 0 (no opening token)
    for (let i = 0; i < index; i++) {
      pos += props.node.child(i).nodeSize
    }
    return pos
  }

  return (
    <div {...attrs()} ref={(el) => registerNodeId(el, props.node.id)}>
      <SortableContext ids={childIds()} strategy={verticalListStrategy}>
        {/* Widgets at the start of the doc (before first child) */}
        <Show when={props.decorations}>
          <WidgetsAt decorations={props.decorations!} pos={props.pos} side="before" />
        </Show>

        <KeyedFor each={getChildren()} by={(node) => node.id}>
          {(child, index) => {
            const pos = () => childPos(index())
            const endPos = () => pos() + child().nodeSize
            return (
              <SortableBlockWrapper nodeId={child().id}>
                {/* Widgets before this node */}
                <Show when={props.decorations}>
                  <WidgetsAt decorations={props.decorations!} pos={pos()} side="before" />
                </Show>

                <NodeView
                  node={child()}
                  pos={pos()}
                  nodeViews={props.nodeViews}
                  decorations={props.decorations}
                  selection={props.selection}
                  onSelectNode={props.onSelectNode}
                />

                {/* Widgets after this node */}
                <Show when={props.decorations}>
                  <WidgetsAt decorations={props.decorations!} pos={endPos()} side="after" />
                </Show>
              </SortableBlockWrapper>
            )
          }}
        </KeyedFor>
      </SortableContext>
    </div>
  )
}

// ─── BlockDragDropProvider ───────────────────────────────────────────────────

interface BlockDragDropProviderProps {
  state: () => EditorState
  dispatch: (tr: Transaction) => void
  children: JSX.Element
}

/**
 * Wraps editor content with DragDropProvider and handles the onDragEnd event
 * by dispatching a block move transaction.
 *
 * The active block translates with the pointer directly (via the inline
 * transform applied by SortableBlockWrapper's effect), so no DragOverlay is
 * needed — the block itself is the visual feedback.
 */
export function BlockDragDropProvider(props: BlockDragDropProviderProps): JSX.Element {
  const handleDragStart = () => {
    setIsDragging(true)
  }

  const handleDragEnd = (event: DndDragEvent) => {
    setIsDragging(false)

    if (event.over) {
      const tr = createBlockMoveTransaction(
        props.state(),
        event.active.id as string,
        event.over.id as string,
      )
      if (tr) {
        props.dispatch(tr)
      }
    }
  }

  return (
    <DragDropProvider
      collisionDetection={closestCenter}
      sensors={[createPointerSensor({ activationDistance: 8 })]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {props.children}
    </DragDropProvider>
  )
}
