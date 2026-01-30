import { IconButton, StatusIndicator, type StatusIndicatorMode, type StatusIndicatorStatus } from '@mythweavers/ui'
import { Component, createSignal, For, Show } from 'solid-js'
import { saveService } from '../services/saveService'
import { currentStoryStore } from '../stores/currentStoryStore'
import { messagesStore } from '../stores/messagesStore'
import * as styles from './SaveIndicator.css'

// Icons
const SpinnerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 0a8 8 0 1 0 8 8A8.009 8.009 0 0 0 8 0zm0 14A6 6 0 1 1 14 8a6.007 6.007 0 0 1-6 6z" opacity="0.3" />
    <path d="M14 8a6 6 0 0 0-6-6V0a8 8 0 0 1 8 8z" />
  </svg>
)

const QueueIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M2 2a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1H2V2zm0 3v1h12V5H2zm0 3v1h12V8H2zm0 3v1h12v-1H2zm0 3v1a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1H2z" />
  </svg>
)

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
  </svg>
)

// Format operation type for display
const formatOperationType = (type: string): string => {
  // Convert kebab-case to Title Case
  return type
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Get entity description from operation
const getEntityDescription = (operation: { entityId: string; data?: unknown }): string => {
  const { entityId, data } = operation

  // Try to extract a meaningful name from the data
  if (data && typeof data === 'object' && data !== null) {
    const dataObj = data as Record<string, unknown>
    if ('name' in dataObj && typeof dataObj.name === 'string') {
      return dataObj.name
    }
    if ('title' in dataObj && typeof dataObj.title === 'string') {
      return dataObj.title
    }
    if ('content' in dataObj && typeof dataObj.content === 'string') {
      // Truncate content to first 30 chars
      const content = dataObj.content
      return content.length > 30 ? `${content.slice(0, 30)}...` : content
    }
  }

  // Fall back to entity ID (truncated)
  if (entityId.length > 20) {
    return `${entityId.slice(0, 8)}...${entityId.slice(-8)}`
  }
  return entityId
}

export const SaveIndicator: Component = () => {
  const [isPopupOpen, setIsPopupOpen] = createSignal(false)

  const getStatus = (): StatusIndicatorStatus => {
    if (messagesStore.lastSaveError) return 'error'
    if (messagesStore.isSaving) return 'loading'
    return 'success'
  }

  const getMode = (): StatusIndicatorMode => {
    return currentStoryStore.storageMode === 'server' ? 'cloud' : 'local'
  }

  const getTitle = (): string => {
    if (messagesStore.lastSaveError) {
      return messagesStore.lastSaveError
    }
    if (messagesStore.isSaving) {
      return 'Saving...'
    }
    const modeLabel = currentStoryStore.storageMode === 'server' ? 'Cloud' : 'Local'
    const lastSaved = currentStoryStore.lastAutoSaveAt?.toLocaleTimeString() || 'Never'
    return `${modeLabel} - Last saved: ${lastSaved}`
  }

  const getSaveStatus = () => saveService.getStatus()

  const handleClick = () => {
    setIsPopupOpen(!isPopupOpen())
  }

  const handleClose = () => {
    setIsPopupOpen(false)
  }

  return (
    <div class={styles.container}>
      <div class={styles.trigger} onClick={handleClick}>
        <StatusIndicator status={getStatus()} mode={getMode()} title={getTitle()} size="sm" />
      </div>

      <Show when={isPopupOpen()}>
        <div class={styles.backdrop} onClick={handleClose} />
        <div class={styles.popup}>
          <div class={styles.header}>
            <div class={styles.headerLeft}>
              <span class={styles.title}>Save Queue</span>
              <Show when={getSaveStatus().queueLength > 0}>
                <span class={styles.queueBadge}>{getSaveStatus().queueLength}</span>
              </Show>
            </div>
            <IconButton variant="ghost" size="sm" aria-label="Close" onClick={handleClose}>
              <CloseIcon />
            </IconButton>
          </div>

          <div class={styles.content}>
            {/* Current Operation */}
            <Show when={getSaveStatus().currentOperation}>
              {(op) => (
                <div class={styles.section}>
                  <div class={styles.sectionTitle}>In Progress</div>
                  <div class={styles.operationItem}>
                    <span class={styles.operationIconSpinning}>
                      <SpinnerIcon />
                    </span>
                    <div class={styles.operationDetails}>
                      <div class={styles.operationType}>{formatOperationType(op().type)}</div>
                      <div class={styles.operationEntity}>{getEntityDescription(op())}</div>
                    </div>
                  </div>
                </div>
              )}
            </Show>

            {/* Queued Operations */}
            <Show
              when={getSaveStatus().queueLength > 0}
              fallback={
                <Show when={!getSaveStatus().currentOperation}>
                  <div class={styles.emptyState}>No pending operations</div>
                </Show>
              }
            >
              <div class={styles.section}>
                <div class={styles.sectionTitle}>Queued ({getSaveStatus().queueLength})</div>
                <For each={getSaveStatus().queue}>
                  {(operation) => (
                    <div class={styles.operationItem}>
                      <span class={styles.operationIcon}>
                        <QueueIcon />
                      </span>
                      <div class={styles.operationDetails}>
                        <div class={styles.operationType}>{formatOperationType(operation.type)}</div>
                        <div class={styles.operationEntity}>{getEntityDescription(operation)}</div>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            {/* Full Save Status */}
            <Show when={getSaveStatus().isFullSaveInProgress}>
              <div class={styles.section}>
                <div class={styles.sectionTitle}>Full Save</div>
                <div class={styles.operationItem}>
                  <span class={styles.operationIconSpinning}>
                    <SpinnerIcon />
                  </span>
                  <div class={styles.operationDetails}>
                    <div class={styles.operationType}>Saving entire story</div>
                    <div class={styles.operationEntity}>This may include multiple operations</div>
                  </div>
                </div>
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  )
}
