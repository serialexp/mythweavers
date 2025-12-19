import { Component, Show } from 'solid-js'
import { globalOperationStore } from '../stores/globalOperationStore'

export const GlobalStatusIndicator: Component = () => {
  const getOperationLabel = () => {
    const operation = globalOperationStore.operation
    if (!operation) return ''

    switch (operation.type) {
      case 'bulk-summarize':
        return 'Generating summaries'
      case 'migrate-instructions':
        return 'Migrating instructions'
      case 'remove-user-messages':
        return 'Removing user messages'
      case 'cleanup-think-tags':
        return 'Cleaning up think tags'
      default:
        return 'Processing'
    }
  }

  return (
    <Show when={globalOperationStore.operation}>
      <div class="global-status-indicator">
        <div class="global-status-content">
          <div class="global-status-spinner" />
          <div class="global-status-text">
            <div class="global-status-main">
              <span class="global-status-label">{getOperationLabel()}</span>
              <span class="global-status-progress">
                {globalOperationStore.operation?.current} / {globalOperationStore.operation?.total}
              </span>
            </div>
            <Show when={globalOperationStore.operation?.message}>
              <div class="global-status-message-mobile">{globalOperationStore.operation?.message}</div>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  )
}
