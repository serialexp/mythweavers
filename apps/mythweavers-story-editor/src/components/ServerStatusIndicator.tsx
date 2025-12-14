import { Component, Show, createSignal } from 'solid-js'
import { serverStore } from '../stores/serverStore'
import { authStore } from '../stores/authStore'
import styles from './ServerStatusIndicator.module.css'

export const ServerStatusIndicator: Component = () => {
  const [dismissed, setDismissed] = createSignal(false)
  
  // Don't show if in offline mode or if dismissed
  const shouldShow = () => 
    !authStore.isOfflineMode && 
    !serverStore.isAvailable && 
    !serverStore.isChecking && 
    !dismissed()
  
  return (
    <Show when={shouldShow()}>
      <div class={styles.serverStatus}>
        <div class={styles.statusIcon}>⚠️</div>
        <div class={styles.statusText}>
          <div class={styles.statusTitle}>Server Unavailable</div>
          <div class={styles.statusMessage}>
            The backend server is not responding. Some features may be limited.
          </div>
        </div>
        <button 
          class={styles.dismissButton}
          onClick={() => setDismissed(true)}
          aria-label="Dismiss notification"
        >
          ✕
        </button>
      </div>
    </Show>
  )
}