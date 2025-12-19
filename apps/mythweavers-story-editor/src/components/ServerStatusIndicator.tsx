import { Alert } from '@mythweavers/ui'
import { Component, Show, createSignal } from 'solid-js'
import { authStore } from '../stores/authStore'
import { serverStore } from '../stores/serverStore'

export const ServerStatusIndicator: Component = () => {
  const [dismissed, setDismissed] = createSignal(false)

  // Don't show if in offline mode or if dismissed
  const shouldShow = () =>
    !authStore.isOfflineMode && !serverStore.isAvailable && !serverStore.isChecking && !dismissed()

  return (
    <Show when={shouldShow()}>
      <div
        style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          'z-index': '1000',
          'max-width': '350px',
          animation: 'slideInRight 0.3s ease-out',
        }}
      >
        <Alert variant="warning" title="Server Unavailable" dismissible onDismiss={() => setDismissed(true)}>
          The backend server is not responding. Some features may be limited.
        </Alert>
      </div>
    </Show>
  )
}
