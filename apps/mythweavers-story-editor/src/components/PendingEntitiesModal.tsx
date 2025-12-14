import { Component, For, Show } from 'solid-js'
import { pendingEntitiesStore } from '../stores/pendingEntitiesStore'
import { charactersStore } from '../stores/charactersStore'
import { contextItemsStore } from '../stores/contextItemsStore'
import { BsX, BsCheck, BsPersonFill, BsGeoAltFill, BsTagFill } from 'solid-icons/bs'

export const PendingEntitiesModal: Component = () => {
  const handleApprove = (batchId: string) => {
    const batch = pendingEntitiesStore.batches.find(b => b.id === batchId)
    if (!batch) return

    const selectedEntities = batch.entities.filter(e => e.isSelected)
    
    // Add approved entities to their respective stores
    selectedEntities.forEach(entity => {
      if (entity.type === 'character') {
        charactersStore.addCharacter({
          id: crypto.randomUUID(),
          firstName: entity.name,
          description: entity.description,
          isMainCharacter: false,
        })
      } else {
        contextItemsStore.addContextItem({
          id: crypto.randomUUID(),
          name: entity.name,
          description: entity.description,
          type: entity.type as 'theme' | 'location',
          isGlobal: false  // Default new context items to not global
        })
      }
    })

    // Remove the batch
    pendingEntitiesStore.removeBatch(batchId)
  }

  const handleReject = (batchId: string) => {
    pendingEntitiesStore.removeBatch(batchId)
  }

  const handleToggleEntity = (batchId: string, entityId: string) => {
    const batch = pendingEntitiesStore.batches.find(b => b.id === batchId)
    const entity = batch?.entities.find(e => e.id === entityId)
    if (entity) {
      pendingEntitiesStore.updateEntity(batchId, entityId, { isSelected: !entity.isSelected })
    }
  }

  const handleUpdateName = (batchId: string, entityId: string, newName: string) => {
    pendingEntitiesStore.updateEntity(batchId, entityId, { name: newName })
  }

  const handleUpdateDescription = (batchId: string, entityId: string, newDescription: string) => {
    pendingEntitiesStore.updateEntity(batchId, entityId, { description: newDescription })
  }

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'character': return <BsPersonFill />
      case 'location': return <BsGeoAltFill />
      case 'theme': return <BsTagFill />
      default: return <BsTagFill />
    }
  }

  return (
    <Show when={pendingEntitiesStore.isVisible && pendingEntitiesStore.hasPendingEntities}>
      <div class="pending-entities-overlay">
        <div class="pending-entities-modal">
          <div class="pending-entities-header">
            <h3>New Entities Discovered</h3>
            <button 
              class="close-button"
              onClick={() => pendingEntitiesStore.setVisible(false)}
            >
              <BsX />
            </button>
          </div>

          <div class="pending-entities-content">
            <For each={pendingEntitiesStore.batches}>
              {(batch) => (
                <div class="entity-batch">
                  <div class="batch-header">
                    <h4>From latest story segment</h4>
                    <p>Select which entities to add to your story:</p>
                  </div>

                  <div class="entity-list">
                    <For each={batch.entities}>
                      {(entity) => (
                        <div class={`entity-item ${entity.isSelected ? 'selected' : ''}`}>
                          <div class="entity-header">
                            <label class="entity-checkbox">
                              <input
                                type="checkbox"
                                checked={entity.isSelected}
                                onChange={() => handleToggleEntity(batch.id, entity.id)}
                              />
                              <span class="entity-icon">
                                {getEntityIcon(entity.type)}
                              </span>
                              <input
                                type="text"
                                class="entity-name-input"
                                value={entity.name}
                                onInput={(e) => handleUpdateName(batch.id, entity.id, e.currentTarget.value)}
                                placeholder="Entity name"
                              />
                              <span class="entity-type">({entity.type})</span>
                            </label>
                          </div>
                          <div class="entity-description">
                            <textarea
                              class="entity-description-input"
                              value={entity.description}
                              onInput={(e) => handleUpdateDescription(batch.id, entity.id, e.currentTarget.value)}
                              placeholder="Entity description"
                              rows={3}
                            />
                          </div>
                        </div>
                      )}
                    </For>
                  </div>

                  <div class="batch-actions">
                    <button
                      class="reject-button"
                      onClick={() => handleReject(batch.id)}
                    >
                      Skip All
                    </button>
                    <button
                      class="approve-button"
                      onClick={() => handleApprove(batch.id)}
                    >
                      <BsCheck /> Add Selected
                    </button>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>
    </Show>
  )
}