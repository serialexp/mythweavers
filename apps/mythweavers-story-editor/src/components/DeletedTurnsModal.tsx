import { Component, Show, createSignal, createResource, For } from 'solid-js'
import { BsTrash, BsArrowClockwise } from 'solid-icons/bs'
import { apiClient } from '../utils/apiClient'
import { currentStoryStore } from '../stores/currentStoryStore'
import styles from './DeletedTurnsModal.module.css'

interface DeletedTurnsModalProps {
  show: boolean
  onClose: () => void
  onRestore?: () => void
}

export const DeletedTurnsModal: Component<DeletedTurnsModalProps> = (props) => {
  const [restoringId, setRestoringId] = createSignal<string | null>(null)

  const [deletedMessages, { refetch }] = createResource(
    () => props.show && currentStoryStore.id,
    async (storyId) => {
      if (!storyId) return []
      return apiClient.getDeletedMessages(storyId, 50)
    }
  )

  const handleRestore = async (messageId: string) => {
    const storyId = currentStoryStore.id
    if (!storyId) return

    setRestoringId(messageId)
    try {
      await apiClient.restoreMessage(storyId, messageId)
      refetch()
      props.onRestore?.()
    } catch (error) {
      console.error('Failed to restore message:', error)
      alert('Failed to restore message')
    } finally {
      setRestoringId(null)
    }
  }

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString()
  }

  const truncateContent = (content: string, maxLength: number = 200) => {
    if (content.length <= maxLength) return content
    return content.substring(0, maxLength) + '...'
  }

  return (
    <Show when={props.show}>
      <div class="modal-overlay" onClick={props.onClose}>
        <div 
          class="modal-content"
          onClick={(e) => e.stopPropagation()}
          style="max-width: 800px; max-height: 80vh; overflow: hidden; display: flex; flex-direction: column;"
        >
          <div class="modal-header">
            <h3 style="display: flex; align-items: center; gap: 0.5rem;">
              <BsTrash /> Deleted Story Turns
            </h3>
            <button
              class="modal-close"
              onClick={props.onClose}
            >
              ×
            </button>
          </div>
          
          <div class={styles.modalBody}>
            <Show
              when={!deletedMessages.loading}
              fallback={<div class={styles.loading}>Loading deleted turns...</div>}
            >
              <Show
                when={deletedMessages() && deletedMessages()!.length > 0}
                fallback={
                  <div class={styles.emptyState}>
                    No deleted story turns found
                  </div>
                }
              >
                <div class={styles.messageList}>
                  <For each={deletedMessages()}>
                    {(message) => (
                      <div class={styles.messageItem}>
                        <div class={styles.messageHeader}>
                          <div class={styles.messageInfo}>
                            <span class={styles.position}>
                              Position #{message.order + 1}
                            </span>
                            <span class={styles.timestamp}>
                              {formatDate(message.timestamp)}
                            </span>
                            <Show when={message.model}>
                              <span class={styles.model}>
                                {message.model}
                              </span>
                            </Show>
                            <Show when={message.totalTokens}>
                              <span class={styles.tokens}>
                                {message.totalTokens} tokens
                              </span>
                            </Show>
                          </div>
                          <button
                            class={styles.restoreButton}
                            onClick={() => handleRestore(message.id)}
                            disabled={restoringId() === message.id}
                            title={`Restore this turn to position ${message.order + 1}`}
                          >
                            <BsArrowClockwise />
                            {restoringId() === message.id ? 'Restoring...' : 'Restore'}
                          </button>
                        </div>
                        <Show when={message.instruction}>
                          <div class={styles.instruction}>
                            <strong>Instruction:</strong> {message.instruction}
                          </div>
                        </Show>
                        <div class={styles.content}>
                          {truncateContent(message.content)}
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  )
}