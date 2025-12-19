import { StatusIndicator, type StatusIndicatorMode, type StatusIndicatorStatus } from '@mythweavers/ui'
import { Component } from 'solid-js'
import { currentStoryStore } from '../stores/currentStoryStore'
import { messagesStore } from '../stores/messagesStore'

export const SaveIndicator: Component = () => {
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

  return <StatusIndicator status={getStatus()} mode={getMode()} title={getTitle()} size="sm" />
}
