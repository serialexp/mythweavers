import { Component, Show } from 'solid-js'
import styles from './ConflictResolutionDialog.module.css'

interface ConflictResolutionDialogProps {
  isOpen: boolean
  serverUpdatedAt: string
  clientUpdatedAt: string
  onForce: () => void
  onCancel: () => void
}

export const ConflictResolutionDialog: Component<ConflictResolutionDialogProps> = (props) => {
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown'
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'Invalid Date'
    return date.toLocaleString()
  }

  return (
    <Show when={props.isOpen}>
      <div class={styles.overlay} onClick={props.onCancel}>
        <div class={styles.dialog} onClick={(e) => e.stopPropagation()}>
          <h2 class={styles.title}>Version Conflict Detected</h2>
          
          <div class={styles.content}>
            <p class={styles.message}>
              The story on the server has been updated more recently than your local version.
            </p>
            
            <div class={styles.timestamps}>
              <div class={styles.timestamp}>
                <span class={styles.label}>Server version:</span>
                <span class={styles.date}>{formatDate(props.serverUpdatedAt)}</span>
              </div>
              <div class={styles.timestamp}>
                <span class={styles.label}>Your version:</span>
                <span class={styles.date}>{formatDate(props.clientUpdatedAt)}</span>
              </div>
            </div>
            
            <p class={styles.warning}>
              Do you want to overwrite the server version with your changes?
            </p>
          </div>
          
          <div class={styles.actions}>
            <button 
              class={styles.cancelButton}
              onClick={props.onCancel}
            >
              Cancel
            </button>
            <button 
              class={styles.forceButton}
              onClick={props.onForce}
            >
              Force Save
            </button>
          </div>
        </div>
      </div>
    </Show>
  )
}