import { createStore } from 'solid-js/store'
import { saveService } from '../services/saveService'
import { ContextItem } from '../types/core'
import { currentStoryStore } from './currentStoryStore'

const [contextItemsState, setContextItemsState] = createStore({
  contextItems: [] as ContextItem[],
  showContextItems: false,
})

export const contextItemsStore = {
  // Getters
  get contextItems() {
    return contextItemsState.contextItems
  },
  get showContextItems() {
    return contextItemsState.showContextItems
  },

  // Actions
  setContextItems: (contextItems: ContextItem[]) => setContextItemsState('contextItems', contextItems),

  addContextItem: (contextItem: ContextItem) => {
    setContextItemsState('contextItems', (prev) => [...prev, contextItem])
    // SaveService handles local vs server logic
    if (currentStoryStore.id) {
      saveService.createContextItem(currentStoryStore.id, contextItem)
    }
  },

  updateContextItem: (id: string, updates: Partial<ContextItem>) => {
    setContextItemsState('contextItems', (item) => item.id === id, updates)
    // SaveService handles local vs server logic
    if (currentStoryStore.id) {
      const item = contextItemsState.contextItems.find((i) => i.id === id)
      if (item) {
        saveService.updateContextItem(currentStoryStore.id, id, { ...item, ...updates })
      }
    }
  },

  deleteContextItem: (id: string) => {
    setContextItemsState('contextItems', (prev) => prev.filter((item) => item.id !== id))
    // SaveService handles local vs server logic
    if (currentStoryStore.id) {
      saveService.deleteContextItem(currentStoryStore.id, id)
    }
  },

  setShowContextItems: (show: boolean) => setContextItemsState('showContextItems', show),

  toggleContextItems: () => setContextItemsState('showContextItems', !contextItemsState.showContextItems),

  getGlobalContextItems: () => {
    const globalItems = contextItemsState.contextItems.filter((item) => item.isGlobal)
    if (globalItems.length === 0) return ''

    const contextList = globalItems.map((item) => `${item.name}: ${item.description}`).join('\n')

    return `World/Setting Context:\n${contextList}\n\n`
  },
}
