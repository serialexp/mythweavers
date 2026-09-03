import { Component, For, Show, createMemo } from 'solid-js'
import {
  PhArrowLeftIcon,
  PhCheckIcon,
  PhCircleNotchIcon,
  PhPencilSimpleIcon,
  PhTrashIcon,
  PhXIcon,
} from 'solidjs-phosphor'
import { mapEditorStore } from '../../stores/mapEditorStore'
import { mapsStore } from '../../stores/mapsStore'
import { Landmark } from '../../types/core'
import * as styles from '../Maps.css'

export interface PathDetailProps {
  // Callback for navigation (clearing selection is handled by store)
  onBack: () => void
}

/**
 * Inline panel showing path details with view and edit modes.
 * Reads editing state directly from mapEditorStore.
 */
export const PathDetail: Component<PathDetailProps> = (props) => {
  // Get landmarks from mapsStore
  const landmarks = () => mapsStore.selectedMap?.landmarks || []

  // Get unique landmark IDs connected to this path
  const connectedLandmarks = createMemo(() => {
    const path = mapEditorStore.selectedPath
    if (!path) return []

    const landmarkIds = new Set<string>()
    path.segments.forEach((segment) => {
      if (segment.startLandmarkId) landmarkIds.add(segment.startLandmarkId)
      if (segment.endLandmarkId) landmarkIds.add(segment.endLandmarkId)
    })

    // Get landmark objects by ID
    const landmarksMap = new Map(landmarks().map((lm) => [lm.id, lm]))
    return Array.from(landmarkIds)
      .map((id) => landmarksMap.get(id))
      .filter((lm): lm is Landmark => lm !== undefined)
  })

  return (
    <div class={styles.landmarkDetail}>
      {/* Header with back button */}
      <div class={styles.landmarkDetailHeader}>
        <button class={styles.backButton} onClick={props.onBack} title="Back to list">
          <PhArrowLeftIcon />
        </button>
        <span class={styles.landmarkDetailTitle}>Path Details</span>
      </div>

      <div class={styles.landmarkDetailContent}>
        <Show
          when={mapEditorStore.isEditing}
          fallback={
            <Show when={mapEditorStore.selectedPath}>
              <div class={styles.landmarkDetails}>
                <div class={styles.landmarkDetailRow}>
                  <span class={styles.landmarkDetailLabel}>Speed Multiplier:</span>
                  <span class={styles.landmarkDetailValue}>{mapEditorStore.selectedPath!.speedMultiplier}x</span>
                </div>
                <div class={styles.landmarkDetailRow}>
                  <span class={styles.landmarkDetailLabel}>Segments:</span>
                  <span class={styles.landmarkDetailValue}>{mapEditorStore.selectedPath!.segments.length}</span>
                </div>
              </div>

              {/* Quick speed buttons */}
              <div class={styles.quickSpeedButtons}>
                <span class={styles.landmarkDetailLabel}>Quick set:</span>
                <div class={styles.sizeButtons}>
                  <button
                    type="button"
                    class={styles.sizeButton}
                    onClick={() => mapEditorStore.quickSaveSpeedMultiplier('2.5')}
                  >
                    2.5x
                  </button>
                  <button
                    type="button"
                    class={styles.sizeButton}
                    onClick={() => mapEditorStore.quickSaveSpeedMultiplier('5')}
                  >
                    5x
                  </button>
                  <button
                    type="button"
                    class={styles.sizeButton}
                    onClick={() => mapEditorStore.quickSaveSpeedMultiplier('10')}
                  >
                    10x
                  </button>
                </div>
              </div>

              <Show when={connectedLandmarks().length > 0}>
                <div class={styles.connectedLandmarks}>
                  <span class={styles.landmarkDetailLabel}>Connected to:</span>
                  <ul class={styles.connectedList}>
                    <For each={connectedLandmarks()}>{(landmark) => <li>{landmark.name}</li>}</For>
                  </ul>
                </div>
              </Show>

              <div class={styles.landmarkActions}>
                <button
                  class={styles.landmarkButton}
                  onClick={() => {
                    const path = mapEditorStore.selectedPath
                    if (path) {
                      mapEditorStore.initEditFromPath(path)
                      mapEditorStore.startEditing()
                    }
                  }}
                >
                  <PhPencilSimpleIcon /> Edit
                </button>
                <button
                  class={`${styles.landmarkButton} ${styles.landmarkButtonDelete}`}
                  onClick={() => mapEditorStore.deletePath()}
                  disabled={mapEditorStore.isDeleting}
                >
                  <Show
                    when={!mapEditorStore.isDeleting}
                    fallback={
                      <>
                        <PhCircleNotchIcon class="animate-spin" /> Deleting...
                      </>
                    }
                  >
                    <PhTrashIcon /> Delete
                  </Show>
                </button>
              </div>
            </Show>
          }
        >
          {/* Edit mode */}
          <div class={styles.landmarkEditForm}>
            <div class={styles.landmarkFormGroup}>
              <label>Speed Multiplier (1.0 - 20.0)</label>
              <input
                type="number"
                class={`${styles.landmarkInput} ${mapEditorStore.speedMultiplierError ? styles.inputError : ''}`}
                value={mapEditorStore.editSpeedMultiplier}
                onInput={(e) => mapEditorStore.setEditSpeedMultiplier(e.currentTarget.value)}
                placeholder="10.0"
                step="0.1"
                min="1.0"
                max="20.0"
              />
              <Show when={mapEditorStore.speedMultiplierError}>
                <span class={styles.errorMessage}>{mapEditorStore.speedMultiplierError}</span>
              </Show>
              <span class={styles.landmarkFormHint}>How much faster than normal space (1x - 20x)</span>
            </div>

            <div class={styles.landmarkFormActions}>
              <button
                class={styles.landmarkSaveButton}
                onClick={() => mapEditorStore.savePath()}
                disabled={mapEditorStore.isSaving || !!mapEditorStore.speedMultiplierError}
              >
                <Show
                  when={!mapEditorStore.isSaving}
                  fallback={
                    <>
                      <PhCircleNotchIcon class="animate-spin" /> Saving...
                    </>
                  }
                >
                  <PhCheckIcon /> Save
                </Show>
              </button>
              <button class={styles.landmarkCancelButton} onClick={() => mapEditorStore.cancelEditing()}>
                <PhXIcon /> Cancel
              </button>
            </div>
          </div>
        </Show>
      </div>
    </div>
  )
}
