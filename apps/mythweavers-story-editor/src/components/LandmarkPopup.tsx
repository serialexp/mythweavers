import { Button, Input, Spinner, Stack, Textarea } from '@mythweavers/ui'
import { BsCheck, BsPencil, BsTrash, BsX } from 'solid-icons/bs'
import { Component, Show } from 'solid-js'
import type { Landmark } from '../types/core'
import { EJSRenderer } from './EJSRenderer'
import * as styles from './LandmarkPopup.css'

interface LandmarkPopupProps {
  selectedLandmark: Landmark | null
  isAddingNew: boolean
  isEditing: boolean
  isSaving: boolean
  editName: string
  editDescription: string
  editColor: string
  editSize: 'small' | 'medium' | 'large'
  position: { x: number; y: number }
  onEditName: (name: string) => void
  onEditDescription: (description: string) => void
  onEditColor: (color: string) => void
  onEditSize: (size: 'small' | 'medium' | 'large') => void
  onSave: () => void
  onCancel: () => void
  onStartEdit: () => void
  onDelete: () => void
  ref?: (el: HTMLDivElement) => void
}

export const LandmarkPopup: Component<LandmarkPopupProps> = (props) => {
  const colorOptions = [
    '#e74c3c', // Red
    '#e67e22', // Orange
    '#f39c12', // Yellow
    '#2ecc71', // Green
    '#3498db', // Blue
    '#9b59b6', // Purple
    '#1abc9c', // Turquoise
    '#34495e', // Dark gray
    '#ffffff', // White
  ]

  return (
    <Show when={props.selectedLandmark || props.isAddingNew}>
      <div
        ref={props.ref}
        class={styles.container}
        style={{
          left: `${props.position.x}px`,
          top: `${props.position.y}px`,
        }}
      >
        <Stack gap="sm">
          <Show
            when={props.isEditing}
            fallback=<Show when={props.selectedLandmark}>
              <div class={styles.name}>
                <EJSRenderer template={props.selectedLandmark!.name} mode="inline" />
              </div>
              <div class={styles.description}>
                <EJSRenderer template={props.selectedLandmark!.description || ''} mode="inline" />
              </div>
              <Stack
                direction="horizontal"
                gap="sm"
                class={styles.actionRow}
              >
                <Button variant="secondary" size="sm" onClick={props.onStartEdit} style={{ flex: '1' }}>
                  <BsPencil /> Edit
                </Button>
                <Button variant="danger" size="sm" onClick={props.onDelete} style={{ flex: '1' }}>
                  <BsTrash /> Delete
                </Button>
              </Stack>
            </Show>
          >
            <Stack gap="sm" class={styles.formContainer}>
              <Input
                type="text"
                placeholder="Landmark name"
                value={props.editName}
                onInput={(e) => props.onEditName(e.currentTarget.value)}
              />
              <Textarea
                placeholder="Description (optional)"
                value={props.editDescription}
                onInput={(e) => props.onEditDescription(e.currentTarget.value)}
                rows={3}
              />

              {/* Color picker */}
              <Stack gap="sm">
                <Stack direction="horizontal" gap="sm" style={{ 'align-items': 'center' }}>
                  <span class={styles.label}>Color:</span>
                  <input
                    type="color"
                    class={styles.colorInput}
                    value={props.editColor}
                    onInput={(e) => props.onEditColor(e.currentTarget.value)}
                  />
                </Stack>
                <div class={styles.colorGrid}>
                  {colorOptions.map((color) => (
                    <button
                      class={`${styles.colorButton} ${props.editColor === color ? styles.colorButtonSelected : ''} ${color === '#ffffff' ? styles.colorButtonWhite : ''}`}
                      style={{ 'background-color': color }}
                      onClick={() => props.onEditColor(color)}
                    />
                  ))}
                </div>
              </Stack>

              {/* Size picker */}
              <Stack gap="xs">
                <span class={styles.label}>Size:</span>
                <Stack direction="horizontal" gap="xs">
                  <button
                    class={`${styles.sizeButton} ${props.editSize === 'small' ? styles.sizeButtonSelected : ''}`}
                    onClick={() => props.onEditSize('small')}
                  >
                    Small
                  </button>
                  <button
                    class={`${styles.sizeButton} ${props.editSize === 'medium' ? styles.sizeButtonSelected : ''}`}
                    onClick={() => props.onEditSize('medium')}
                  >
                    Medium
                  </button>
                  <button
                    class={`${styles.sizeButton} ${props.editSize === 'large' ? styles.sizeButtonSelected : ''}`}
                    onClick={() => props.onEditSize('large')}
                  >
                    Large
                  </button>
                </Stack>
              </Stack>

              <Stack direction="horizontal" gap="sm" class={styles.buttonRow}>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={props.onSave}
                  disabled={!props.editName.trim() || props.isSaving}
                  style={{ flex: '1' }}
                >
                  <Show
                    when={!props.isSaving}
                    fallback={
                      <>
                        <Spinner size="sm" /> Saving...
                      </>
                    }
                  >
                    <BsCheck /> Save
                  </Show>
                </Button>
                <Button variant="secondary" size="sm" onClick={props.onCancel} style={{ flex: '1' }}>
                  <BsX /> Cancel
                </Button>
              </Stack>
            </Stack>
          </Show>
        </Stack>
      </div>
    </Show>
  )
}
