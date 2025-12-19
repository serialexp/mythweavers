import { Badge, Button, Card, CardBody, Modal, Spinner, Stack } from '@mythweavers/ui'
import { BsArrowClockwise, BsTrash } from 'solid-icons/bs'
import { Component, For, Show, createResource, createSignal } from 'solid-js'
import { currentStoryStore } from '../stores/currentStoryStore'
import { apiClient } from '../utils/apiClient'

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
            <div style={{ 'text-align': 'center', padding: '2rem' }}>
              <Spinner size="md" />
              <div style={{ color: 'var(--text-secondary)', 'margin-top': '0.5rem' }}>Loading deleted turns...</div>
            </div>
          }
        >
          <Show
            when={deletedMessages() && deletedMessages()!.length > 0}
            fallback={
              <div
                style={{
                  'text-align': 'center',
                  padding: '3rem 2rem',
                  color: 'var(--text-secondary)',
                  'font-size': '1.1rem',
                }}
              >
                No deleted story turns found
              </div>
            }
          >
            <Stack gap="md">
              <For each={deletedMessages()}>
                {(message) => (
                  <Card interactive>
                    <CardBody>
                      <div
                        style={{
                          display: 'flex',
                          'justify-content': 'space-between',
                          'align-items': 'center',
                          'margin-bottom': '0.75rem',
                        }}
                      >
                        <div style={{ display: 'flex', 'align-items': 'center', gap: '1rem', 'flex-wrap': 'wrap' }}>
                          <Badge variant="primary">Position #{message.order + 1}</Badge>
                          <span style={{ color: 'var(--text-secondary)', 'font-size': '0.9rem' }}>
                            {formatDate(message.timestamp)}
                          </span>
                          <Show when={message.model}>
                            <Badge variant="secondary">{message.model}</Badge>
                          </Show>
                          <Show when={message.totalTokens}>
                            <span style={{ color: 'var(--text-secondary)', 'font-size': '0.85rem' }}>
                              {message.totalTokens} tokens
                            </span>
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
                        <div
                          style={{
                            'margin-bottom': '0.5rem',
                            color: 'var(--text-secondary)',
                            'font-size': '0.9rem',
                            'font-style': 'italic',
                          }}
                        >
                          <strong>Instruction:</strong> {message.instruction}
                        </div>
                      </Show>
                      <div
                        style={{
                          'line-height': '1.6',
                          color: 'var(--text-primary)',
                          'white-space': 'pre-wrap',
                          'word-wrap': 'break-word',
                        }}
                      >
                        {truncateContent(message.content)}
                      </div>
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
