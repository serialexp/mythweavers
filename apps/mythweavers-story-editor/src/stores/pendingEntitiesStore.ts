import { createStore } from 'solid-js/store'

export interface PendingEntity {
  id: string
  type: 'character' | 'theme' | 'location'
  name: string
  description: string
  originalName: string
  isSelected: boolean
}

export interface PendingEntityBatch {
  id: string
  entities: PendingEntity[]
  messageId: string
}

const [pendingEntitiesState, setPendingEntitiesState] = createStore({
  batches: [] as PendingEntityBatch[],
  isVisible: false
})

export const pendingEntitiesStore = {
  // Getters
  get batches() { return pendingEntitiesState.batches },
  get isVisible() { return pendingEntitiesState.isVisible },
  get hasPendingEntities() { return pendingEntitiesState.batches.length > 0 },
  get totalPendingCount() { 
    return pendingEntitiesState.batches.reduce((sum, batch) => sum + batch.entities.length, 0)
  },

  // Actions
  addBatch: (batch: PendingEntityBatch) => {
    setPendingEntitiesState('batches', prev => [...prev, batch])
    setPendingEntitiesState('isVisible', true)
  },

  updateEntity: (batchId: string, entityId: string, updates: Partial<PendingEntity>) => {
    setPendingEntitiesState('batches', batch => batch.id === batchId, 'entities', entity => entity.id === entityId, updates)
  },

  removeBatch: (batchId: string) => {
    setPendingEntitiesState('batches', prev => prev.filter(batch => batch.id !== batchId))
    // Hide modal if no more batches
    if (pendingEntitiesState.batches.length === 1) {
      setPendingEntitiesState('isVisible', false)
    }
  },

  setVisible: (visible: boolean) => {
    setPendingEntitiesState('isVisible', visible)
  },

  clearAll: () => {
    setPendingEntitiesState('batches', [])
    setPendingEntitiesState('isVisible', false)
  }
}