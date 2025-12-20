import { Badge, Modal, Stack } from '@mythweavers/ui'
import { Component, For, Show } from 'solid-js'
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

export const ContextPreviewModal: Component<ContextPreviewModalProps> = (props) => {
  console.log('[ContextPreviewModal] Rendering, show:', props.show, 'has data:', !!props.data)

  // Log when modal visibility changes
  if (props.show && props.data) {
    console.log('[ContextPreviewModal] Modal is visible with', props.data.messages.length, 'messages')
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
                <Show when={msg.cache_control}>
                  <span title={`Cache TTL: ${msg.cache_control?.ttl || '5m'}`}>
                    <Badge variant="success">Cached</Badge>
                  </span>
                </Show>
              </Stack>
              <pre class={styles.codeBlock}>
                {msg.content.length > 50000
                  ? `${msg.content.substring(0, 50000)}\n\n[Content truncated - too large to display]`
                  : msg.content}
              </pre>
            </div>
          )}
        </For>
      </Stack>
    </Modal>
  )
}
