import { BsArrowsMove, BsCheck, BsChevronDown, BsChevronUp, BsScissors, BsX } from 'solid-icons/bs'
import { For, createEffect, createSignal } from 'solid-js'
import { saveService } from '../services/saveService'
import { currentStoryStore } from '../stores/currentStoryStore'
import { messagesStore } from '../stores/messagesStore'
import { uiStore } from '../stores/uiStore'
import { viewModeStore } from '../stores/viewModeStore'
import { createDisplayMessagesMemo } from '../utils/messageFiltering'
import * as styles from './ReorderModeView.css'

interface ReorderModeViewProps {
  isGenerating: boolean
}

export function ReorderModeView(_props: ReorderModeViewProps) {
  const displayMessages = createDisplayMessagesMemo()

  const [reorderItems, setReorderItems] = createSignal<
    Array<{
      id: string
      type: 'message'
      content: string
      summary?: string
      nodeId: string
      originalIndex: number
    }>
  >([])
  const [hasReorderChanges, setHasReorderChanges] = createSignal(false)
  const [draggedItem, setDraggedItem] = createSignal<any>(null)
  const [dragOverIndex, setDragOverIndex] = createSignal<number | null>(null)
  const [expandedItems, setExpandedItems] = createSignal<Set<string>>(new Set())

  // Initialize reorder items when component mounts
  createEffect(() => {
    const items: Array<{
      id: string
      type: 'message'
      content: string
      summary?: string
      nodeId: string
      originalIndex: number
    }> = []

    // Use the filtered messages for reordering
    displayMessages().forEach((msg) => {
      items.push({
        id: msg.id,
        type: 'message',
        content: msg.content,
        summary: msg.summary,
        nodeId: msg.nodeId || msg.chapterId || '',
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
      nodeId: item.nodeId,
      order: index,
    }))

    // Update the messages in the store to reflect the new order
    const reorderMap = new Map(reorderData.map((item) => [item.messageId, item]))

    // Update the affected messages in the store
    const allMessages = messagesStore.messages.map((msg) => {
      const reorderInfo = reorderMap.get(msg.id)
      if (reorderInfo) {
        // This message was reordered, update its order and nodeId
        return {
          ...msg,
          nodeId: reorderInfo.nodeId,
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

  const handleCutToggle = (event: MouseEvent, messageId: string) => {
    event.stopPropagation()

    // Check if we're on a touch device (mobile/tablet)
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0

    if (isTouchDevice) {
      // On mobile: always toggle (add to selection or remove)
      uiStore.toggleCutMessage(messageId)
    } else {
      // On desktop: check for modifier keys
      if (event.ctrlKey || event.metaKey) {
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
          <BsArrowsMove /> Reorder Messages
        </h3>
        <div class={styles.reorderActions}>
          <button class={styles.cancelButton} onClick={cancelReorder}>
            <BsX /> Cancel
          </button>
          <button class={styles.saveButton} onClick={saveReorder} disabled={!hasReorderChanges()}>
            <BsCheck /> Save Order
          </button>
        </div>
      </div>
      <ul class={styles.reorderList}>
        <For each={reorderItems()}>
          {(item, index) => (
            <li
              draggable={true}
              onDragStart={(e) => handleDragStart(e, item)}
              onDragOver={(e) => handleDragOver(e, index())}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index())}
              onDragEnd={handleDragEnd}
              class={`${styles.reorderItem} ${draggedItem()?.id === item.id ? styles.isDragging : ''} ${
                dragOverIndex() === index() ? styles.isOver : ''
              } ${uiStore.isCut(item.id) ? styles.reorderItemCut : ''}`}
            >
              <div class={styles.itemContent} onClick={() => toggleExpanded(item.id)} style={{ cursor: 'pointer' }}>
                {expandedItems().has(item.id) ? (
                  // Show full content when expanded (NOT inside messagePreview)
                  <div class={styles.fullContent}>{item.content}</div>
                ) : (
                  // Show summary when collapsed (inside messagePreview for clamping)
                  <div class={styles.messagePreview}>
                    {item.summary ? (
                      <div class={styles.summaryText}>{item.summary}</div>
                    ) : (
                      <>
                        {item.content.slice(0, 200)}
                        {item.content.length > 200 && '...'}
                      </>
                    )}
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
                  <BsScissors />
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
                  <BsChevronUp />
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
                  <BsChevronDown />
                </button>
              </div>
            </li>
          )}
        </For>
      </ul>
    </>
  )
}
