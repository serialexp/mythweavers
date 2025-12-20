import { Alert, Button, Input, Stack } from '@mythweavers/ui'
import { Accessor, Component, For, Show, createMemo } from 'solid-js'
import { Hyperlane, Landmark } from '../../types/core'
import * as styles from './HyperlanePopup.css'

export interface HyperlanePopupProps {
  popupRef?: (el: HTMLDivElement) => void
  selectedHyperlane: Accessor<Hyperlane | null>
  popupPosition: Accessor<{ x: number; y: number }>
  landmarks: Accessor<Landmark[]>
  isEditing: Accessor<boolean>
  isDeleting: Accessor<boolean>
  isSaving: Accessor<boolean>
  editSpeedMultiplier: Accessor<string>
  setEditSpeedMultiplier: (value: string) => void
  speedMultiplierError: Accessor<string>
  onStartEditing: () => void
  onSaveHyperlane: () => void
  onCancelEditing: () => void
  onDeleteHyperlane: () => void
  onQuickSaveSpeedMultiplier?: (value: string) => void
}

export const HyperlanePopup: Component<HyperlanePopupProps> = (props) => {
  // Get unique landmark IDs connected to this hyperlane
  const connectedLandmarks = createMemo(() => {
    const hyperlane = props.selectedHyperlane()
    if (!hyperlane) return []

    const landmarkIds = new Set<string>()
    hyperlane.segments.forEach((segment) => {
      if (segment.startLandmarkId) landmarkIds.add(segment.startLandmarkId)
      if (segment.endLandmarkId) landmarkIds.add(segment.endLandmarkId)
    })

    // Get landmark objects by ID
    const landmarksMap = new Map(props.landmarks().map((lm) => [lm.id, lm]))
    return Array.from(landmarkIds)
      .map((id) => landmarksMap.get(id))
      .filter((lm): lm is Landmark => lm !== undefined)
  })

  return (
    <Show when={props.selectedHyperlane()}>
      <div
        ref={props.popupRef}
        class={styles.popup}
        style={{ left: `${props.popupPosition().x}px`, top: `${props.popupPosition().y}px` }}
      >
        <Show
          when={!props.isEditing()}
          fallback={
            <Stack gap="md">
              <h3 class={styles.title}>Edit Hyperlane</h3>
              <div>
                <label class={styles.label}>
                  Speed Multiplier:
                </label>
                <Input
                  type="number"
                  step="0.1"
                  min="1.0"
                  max="20.0"
                  value={props.editSpeedMultiplier()}
                  onInput={(e) => props.setEditSpeedMultiplier(e.currentTarget.value)}
                  placeholder="10.0"
                />
                <Show when={props.speedMultiplierError()}>
                  <Alert variant="error" class={styles.alertMargin}>
                    {props.speedMultiplierError()}
                  </Alert>
                </Show>
                <small class={styles.hint}>
                  How much faster than normal space (1x - 20x)
                </small>
              </div>
              <div class={styles.buttonRow}>
                <Button variant="primary" onClick={props.onSaveHyperlane} disabled={props.isSaving()}>
                  {props.isSaving() ? 'Saving...' : 'Save'}
                </Button>
                <Button variant="secondary" onClick={props.onCancelEditing}>
                  Cancel
                </Button>
              </div>
            </Stack>
          }
        >
          <Stack gap="sm">
            <h3 class={styles.title}>Hyperlane</h3>
            <p class={styles.paragraph}>
              <strong>Speed Multiplier:</strong> {props.selectedHyperlane()!.speedMultiplier}x
            </p>
            <div class={styles.quickButtonRow}>
              <Button size="sm" variant="secondary" onClick={() => props.onQuickSaveSpeedMultiplier?.('2.5')}>
                2.5x
              </Button>
              <Button size="sm" variant="secondary" onClick={() => props.onQuickSaveSpeedMultiplier?.('5')}>
                5x
              </Button>
              <Button size="sm" variant="secondary" onClick={() => props.onQuickSaveSpeedMultiplier?.('10')}>
                10x
              </Button>
            </div>
            <p class={styles.paragraph}>
              <strong>Segments:</strong> {props.selectedHyperlane()!.segments.length}
            </p>

            <Show when={connectedLandmarks().length > 0}>
              <p class={styles.paragraph}>
                <strong>Connected to:</strong>
              </p>
              <ul class={styles.connectedList}>
                <For each={connectedLandmarks()}>{(landmark) => <li>{landmark.name}</li>}</For>
              </ul>
            </Show>

            <div class={styles.actionRow}>
              <Button variant="primary" onClick={props.onStartEditing}>
                Edit
              </Button>
              <Button variant="danger" onClick={props.onDeleteHyperlane} disabled={props.isDeleting()}>
                {props.isDeleting() ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </Stack>
        </Show>
      </div>
    </Show>
  )
}
