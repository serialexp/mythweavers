import { createSignal } from 'solid-js'

export type ViewMode = 'normal' | 'reorder' | 'script' | 'read'

interface ViewModeStore {
  viewMode: () => ViewMode
  setViewMode: (mode: ViewMode) => void
  isReorderMode: () => boolean // Keep for backward compatibility
  isScriptMode: () => boolean
  isNormalMode: () => boolean
  isReadMode: () => boolean
}

function createViewModeStore(): ViewModeStore {
  const [viewMode, setViewMode] = createSignal<ViewMode>('normal')

  return {
    viewMode,
    setViewMode,
    isReorderMode: () => viewMode() === 'reorder',
    isScriptMode: () => viewMode() === 'script',
    isNormalMode: () => viewMode() === 'normal',
    isReadMode: () => viewMode() === 'read',
  }
}

export const viewModeStore = createViewModeStore()
