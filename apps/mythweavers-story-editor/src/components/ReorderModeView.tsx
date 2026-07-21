import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js'
import { saveService } from '../services/saveService'
import { currentStoryStore } from '../stores/currentStoryStore'
import { messagesStore } from '../stores/messagesStore'
import { nodeStore } from '../stores/nodeStore'
import { uiStore } from '../stores/uiStore'
import { viewModeStore } from '../stores/viewModeStore'
import { createDisplayMessagesMemo } from '../utils/messageFiltering'
import { InsertControls } from './InsertControls'
import * as styles from './ReorderModeView.css'
import { PhArrowsOutCardinalIcon, PhCaretDownIcon, PhCaretUpIcon, PhCheckIcon, PhScissorsIcon, PhTrashIcon, PhXIcon } from 'solidjs-phosphor'

interface ReorderModeViewProps {
  isGenerating: boolean
}

export function ReorderModeView(_props: ReorderModeViewProps) {
  const displayMessages = createDisplayMessagesMemo()

  // Get the currently selected node (scene)
  const selectedNode = createMemo(() => {
    const node = nodeStore.getSelectedNode()
    if (node && node.type === 'scene') {
      return node
    }
    return null
  })

  const [reorderItems, setReorderItems] = createSignal<
    Array<{
      id: string
      type: 'message'
      content: string
      sceneId: string
      originalIndex: number
    }>
  >([])
  const [hasReorderChanges, setHasReorderChanges] = createSignal(false)
  const [draggedItem, setDraggedItem] = createSignal<any>(null)
  const [dragOverIndex, setDragOverIndex] = createSignal<number | null>(null)
  const [expandedItems, setExpandedItems] = createSignal<Set<string>>(new Set())

  // --- Touch (mobile) long-press drag-to-reorder ---
  // HTML5 drag events never fire on touch devices, so we add an iOS-style
  // "press and hold to lift, then drag" gesture that reuses the same
  // reorderItems() signal the desktop drag path writes to.
  const [touchDragId, setTouchDragId] = createSignal<string | null>(null)
  let listEl: HTMLUListElement | undefined
  let longPressTimer: ReturnType<typeof setTimeout> | null = null
  let touchStartY = 0
  let touchArmed = false
  let scrollParent: HTMLElement | Window = window

  const LONG_PRESS_MS = 450
  const MOVE_CANCEL_PX = 10
  const EDGE_ZONE_PX = 60
  const AUTO_SCROLL_PX = 10

  const getScrollParent = (el: HTMLElement | null): HTMLElement | Window => {
    let node = el?.parentElement ?? null
    while (node) {
      const overflowY = getComputedStyle(node).overflowY
      if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
        return node
      }
      node = node.parentElement
    }
    return window
  }

  const clearLongPress = () => {
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer)
      longPressTimer = null
    }
  }

  const endTouchDrag = () => {
    clearLongPress()
    touchArmed = false
    setTouchDragId(null)
  }

  const autoScroll = (clientY: number) => {
    const parent = scrollParent
    if (parent === window) {
      if (clientY < EDGE_ZONE_PX) window.scrollBy(0, -AUTO_SCROLL_PX)
      else if (clientY > window.innerHeight - EDGE_ZONE_PX) window.scrollBy(0, AUTO_SCROLL_PX)
    } else {
      const rect = (parent as HTMLElement).getBoundingClientRect()
      if (clientY < rect.top + EDGE_ZONE_PX) (parent as HTMLElement).scrollTop -= AUTO_SCROLL_PX
      else if (clientY > rect.bottom - EDGE_ZONE_PX) (parent as HTMLElement).scrollTop += AUTO_SCROLL_PX
    }
  }

  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return
    const target = e.target as HTMLElement | null
    // Let the action buttons (cut / move up / move down) handle their own taps.
    if (target?.closest('button')) return
    const row = target?.closest('[data-reorder-index]') as HTMLElement | null
    if (!row) return

    const id = row.dataset.reorderId
    if (!id) return

    touchStartY = e.touches[0].clientY
    touchArmed = false
    scrollParent = getScrollParent(listEl ?? null)

    clearLongPress()
    longPressTimer = setTimeout(() => {
      touchArmed = true
      setTouchDragId(id)
      // Haptic feedback where supported (no-op on iOS Safari).
      navigator.vibrate?.(10)
    }, LONG_PRESS_MS)
  }

  const handleTouchMove = (e: TouchEvent) => {
    const touch = e.touches[0]
    if (!touch) return

    // Before the long-press fires, a real move means the user is scrolling.
    if (!touchArmed) {
      if (Math.abs(touch.clientY - touchStartY) > MOVE_CANCEL_PX) clearLongPress()
      return
    }

    // Armed: we own this gesture now — stop the page from scrolling.
    e.preventDefault()
    autoScroll(touch.clientY)

    const draggedId = touchDragId()
    if (!draggedId) return

    const el = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null
    const overRow = el?.closest('[data-reorder-index]') as HTMLElement | null
    if (!overRow) return

    const targetIndex = Number(overRow.dataset.reorderIndex)
    if (Number.isNaN(targetIndex)) return

    const items = reorderItems()
    const fromIndex = items.findIndex((item) => item.id === draggedId)
    if (fromIndex === -1 || fromIndex === targetIndex) return

    const next = [...items]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(targetIndex, 0, moved)
    setReorderItems(next)
    setHasReorderChanges(true)
  }

  onMount(() => {
    if (!listEl) return
    // Bind natively with passive:false so touchmove can call preventDefault.
    listEl.addEventListener('touchstart', handleTouchStart, { passive: false })
    listEl.addEventListener('touchmove', handleTouchMove, { passive: false })
    listEl.addEventListener('touchend', endTouchDrag)
    listEl.addEventListener('touchcancel', endTouchDrag)
  })

  onCleanup(() => {
    if (!listEl) return
    listEl.removeEventListener('touchstart', handleTouchStart)
    listEl.removeEventListener('touchmove', handleTouchMove)
    listEl.removeEventListener('touchend', endTouchDrag)
    listEl.removeEventListener('touchcancel', endTouchDrag)
    clearLongPress()
  })

  // Get the last message ID for insert controls at the bottom
  const lastMessageId = createMemo(() => {
    const items = reorderItems()
    return items.length > 0 ? items[items.length - 1].id : null
  })

  // Initialize reorder items when component mounts
  createEffect(() => {
    const items: Array<{
      id: string
      type: 'message'
      content: string
      sceneId: string
      originalIndex: number
    }> = []

    // Use the filtered messages for reordering
    displayMessages().forEach((msg) => {
      items.push({
        id: msg.id,
        type: 'message',
        content: msg.content,
        sceneId: msg.sceneId || '',
        originalIndex: msg.order,
      })
    })

    // Sort by order field
    items.sort((a, b) => a.originalIndex - b.originalIndex)

    setReorderItems(items)
    setHasReorderChanges(false)
    setExpandedItems(new Set<string>())
  })

  const toggleExpanded = (itemId: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }

  const handleDragStart = (e: DragEvent, item: any) => {
    setDraggedItem(item)
    e.dataTransfer!.effectAllowed = 'move'
  }

  const handleDragOver = (e: DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer!.dropEffect = 'move'
    setDragOverIndex(index)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = (e: DragEvent, dropIndex: number) => {
    e.preventDefault()
    const dragged = draggedItem()

    if (!dragged) return

    const currentItems = [...reorderItems()]
    const draggedIndex = currentItems.findIndex((item) => item.id === dragged.id)

    if (draggedIndex === dropIndex) {
      setDragOverIndex(null)
      return
    }

    // Remove dragged item and insert at new position
    const [removed] = currentItems.splice(draggedIndex, 1)
    currentItems.splice(dropIndex, 0, removed)

    setReorderItems(currentItems)
    setHasReorderChanges(true)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
    setDragOverIndex(null)
  }

  const moveItemUp = (index: number) => {
    if (index === 0) return

    const currentItems = [...reorderItems()]
    const [item] = currentItems.splice(index, 1)
    currentItems.splice(index - 1, 0, item)

    setReorderItems(currentItems)
    setHasReorderChanges(true)
  }

  const moveItemDown = (index: number) => {
    const currentItems = [...reorderItems()]
    if (index === currentItems.length - 1) return

    const [item] = currentItems.splice(index, 1)
    currentItems.splice(index + 1, 0, item)

    setReorderItems(currentItems)
    setHasReorderChanges(true)
  }

  const saveReorder = () => {
    const currentStoryId = currentStoryStore.id
    if (!currentStoryId) return

    // Get the current items in their new order
    const reorderedItems = reorderItems()

    // Prepare the reorder data for the API
    const reorderData = reorderedItems.map((item, index) => ({
      messageId: item.id,
      sceneId: item.sceneId,
      order: index,
    }))

    // Update the messages in the store to reflect the new order
    const reorderMap = new Map(reorderData.map((item) => [item.messageId, item]))

    // Update the affected messages in the store
    const allMessages = messagesStore.messages.map((msg) => {
      const reorderInfo = reorderMap.get(msg.id)
      if (reorderInfo) {
        // This message was reordered, update its order and sceneId
        return {
          ...msg,
          sceneId: reorderInfo.sceneId,
          order: reorderInfo.order,
        }
      }
      // Message wasn't part of the reorder, keep it as is
      return msg
    })

    // Update the store with the modified messages
    messagesStore.setMessages(allMessages)

    // Add to save queue to persist to backend
    saveService.reorderMessages(currentStoryId, reorderData)

    // Exit reorder mode
    viewModeStore.setViewMode('normal')

    // Clear reorder state
    setHasReorderChanges(false)
  }

  const cancelReorder = () => {
    viewModeStore.setViewMode('normal')
  }

  const selectedCount = createMemo(() => uiStore.getCutMessageCount())

  const discardSelected = () => {
    const cutIds = Array.from(uiStore.cutMessageIds)
    if (cutIds.length === 0) return

    // Soft-delete each selected message
    for (const messageId of cutIds) {
      messagesStore.deleteMessage(messageId)
    }

    // Remove discarded items from the reorder list
    setReorderItems((items) => items.filter((item) => !cutIds.includes(item.id)))

    // Clear the selection
    uiStore.clearCut()
  }

  const handleCutToggle = (event: MouseEvent, messageId: string) => {
    event.stopPropagation()

    // Check if we're on a touch device (mobile/tablet)
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0

    if (isTouchDevice) {
      // On mobile: always toggle (add to selection or remove)
      uiStore.toggleCutMessage(messageId)
    } else {
      // On desktop: check for modifier keys
      if (event.shiftKey && uiStore.hasCutMessage()) {
        // Shift-click: select range from lowest selected to clicked
        const items = reorderItems()
        const clickedIndex = items.findIndex((item) => item.id === messageId)
        if (clickedIndex === -1) return

        // Find the lowest index (furthest up) among currently selected
        const selectedIndices = items
          .map((item, idx) => (uiStore.isCut(item.id) ? idx : -1))
          .filter((idx) => idx !== -1)
        const lowestSelectedIndex = Math.min(...selectedIndices)

        // Select all between lowest selected and clicked (inclusive)
        const startIdx = Math.min(lowestSelectedIndex, clickedIndex)
        const endIdx = Math.max(lowestSelectedIndex, clickedIndex)

        for (let i = startIdx; i <= endIdx; i++) {
          uiStore.addCutMessage(items[i].id)
        }
      } else if (event.ctrlKey || event.metaKey) {
        uiStore.toggleCutMessage(messageId)
      } else {
        // Without modifier: replace selection
        if (uiStore.isCut(messageId)) {
          uiStore.removeCutMessage(messageId)
        } else {
          uiStore.setCutMessage(messageId)
        }
      }
    }
  }

  return (
    <>
      <div class={styles.reorderModeHeader}>
        <h3 class={styles.reorderTitle}>
          <PhArrowsOutCardinalIcon /> Reorder Messages
        </h3>
        <div class={styles.reorderActions}>
          <Show when={selectedCount() > 0}>
            <button class={styles.discardButton} onClick={discardSelected}>
              <PhTrashIcon /> Discard Selected ({selectedCount()})
            </button>
          </Show>
          <button class={styles.cancelButton} onClick={cancelReorder}>
            <PhXIcon /> Cancel
          </button>
          <button class={styles.saveButton} onClick={saveReorder} disabled={!hasReorderChanges()}>
            <PhCheckIcon /> Save Order
          </button>
        </div>
      </div>

      {/* Insert controls at the beginning of scene */}
      <Show when={selectedNode()}>
        <InsertControls afterMessageId={null} nodeId={selectedNode()?.id} />
      </Show>

      <ul class={`${styles.reorderList} ${touchDragId() ? styles.reorderListDragging : ''}`} ref={listEl}>
        <For each={reorderItems()}>
          {(item, index) => (
            <li
              draggable={true}
              data-reorder-index={index()}
              data-reorder-id={item.id}
              onDragStart={(e) => handleDragStart(e, item)}
              onDragOver={(e) => handleDragOver(e, index())}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index())}
              onDragEnd={handleDragEnd}
              class={`${styles.reorderItem} ${draggedItem()?.id === item.id ? styles.isDragging : ''} ${
                touchDragId() === item.id ? styles.touchDragging : ''
              } ${dragOverIndex() === index() ? styles.isOver : ''} ${uiStore.isCut(item.id) ? styles.reorderItemCut : ''}`}
            >
              <div class={styles.itemContent} onClick={() => toggleExpanded(item.id)} style={{ cursor: 'pointer' }}>
                {expandedItems().has(item.id) ? (
                  // Show full content when expanded (NOT inside messagePreview)
                  <div class={styles.fullContent}>{item.content}</div>
                ) : (
                  // Show a short content preview when collapsed.
                  <div class={styles.messagePreview}>
                    {item.content.slice(0, 200)}
                    {item.content.length > 200 && '...'}
                  </div>
                )}
              </div>
              <div class={styles.itemControls}>
                <button
                  class={`${styles.cutButton} ${uiStore.isCut(item.id) ? styles.cutButtonActive : ''}`}
                  onClick={(e) => handleCutToggle(e, item.id)}
                  title={(() => {
                    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
                    if (uiStore.isCut(item.id)) {
                      return 'Tap to uncut this message'
                    }
                    return isTouchDevice
                      ? 'Tap to cut this message (tap multiple to select multiple)'
                      : 'Cut this message to move it elsewhere (Ctrl/Cmd+Click to multi-select)'
                  })()}
                >
                  <PhScissorsIcon />
                </button>
                <button
                  class={styles.moveButton}
                  onClick={(e) => {
                    e.stopPropagation()
                    moveItemUp(index())
                  }}
                  disabled={index() === 0}
                  title="Move up"
                >
                  <PhCaretUpIcon />
                </button>
                <button
                  class={styles.moveButton}
                  onClick={(e) => {
                    e.stopPropagation()
                    moveItemDown(index())
                  }}
                  disabled={index() === reorderItems().length - 1}
                  title="Move down"
                >
                  <PhCaretDownIcon />
                </button>
              </div>
            </li>
          )}
        </For>
      </ul>

      {/* Insert controls at the end of scene */}
      <Show when={selectedNode()}>
        <InsertControls afterMessageId={lastMessageId()} nodeId={selectedNode()?.id} />
      </Show>
    </>
  )
}
