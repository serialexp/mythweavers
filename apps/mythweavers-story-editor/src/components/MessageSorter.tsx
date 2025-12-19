import { Button, Modal, Stack } from '@mythweavers/ui'
import { BsArrowsMove, BsChevronDown, BsChevronUp } from 'solid-icons/bs'
import { Component, For, JSX, createEffect, createSignal } from 'solid-js'
import { saveService } from '../services/saveService'
import { currentStoryStore } from '../stores/currentStoryStore'
import { messagesStore } from '../stores/messagesStore'

interface MessageSorterProps {
  isOpen: boolean
  onClose: () => void
}

interface SortableItem {
  id: string
  type: 'message'
  content: string
  nodeId: string
  originalIndex: number
}

export const MessageSorter: Component<MessageSorterProps> = (props) => {
  const [items, setItems] = createSignal<SortableItem[]>([])
  const [hasChanges, setHasChanges] = createSignal(false)
  const [draggedItem, setDraggedItem] = createSignal<SortableItem | null>(null)
  const [dragOverIndex, setDragOverIndex] = createSignal<number | null>(null)

  createEffect(() => {
    if (!props.isOpen) return

    // Combine messages and chapter markers into a single sorted list
    const allItems: SortableItem[] = []

    // Add all messages (chapter markers no longer exist)
    messagesStore.messages.forEach((msg) => {
      allItems.push({
        id: msg.id,
        type: 'message',
        content: msg.content,
        nodeId: msg.nodeId || msg.chapterId || '',
        originalIndex: msg.order, // Use the order field from the message
      })
    })

    // Sort by order field
    allItems.sort((a, b) => a.originalIndex - b.originalIndex)

    setItems(allItems)
    setHasChanges(false)
  })

  const handleDragStart = (e: DragEvent, item: SortableItem) => {
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

    const currentItems = [...items()]
    const draggedIndex = currentItems.findIndex((item) => item.id === dragged.id)

    if (draggedIndex === dropIndex) {
      setDragOverIndex(null)
      return
    }

    // Remove dragged item and insert at new position
    const [removed] = currentItems.splice(draggedIndex, 1)
    currentItems.splice(dropIndex, 0, removed)

    // Note: We preserve the original nodeId for each item
    // Messages keep their original node attachment

    setItems(currentItems)
    setHasChanges(true)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
    setDragOverIndex(null)
  }

  const moveItemUp = (index: number) => {
    if (index === 0) return

    const currentItems = [...items()]
    const [item] = currentItems.splice(index, 1)
    currentItems.splice(index - 1, 0, item)

    // Note: We preserve the original nodeId for each item
    // Messages keep their original node attachment

    setItems(currentItems)
    setHasChanges(true)
  }

  const moveItemDown = (index: number) => {
    const currentItems = [...items()]
    if (index === currentItems.length - 1) return

    const [item] = currentItems.splice(index, 1)
    currentItems.splice(index + 1, 0, item)

    // Note: We preserve the original nodeId for each item
    // Messages keep their original node attachment

    setItems(currentItems)
    setHasChanges(true)
  }

  const handleSave = () => {
    const currentStoryId = currentStoryStore.id
    if (!currentStoryId) return

    // Get the current items in their new order
    const reorderedItems = items()

    // Prepare the reorder data for the API
    // We need to get the original nodeId from the messages store, not from items
    const reorderData = reorderedItems.map((item, index) => {
      const originalMessage = messagesStore.messages.find((m) => m.id === item.id)
      return {
        messageId: item.id,
        nodeId: originalMessage?.nodeId || item.nodeId, // Use original nodeId
        order: index, // Include the order field
      }
    })

    // Update the messages in the store to reflect the new order
    // First, create a map of the new order (index only, preserve original nodeId)
    const orderMap = new Map<string, number>()
    reorderedItems.forEach((item, index) => {
      orderMap.set(item.id, index)
    })

    // Update the messages array in the store with the new order
    const updatedMessages = [...messagesStore.messages]

    // Sort messages based on the new order
    updatedMessages.sort((a, b) => {
      const aOrder = orderMap.get(a.id)
      const bOrder = orderMap.get(b.id)
      if (aOrder === undefined || bOrder === undefined) return 0
      return aOrder - bOrder
    })

    // Update order values but preserve original node IDs
    const messagesWithNewOrder = updatedMessages.map((msg, index) => {
      return {
        ...msg,
        // Keep the original nodeId - don't overwrite it
        order: index, // Update the order field to match new position
      }
    })

    // Update the store with the reordered messages
    messagesStore.setMessages(messagesWithNewOrder)

    // Add to save queue to persist to backend
    saveService.reorderMessages(currentStoryId, reorderData)

    props.onClose()
  }

  // Inline styles for sortable items
  const sortableListStyle: JSX.CSSProperties = {
    'list-style': 'none',
    padding: '0',
    margin: '0',
  }

  const sortableItemStyle = (isDragging: boolean, isOver: boolean): JSX.CSSProperties => ({
    background: isOver ? '#3a3a3a' : isDragging ? 'rgba(42, 42, 42, 0.5)' : '#2a2a2a',
    border: `1px solid ${isOver ? '#4a9eff' : '#404040'}`,
    'border-radius': '4px',
    padding: '12px',
    'margin-bottom': '8px',
    cursor: isDragging ? 'grabbing' : 'grab',
    'user-select': 'none',
    display: 'flex',
    'justify-content': 'space-between',
    'align-items': 'center',
    gap: '12px',
    opacity: isDragging ? '0.5' : '1',
  })

  const messagePreviewStyle: JSX.CSSProperties = {
    color: '#d0d0d0',
    'white-space': 'nowrap',
    overflow: 'hidden',
    'text-overflow': 'ellipsis',
    'font-size': '14px',
    flex: '1',
    'min-width': '0',
  }

  const moveButtonStyle: JSX.CSSProperties = {
    background: '#333',
    border: '1px solid #444',
    'border-radius': '4px',
    color: '#e0e0e0',
    width: '32px',
    height: '32px',
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'center',
    cursor: 'pointer',
  }

  return (
    <Modal
      open={props.isOpen}
      onClose={props.onClose}
      title={
        <>
          <BsArrowsMove /> Reorder Messages
        </>
      }
      size="lg"
    >
      <div style={{ 'max-height': '60vh', 'overflow-y': 'auto', padding: '16px' }}>
        <ul style={sortableListStyle}>
          <For each={items()}>
            {(item, index) => (
              <li
                draggable={true}
                onDragStart={(e) => handleDragStart(e, item)}
                onDragOver={(e) => handleDragOver(e, index())}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index())}
                onDragEnd={handleDragEnd}
                style={sortableItemStyle(draggedItem()?.id === item.id, dragOverIndex() === index())}
              >
                <div style={messagePreviewStyle}>
                  {item.content.slice(0, 100)}
                  {item.content.length > 100 && '...'}
                </div>
                <Stack direction="horizontal" gap="xs">
                  <button
                    style={{
                      ...moveButtonStyle,
                      opacity: index() === 0 ? '0.3' : '1',
                      cursor: index() === 0 ? 'not-allowed' : 'pointer',
                    }}
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
                    style={{
                      ...moveButtonStyle,
                      opacity: index() === items().length - 1 ? '0.3' : '1',
                      cursor: index() === items().length - 1 ? 'not-allowed' : 'pointer',
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      moveItemDown(index())
                    }}
                    disabled={index() === items().length - 1}
                    title="Move down"
                  >
                    <BsChevronDown />
                  </button>
                </Stack>
              </li>
            )}
          </For>
        </ul>
      </div>

      <Stack
        direction="horizontal"
        gap="sm"
        justify="end"
        style={{ 'padding-top': '16px', 'border-top': '1px solid var(--border-color)' }}
      >
        <Button variant="secondary" onClick={props.onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={!hasChanges()}>
          Save Order
        </Button>
      </Stack>
    </Modal>
  )
}
