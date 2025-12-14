import { Component, Show, For } from 'solid-js'
import { BsX } from 'solid-icons/bs'
import styles from './ContextPreviewModal.module.css'

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
    <Show when={props.show && props.data}>
      <div class={styles.overlay}>
        <div class={styles.modal}>
          <div class={styles.header}>
            <h2>Context Preview - {props.data?.type}</h2>
            <button
              onClick={props.onClose}
              class={styles.closeButton}
              title="Close"
            >
              <BsX />
            </button>
          </div>
          <div class={styles.content}>
            <For each={props.data?.messages}>
              {(msg, index) => (
                <div class={styles.section}>
                  <div class={styles.messageHeader}>
                    <h3>
                      {msg.role === 'system' ? 'System' : 
                       msg.role === 'user' ? 'User' : 
                       'Assistant'} Message {index() + 1}
                    </h3>
                    <Show when={msg.cache_control}>
                      <span class={styles.cacheIndicator} title={`Cache TTL: ${msg.cache_control?.ttl || '5m'}`}>
                        🔒 Cached
                      </span>
                    </Show>
                  </div>
                  <pre class={styles.text}>
                    {msg.content.length > 50000
                      ? msg.content.substring(0, 50000) + '\n\n[Content truncated - too large to display]'
                      : msg.content}
                  </pre>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>
    </Show>
  )
}