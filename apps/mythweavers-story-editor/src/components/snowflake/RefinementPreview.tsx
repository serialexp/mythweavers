import { Component, Show } from 'solid-js'
import * as styles from './Snowflake.css'
import { snowflakeStore } from './store'

interface RefinementPreviewProps {
  /** Preview key: a nodeId, or 'story' for the story concept. */
  previewKey: string
}

/** Two-column original-vs-refined preview with Accept / Reject. */
export const RefinementPreview: Component<RefinementPreviewProps> = (props) => {
  const preview = () => snowflakeStore.getPreview(props.previewKey)

  return (
    <Show when={preview()}>
      {(p) => (
        <div class={styles.preview}>
          <div class={styles.previewColumns}>
            <div class={styles.previewColumn}>
              <span class={styles.previewHeading}>Current</span>
              <div class={styles.previewTextOriginal}>{p().original || '(empty)'}</div>
            </div>
            <div class={styles.previewColumn}>
              <span class={styles.previewHeading}>Proposed{p().level ? ` · Level ${p().level}` : ''}</span>
              <div class={styles.previewText}>{p().refined}</div>
            </div>
          </div>
          <div class={styles.previewActions}>
            <button class={styles.actionButton} onClick={() => p().onReject()}>
              Reject
            </button>
            <button class={styles.actionButton} onClick={() => p().onAccept()}>
              Accept
            </button>
          </div>
        </div>
      )}
    </Show>
  )
}
