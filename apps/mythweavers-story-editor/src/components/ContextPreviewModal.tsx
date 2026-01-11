import { Badge, Modal, Stack } from '@mythweavers/ui'
import { Component, For, Show, createSignal } from 'solid-js'
import * as styles from './ContextPreviewModal.css'

interface ContextMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  cache_control?: {
    type: 'ephemeral'
    ttl?: '5m' | '1h'
  }
}

interface ContextPreviewData {
  type: string
  messages: ContextMessage[]
}

interface ContextPreviewModalProps {
  show: boolean
  data: ContextPreviewData | null
  onClose: () => void
}

const TRUNCATE_LENGTH = 200

export const ContextPreviewModal: Component<ContextPreviewModalProps> = (props) => {
  const [expandedMessages, setExpandedMessages] = createSignal<Set<number>>(new Set())

  const toggleExpand = (index: number) => {
    setExpandedMessages((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const isExpanded = (index: number) => expandedMessages().has(index)

  const truncateContent = (content: string, index: number) => {
    if (isExpanded(index) || content.length <= TRUNCATE_LENGTH) {
      return content.length > 50000
        ? `${content.substring(0, 50000)}\n\n[Content truncated - too large to display]`
        : content
    }
    return `${content.substring(0, TRUNCATE_LENGTH)}...`
  }

  return (
    <Modal
      open={props.show && !!props.data}
      onClose={props.onClose}
      title={`Context Preview - ${props.data?.type || ''}`}
      size="xl"
    >
      <Stack direction="vertical" gap="lg" style={{ 'max-height': '70vh', 'overflow-y': 'auto', padding: '20px' }}>
        <For each={props.data?.messages}>
          {(msg, index) => (
            <div>
              <Stack direction="horizontal" justify="between" align="center" style={{ 'margin-bottom': '10px' }}>
                <h3 class={styles.messageTitle}>
                  {msg.role === 'system' ? 'System' : msg.role === 'user' ? 'User' : 'Assistant'} Message {index() + 1}
                </h3>
                <Stack direction="horizontal" gap="sm" align="center">
                  <Show when={msg.cache_control}>
                    <Badge variant="success">Cached ({msg.cache_control?.ttl || '5m'})</Badge>
                  </Show>
                  <Show when={msg.content.length > TRUNCATE_LENGTH}>
                    <button class={styles.expandButton} onClick={() => toggleExpand(index())}>
                      {isExpanded(index()) ? 'Collapse' : 'Expand'}
                    </button>
                  </Show>
                </Stack>
              </Stack>
              <pre class={styles.codeBlock}>{truncateContent(msg.content, index())}</pre>
            </div>
          )}
        </For>
      </Stack>
    </Modal>
  )
}
