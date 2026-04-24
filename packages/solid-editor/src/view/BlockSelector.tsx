import { type JSX, For, createSignal, onCleanup, onMount } from 'solid-js'
import { useEditor } from './context'
import { getElementByNodeId } from './selection'

interface HandlePosition {
  nodeId: string
  typeName: string
  depth: number
  top: number
  left: number
  height: number
}

/**
 * Overlay that shows clickable block selector handles on the left edge of
 * each ancestor block at the current cursor position.
 *
 * Clicking a handle selects that block, making it the target for toolbar
 * operations like block type changes.
 */
export function BlockSelector(): JSX.Element {
  const editor = useEditor()
  let overlayRef: HTMLDivElement | undefined

  const [handles, setHandles] = createSignal<HandlePosition[]>([])

  // Recompute handle positions when ancestors change or layout shifts
  const updatePositions = () => {
    const container = editor.dom()
    if (!container || !overlayRef) {
      setHandles([])
      return
    }

    const containerRect = overlayRef.getBoundingClientRect()
    const ancestors = editor.blockAncestors()
    const positions: HandlePosition[] = []

    for (const ancestor of ancestors) {
      // Skip the doc node — it's the whole editor, not a selectable block
      if (ancestor.typeName === 'doc') continue

      const el = getElementByNodeId(ancestor.nodeId)
      if (!el) continue

      const rect = el.getBoundingClientRect()
      positions.push({
        nodeId: ancestor.nodeId,
        typeName: ancestor.typeName,
        depth: ancestor.depth,
        top: rect.top - containerRect.top,
        left: rect.left - containerRect.left,
        height: rect.height,
      })
    }

    setHandles(positions)
  }

  // Update on every state change (cursor move, doc change)
  // Using createEffect-free approach: track state in a memo and call updatePositions
  // via requestAnimationFrame for layout-dependent calculations
  let rafId: number | undefined
  const scheduleUpdate = () => {
    if (rafId !== undefined) cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(updatePositions)
  }

  // Watch for state changes to update handle positions
  onMount(() => {
    // Initial positioning
    scheduleUpdate()

    // Re-position on scroll and resize
    const editorEl = editor.dom()
    const scrollParent = editorEl?.closest('.solidjs-editor-wrapper') ?? window
    scrollParent.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate, { passive: true })

    onCleanup(() => {
      if (rafId !== undefined) cancelAnimationFrame(rafId)
      scrollParent.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
    })
  })

  // Track state changes to trigger re-positioning
  // We read state reactively and schedule an update
  let previousSelectedEl: HTMLElement | null = null

  const _trackState = () => {
    // Reading these creates reactive dependencies
    editor.blockAncestors()
    const selected = editor.selectedBlock()
    scheduleUpdate()

    // Maintain data-block-selected on the selected block's DOM element
    if (previousSelectedEl) {
      previousSelectedEl.removeAttribute('data-block-selected')
      previousSelectedEl = null
    }
    if (selected) {
      const el = getElementByNodeId(selected.nodeId)
      if (el) {
        el.setAttribute('data-block-selected', '')
        previousSelectedEl = el
      }
    }

    return null
  }

  const handleClick = (nodeId: string, e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const current = editor.selectedBlock()
    // Toggle: if already selected, deselect (go back to auto)
    if (current?.nodeId === nodeId) {
      editor.selectBlock(null)
    } else {
      editor.selectBlock(nodeId)
    }
  }

  const blockIcon = (typeName: string): string => {
    switch (typeName) {
      case 'paragraph': return '¶'
      case 'heading': return 'H'
      case 'blockquote': return '❝'
      case 'code_block': return '⟨⟩'
      case 'bullet_list': return '•'
      case 'ordered_list': return '#'
      case 'list_item': return '─'
      default: return '■'
    }
  }

  return (
    <div
      ref={overlayRef}
      class="solidjs-editor-block-selector-overlay"
      style={{
        position: 'absolute',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        'pointer-events': 'none',
        'z-index': '5',
      }}
    >
      {/* Reactive tracking — reads signals to trigger updates */}
      {_trackState()}

      <For each={handles()}>
        {(handle) => {
          const isSelected = () => editor.selectedBlock()?.nodeId === handle.nodeId

          return (
            <button
              class="solidjs-editor-block-handle"
              classList={{ 'solidjs-editor-block-handle-selected': isSelected() }}
              style={{
                position: 'absolute',
                top: `${handle.top}px`,
                left: `${handle.left - 28}px`,
                width: '22px',
                height: '22px',
                'pointer-events': 'auto',
                cursor: 'pointer',
                display: 'flex',
                'align-items': 'center',
                'justify-content': 'center',
                'font-size': '12px',
                'line-height': '1',
                border: isSelected() ? '2px solid var(--block-handle-active, #3b82f6)' : '1px solid var(--block-handle-border, #d1d5db)',
                'border-radius': '4px',
                background: isSelected() ? 'var(--block-handle-active-bg, #eff6ff)' : 'var(--block-handle-bg, #fff)',
                color: isSelected() ? 'var(--block-handle-active, #3b82f6)' : 'var(--block-handle-color, #9ca3af)',
                'box-shadow': '0 1px 2px rgba(0,0,0,0.05)',
                opacity: isSelected() ? '1' : '0.7',
                transition: 'opacity 0.15s, border-color 0.15s, background 0.15s',
                padding: '0',
              }}
              title={`Select ${handle.typeName} block`}
              onMouseDown={(e) => handleClick(handle.nodeId, e)}
              onMouseEnter={(e) => {
                const el = getElementByNodeId(handle.nodeId)
                if (el) el.setAttribute('data-block-hover', '')
                ;(e.currentTarget as HTMLElement).style.opacity = '1'
              }}
              onMouseLeave={(e) => {
                const el = getElementByNodeId(handle.nodeId)
                if (el) el.removeAttribute('data-block-hover')
                if (!isSelected()) (e.currentTarget as HTMLElement).style.opacity = '0.7'
              }}
            >
              {blockIcon(handle.typeName)}
            </button>
          )
        }}
      </For>
    </div>
  )
}
