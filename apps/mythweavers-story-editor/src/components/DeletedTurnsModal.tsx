import { Badge, Button, Card, CardBody, Modal, Spinner, Stack } from '@mythweavers/ui'
import { BsArrowClockwise, BsTrash } from 'solid-icons/bs'
import { Component, For, Show, createResource, createSignal } from 'solid-js'
import { currentStoryStore } from '../stores/currentStoryStore'
import { apiClient } from '../utils/apiClient'
import * as styles from './DeletedTurnsModal.css'

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
    },
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

  const truncateContent = (content: string, maxLength = 200) => {
    if (content.length <= maxLength) return content
    return `${content.substring(0, maxLength)}...`
  }

  return (
    <Modal
      open={props.show}
      onClose={props.onClose}
      title={
        <span style={{ display: 'flex', 'align-items': 'center', gap: '0.5rem' }}>
          <BsTrash /> Deleted Story Turns
        </span>
      }
      size="lg"
    >
      <div style={{ flex: 1, 'overflow-y': 'auto', padding: '1.5rem', 'max-height': 'calc(80vh - 120px)' }}>
        <Show
          when={!deletedMessages.loading}
          fallback={
            <div class={styles.loadingContainer}>
              <Spinner size="md" />
              <div class={styles.loadingText}>Loading deleted turns...</div>
            </div>
          }
        >
          <Show
            when={deletedMessages() && deletedMessages()!.length > 0}
            fallback={<div class={styles.emptyMessage}>No deleted story turns found</div>}
          >
            <Stack gap="md">
              <For each={deletedMessages()}>
                {(message) => (
                  <Card interactive>
                    <CardBody>
                      <div class={styles.messageHeader}>
                        <div class={styles.messageMetaContainer}>
                          <Badge variant="primary">Position #{message.order + 1}</Badge>
                          <span class={styles.messageMeta}>{formatDate(message.timestamp)}</span>
                          <Show when={message.model}>
                            <Badge variant="secondary">{message.model}</Badge>
                          </Show>
                          <Show when={message.totalTokens}>
                            <span class={styles.messageTokens}>{message.totalTokens} tokens</span>
                          </Show>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRestore(message.id)}
                          disabled={restoringId() === message.id}
                          title={`Restore this turn to position ${message.order + 1}`}
                        >
                          <BsArrowClockwise />
                          {restoringId() === message.id ? 'Restoring...' : 'Restore'}
                        </Button>
                      </div>
                      <Show when={message.instruction}>
                        <div class={styles.messageInstruction}>
                          <strong>Instruction:</strong> {message.instruction}
                        </div>
                      </Show>
                      <div class={styles.messageContent}>{truncateContent(message.content)}</div>
                    </CardBody>
                  </Card>
                )}
              </For>
            </Stack>
          </Show>
        </Show>
      </div>
    </Modal>
  )
}
