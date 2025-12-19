import { Button, Input, Spinner, Stack, Textarea } from '@mythweavers/ui'
import { BsCheck, BsPencil, BsTrash, BsX } from 'solid-icons/bs'
import { Component, Show } from 'solid-js'
import type { Landmark } from '../types/core'
import { EJSRenderer } from './EJSRenderer'

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

const popupStyles = {
  container: {
    position: 'absolute' as const,
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    'border-radius': '6px',
    padding: '0.75rem',
    'box-shadow': '0 4px 12px rgba(0, 0, 0, 0.3)',
    'z-index': '1000',
    width: '280px',
    'max-width': 'calc(100vw - 20px)',
    'max-height': '400px',
    'overflow-y': 'auto' as const,
  },
  name: {
    'font-weight': '600',
    color: 'var(--text-primary)',
    'margin-bottom': '0.25rem',
  },
  description: {
    color: 'var(--text-secondary)',
    'font-size': '0.9rem',
    'line-height': '1.4',
  },
  label: {
    color: 'var(--text-secondary)',
    'font-size': '0.9rem',
    'flex-shrink': '0',
  },
  colorInput: {
    width: '60px',
    'flex-shrink': '0',
    padding: '0.25rem',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    'border-radius': '4px',
    cursor: 'pointer',
  },
  colorGrid: {
    display: 'grid',
    'grid-template-columns': 'repeat(4, 1fr)',
    gap: '0.25rem',
    width: '100%',
    'max-width': '100%',
  },
  colorButton: {
    width: '100%',
    'aspect-ratio': '1',
    'border-radius': '50%',
    cursor: 'pointer',
    'max-width': '40px',
    border: '2px solid transparent',
    transition: 'all 0.2s',
  },
  colorButtonSelected: {
    'border-color': 'var(--accent-color)',
    'box-shadow': '0 0 0 2px var(--bg-primary)',
  },
  colorButtonWhite: {
    border: '2px solid var(--border-color)',
  },
  sizeButton: {
    flex: '1',
    padding: '0.4rem 0.6rem',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    'border-radius': '4px',
    cursor: 'pointer',
    'font-size': '0.85rem',
    transition: 'all 0.2s',
  },
  sizeButtonSelected: {
    background: 'var(--accent-bg)',
    color: 'var(--accent-color)',
    'border-color': 'var(--accent-border)',
  },
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
        style={{
          ...popupStyles.container,
          left: `${props.position.x}px`,
          top: `${props.position.y}px`,
        }}
      >
        <Stack gap="sm">
          <Show
            when={props.isEditing}
            fallback=<Show when={props.selectedLandmark}>
              <div style={popupStyles.name}>
                <EJSRenderer template={props.selectedLandmark!.name} mode="inline" />
              </div>
              <div style={popupStyles.description}>
                <EJSRenderer template={props.selectedLandmark!.description || ''} mode="inline" />
              </div>
              <Stack
                direction="horizontal"
                gap="sm"
                style={{
                  'margin-top': '0.5rem',
                  'padding-top': '0.5rem',
                  'border-top': '1px solid var(--border-color)',
                }}
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
            <Stack gap="sm" style={{ width: '100%' }}>
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
                  <span style={popupStyles.label}>Color:</span>
                  <input
                    type="color"
                    style={popupStyles.colorInput}
                    value={props.editColor}
                    onInput={(e) => props.onEditColor(e.currentTarget.value)}
                  />
                </Stack>
                <div style={popupStyles.colorGrid}>
                  {colorOptions.map((color) => (
                    <button
                      style={{
                        ...popupStyles.colorButton,
                        'background-color': color,
                        ...(props.editColor === color ? popupStyles.colorButtonSelected : {}),
                        ...(color === '#ffffff' ? popupStyles.colorButtonWhite : {}),
                      }}
                      onClick={() => props.onEditColor(color)}
                    />
                  ))}
                </div>
              </Stack>

              {/* Size picker */}
              <Stack gap="xs">
                <span style={popupStyles.label}>Size:</span>
                <Stack direction="horizontal" gap="xs">
                  <button
                    style={{
                      ...popupStyles.sizeButton,
                      ...(props.editSize === 'small' ? popupStyles.sizeButtonSelected : {}),
                    }}
                    onClick={() => props.onEditSize('small')}
                  >
                    Small
                  </button>
                  <button
                    style={{
                      ...popupStyles.sizeButton,
                      ...(props.editSize === 'medium' ? popupStyles.sizeButtonSelected : {}),
                    }}
                    onClick={() => props.onEditSize('medium')}
                  >
                    Medium
                  </button>
                  <button
                    style={{
                      ...popupStyles.sizeButton,
                      ...(props.editSize === 'large' ? popupStyles.sizeButtonSelected : {}),
                    }}
                    onClick={() => props.onEditSize('large')}
                  >
                    Large
                  </button>
                </Stack>
              </Stack>

              <Stack direction="horizontal" gap="sm" style={{ 'margin-top': '0.5rem' }}>
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
