import { Component, createSignal, createEffect, Show, For } from 'solid-js';
import { Portal } from 'solid-js/web';
import styles from './MessageSorter.module.css';
import { messagesStore } from '../stores/messagesStore';
import { currentStoryStore } from '../stores/currentStoryStore';
import { saveService } from '../services/saveService';
import { BsArrowsMove, BsX, BsChevronUp, BsChevronDown } from 'solid-icons/bs';

interface MessageSorterProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SortableItem {
  id: string;
  type: 'message';
  content: string;
  nodeId: string;
  originalIndex: number;
}

export const MessageSorter: Component<MessageSorterProps> = (props) => {
  const [items, setItems] = createSignal<SortableItem[]>([]);
  const [hasChanges, setHasChanges] = createSignal(false);
  const [draggedItem, setDraggedItem] = createSignal<SortableItem | null>(null);
  const [dragOverIndex, setDragOverIndex] = createSignal<number | null>(null);

  createEffect(() => {
    if (!props.isOpen) return;

    // Combine messages and chapter markers into a single sorted list
    const allItems: SortableItem[] = [];
    
    // Add all messages (chapter markers no longer exist)
    messagesStore.messages.forEach((msg) => {
      allItems.push({
        id: msg.id,
        type: 'message',
        content: msg.content,
        nodeId: msg.nodeId || msg.chapterId || '',
        originalIndex: msg.order  // Use the order field from the message
      });
    });

    // Sort by order field
    allItems.sort((a, b) => a.originalIndex - b.originalIndex);
    
    setItems(allItems);
    setHasChanges(false);
  });

  const handleDragStart = (e: DragEvent, item: SortableItem) => {
    setDraggedItem(item);
    e.dataTransfer!.effectAllowed = 'move';
  };

  const handleDragOver = (e: DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragged = draggedItem();
    
    if (!dragged) return;

    const currentItems = [...items()];
    const draggedIndex = currentItems.findIndex(item => item.id === dragged.id);
    
    if (draggedIndex === dropIndex) {
      setDragOverIndex(null);
      return;
    }

    // Remove dragged item and insert at new position
    const [removed] = currentItems.splice(draggedIndex, 1);
    currentItems.splice(dropIndex, 0, removed);

    // Note: We preserve the original nodeId for each item
    // Messages keep their original node attachment

    setItems(currentItems);
    setHasChanges(true);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverIndex(null);
  };

  const moveItemUp = (index: number) => {
    if (index === 0) return;

    const currentItems = [...items()];
    const [item] = currentItems.splice(index, 1);
    currentItems.splice(index - 1, 0, item);

    // Note: We preserve the original nodeId for each item
    // Messages keep their original node attachment

    setItems(currentItems);
    setHasChanges(true);
  };

  const moveItemDown = (index: number) => {
    const currentItems = [...items()];
    if (index === currentItems.length - 1) return;

    const [item] = currentItems.splice(index, 1);
    currentItems.splice(index + 1, 0, item);

    // Note: We preserve the original nodeId for each item
    // Messages keep their original node attachment

    setItems(currentItems);
    setHasChanges(true);
  };

  const handleSave = () => {
    const currentStoryId = currentStoryStore.id;
    if (!currentStoryId) return;

    // Get the current items in their new order
    const reorderedItems = items();

    // Prepare the reorder data for the API
    // We need to get the original nodeId from the messages store, not from items
    const reorderData = reorderedItems.map((item, index) => {
      const originalMessage = messagesStore.messages.find(m => m.id === item.id);
      return {
        messageId: item.id,
        nodeId: originalMessage?.nodeId || item.nodeId,  // Use original nodeId
        order: index  // Include the order field
      };
    });

    // Update the messages in the store to reflect the new order
    // First, create a map of the new order (index only, preserve original nodeId)
    const orderMap = new Map<string, number>();
    reorderedItems.forEach((item, index) => {
      orderMap.set(item.id, index);
    });

    // Update the messages array in the store with the new order
    const updatedMessages = [...messagesStore.messages];

    // Sort messages based on the new order
    updatedMessages.sort((a, b) => {
      const aOrder = orderMap.get(a.id);
      const bOrder = orderMap.get(b.id);
      if (aOrder === undefined || bOrder === undefined) return 0;
      return aOrder - bOrder;
    });

    // Update order values but preserve original node IDs
    const messagesWithNewOrder = updatedMessages.map((msg, index) => {
      return {
        ...msg,
        // Keep the original nodeId - don't overwrite it
        order: index  // Update the order field to match new position
      };
    });

    // Update the store with the reordered messages
    messagesStore.setMessages(messagesWithNewOrder);

    // Add to save queue to persist to backend
    saveService.reorderMessages(currentStoryId, reorderData);

    props.onClose();
  };

  return (
    <Show when={props.isOpen}>
      <Portal>
        <div class={styles.overlay}>
          <div class={styles.container}>
            <div class={styles.header}>
              <h2 class={styles.title}>
                <BsArrowsMove /> Reorder Messages
              </h2>
              <button 
                class={styles.closeButton}
                onClick={props.onClose}
                aria-label="Close"
              >
                <BsX />
              </button>
            </div>

            <div class={styles.content}>
              <ul class={styles.sortableList}>
                <For each={items()}>
                  {(item, index) => (
                    <li
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, item)}
                      onDragOver={(e) => handleDragOver(e, index())}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, index())}
                      onDragEnd={handleDragEnd}
                      class={`${styles.sortableItem} ${
                        draggedItem()?.id === item.id ? styles.isDragging : ''
                      } ${
                        dragOverIndex() === index() ? styles.isOver : ''
                      }`}
                    >
                      <div class={styles.itemContent}>
                        <div class={styles.messagePreview}>
                          {item.content.slice(0, 100)}
                          {item.content.length > 100 && '...'}
                        </div>
                      </div>
                      <div class={styles.itemControls}>
                        <button
                          class={styles.moveButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveItemUp(index());
                          }}
                          disabled={index() === 0}
                          title="Move up"
                        >
                          <BsChevronUp />
                        </button>
                        <button
                          class={styles.moveButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveItemDown(index());
                          }}
                          disabled={index() === items().length - 1}
                          title="Move down"
                        >
                          <BsChevronDown />
                        </button>
                      </div>
                    </li>
                  )}
                </For>
              </ul>
            </div>

            <div class={styles.footer}>
              <button 
                class={styles.button}
                onClick={props.onClose}
              >
                Cancel
              </button>
              <button 
                class={`${styles.button} ${styles.saveButton}`}
                onClick={handleSave}
                disabled={!hasChanges()}
              >
                Save Order
              </button>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  );
};