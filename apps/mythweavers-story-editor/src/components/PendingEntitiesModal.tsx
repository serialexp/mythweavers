import { Button, Card, CardBody, Input, Modal, Stack, Textarea } from '@mythweavers/ui'
import { BsCheck, BsGeoAltFill, BsPersonFill, BsTagFill } from 'solid-icons/bs'
import { Component, For } from 'solid-js'
import { charactersStore } from '../stores/charactersStore'
import { contextItemsStore } from '../stores/contextItemsStore'
import { pendingEntitiesStore } from '../stores/pendingEntitiesStore'
import * as styles from './PendingEntitiesModal.css'

export const PendingEntitiesModal: Component = () => {
  const handleApprove = (batchId: string) => {
    const batch = pendingEntitiesStore.batches.find((b) => b.id === batchId)
    if (!batch) return

    const selectedEntities = batch.entities.filter((e) => e.isSelected)

    // Add approved entities to their respective stores
    selectedEntities.forEach((entity) => {
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
          isGlobal: false,
        })
      }
    })

    pendingEntitiesStore.removeBatch(batchId)
  }

  const handleReject = (batchId: string) => {
    pendingEntitiesStore.removeBatch(batchId)
  }

  const handleToggleEntity = (batchId: string, entityId: string) => {
    const batch = pendingEntitiesStore.batches.find((b) => b.id === batchId)
    const entity = batch?.entities.find((e) => e.id === entityId)
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
      case 'character':
        return <BsPersonFill />
      case 'location':
        return <BsGeoAltFill />
      case 'theme':
        return <BsTagFill />
      default:
        return <BsTagFill />
    }
  }

  return (
    <Modal
      open={pendingEntitiesStore.isVisible && pendingEntitiesStore.hasPendingEntities}
      onClose={() => pendingEntitiesStore.setVisible(false)}
      title="New Entities Discovered"
      size="lg"
    >
      <Stack direction="vertical" gap="lg" style={{ padding: '1rem' }}>
        <For each={pendingEntitiesStore.batches}>
          {(batch) => (
            <div>
              <div style={{ 'margin-bottom': '1rem' }}>
                <h4 class={styles.sectionHeader}>From latest story segment</h4>
                <p class={styles.sectionDescription}>Select which entities to add to your story:</p>
              </div>

              <Stack direction="vertical" gap="sm" style={{ 'margin-bottom': '1rem' }}>
                <For each={batch.entities}>
                  {(entity) => (
                    <Card variant="outlined" class={entity.isSelected ? styles.entityCardSelected : undefined}>
                      <CardBody padding="sm" gap="sm">
                        <label class={styles.entityLabel}>
                          <input
                            type="checkbox"
                            checked={entity.isSelected}
                            onChange={() => handleToggleEntity(batch.id, entity.id)}
                          />
                          <span class={styles.entityIcon}>{getEntityIcon(entity.type)}</span>
                          <Input
                            value={entity.name}
                            onInput={(e) => handleUpdateName(batch.id, entity.id, e.currentTarget.value)}
                            placeholder="Entity name"
                            size="sm"
                            style={{ 'min-width': '150px', 'font-weight': '500' }}
                          />
                          <span class={styles.entityType}>({entity.type})</span>
                        </label>
                        <Textarea
                          value={entity.description}
                          onInput={(e) => handleUpdateDescription(batch.id, entity.id, e.currentTarget.value)}
                          placeholder="Entity description"
                          rows={3}
                          size="sm"
                        />
                      </CardBody>
                    </Card>
                  )}
                </For>
              </Stack>

              <Stack direction="horizontal" gap="sm" justify="end">
                <Button variant="ghost" onClick={() => handleReject(batch.id)}>
                  Skip All
                </Button>
                <Button onClick={() => handleApprove(batch.id)}>
                  <BsCheck /> Add Selected
                </Button>
              </Stack>
            </div>
          )}
        </For>
      </Stack>
    </Modal>
  )
}
