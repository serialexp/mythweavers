import { AiOutlineLoading3Quarters } from 'solid-icons/ai'
import { BsArrowLeft, BsCheck, BsPencil, BsTrash, BsX } from 'solid-icons/bs'
import { Accessor, Component, For, Show, createMemo } from 'solid-js'
import { mapEditorStore } from '../../stores/mapEditorStore'
import { mapsStore } from '../../stores/mapsStore'
import { Fleet } from '../../types/core'
import { getActiveMovement } from '../../utils/fleetUtils'
import * as styles from '../Maps.css'

interface PawnDetailProps {
  // Data that comes from parent context
  selectedPawn: Accessor<Fleet | null>
  quickColors: Array<{ name: string; hex: string }>

  // Callback for navigation (clearing selection is handled by store)
  onBack: () => void
}

/**
 * Inline panel showing pawn details with view and edit modes.
 * Reads editing state directly from mapEditorStore.
 */
export const PawnDetail: Component<PawnDetailProps> = (props) => {
  // Compute current story time from stores (pending takes priority)
  const currentStoryTime = (): number => {
    const pending = mapEditorStore.pendingStoryTime
    if (pending !== null) return pending
    return mapsStore.currentStoryTime ?? 0
  }

  // Check if there's an active movement at the current story time
  const activeMovement = createMemo(() => {
    const pawn = props.selectedPawn()
    if (!pawn) return null
    return getActiveMovement(pawn, currentStoryTime())
  })

  return (
    <div class={styles.landmarkDetail}>
      {/* Header with back button */}
      <div class={styles.landmarkDetailHeader}>
        <button class={styles.backButton} onClick={props.onBack} title="Back to list">
          <BsArrowLeft />
        </button>
        <span class={styles.landmarkDetailTitle}>
          {mapEditorStore.isAddingPawn ? 'New Pawn' : 'Pawn Details'}
        </span>
      </div>

      <div class={styles.landmarkDetailContent}>
        <Show
          when={mapEditorStore.isEditing}
          fallback={
            <Show when={props.selectedPawn()}>
              <div class={styles.landmarkName}>{props.selectedPawn()!.name}</div>
              <div class={styles.landmarkDescription}>
                {props.selectedPawn()!.description || 'No description'}
              </div>
              <Show when={props.selectedPawn()!.designation}>
                <div class={styles.landmarkDetailRow}>
                  <span class={styles.landmarkDetailLabel}>Designation:</span>
                  <span class={styles.landmarkDetailValue}>{props.selectedPawn()!.designation}</span>
                </div>
              </Show>

              <div class={styles.landmarkDetails}>
                <div class={styles.landmarkDetailRow}>
                  <span class={styles.landmarkDetailLabel}>Hyperdrive Rating:</span>
                  <span class={styles.landmarkDetailValue}>{props.selectedPawn()!.hyperdriveRating}</span>
                </div>
                <div class={styles.landmarkDetailRow}>
                  <span class={styles.landmarkDetailLabel}>Movements:</span>
                  <span class={styles.landmarkDetailValue}>{props.selectedPawn()!.movements.length}</span>
                </div>
                <Show when={activeMovement()}>
                  <div class={styles.landmarkDetailRow}>
                    <span class={styles.landmarkDetailLabel}>Status:</span>
                    <span class={styles.landmarkDetailValue}>In Transit</span>
                  </div>
                </Show>
              </div>

              <div class={styles.landmarkActions}>
                <button
                  class={styles.landmarkButton}
                  onClick={() => {
                    const pawn = props.selectedPawn()
                    if (pawn) {
                      mapEditorStore.initEditFromPawn(pawn)
                      mapEditorStore.startEditing()
                    }
                  }}
                >
                  <BsPencil /> Edit
                </button>
                <Show when={activeMovement()}>
                  <button
                    class={`${styles.landmarkButton} ${styles.landmarkButtonDelete}`}
                    onClick={() => mapEditorStore.deleteActiveMovement(currentStoryTime())}
                    disabled={mapEditorStore.isDeletingMovement}
                  >
                    <Show
                      when={!mapEditorStore.isDeletingMovement}
                      fallback={
                        <>
                          <AiOutlineLoading3Quarters class="animate-spin" /> Canceling...
                        </>
                      }
                    >
                      <BsX /> Cancel Movement
                    </Show>
                  </button>
                </Show>
                <button
                  class={`${styles.landmarkButton} ${styles.landmarkButtonDelete}`}
                  onClick={() => mapEditorStore.deletePawn()}
                  disabled={mapEditorStore.isDeleting}
                >
                  <Show
                    when={!mapEditorStore.isDeleting}
                    fallback={
                      <>
                        <AiOutlineLoading3Quarters class="animate-spin" /> Deleting...
                      </>
                    }
                  >
                    <BsTrash /> Delete Pawn
                  </Show>
                </button>
              </div>
            </Show>
          }
        >
          {/* Edit mode */}
          <div class={styles.landmarkEditForm}>
            <input
              type="text"
              class={styles.landmarkInput}
              value={mapEditorStore.editName}
              onInput={(e) => mapEditorStore.setEditName(e.target.value)}
              placeholder="Pawn name"
            />

            <textarea
              class={styles.landmarkTextarea}
              value={mapEditorStore.editDescription}
              onInput={(e) => mapEditorStore.setEditDescription(e.target.value)}
              placeholder="Pawn description"
              rows={3}
            />

            <input
              type="text"
              class={styles.landmarkInput}
              value={mapEditorStore.editDesignation}
              onInput={(e) => mapEditorStore.setEditDesignation(e.target.value)}
              placeholder="Designation (e.g., 1st, A, Alpha)"
              maxlength={10}
            />

            <div class={styles.landmarkFormGroup}>
              <label>Hyperdrive Rating (0.5 - 2.0)</label>
              <input
                type="number"
                class={`${styles.landmarkInput} ${mapEditorStore.speedError ? styles.inputError : ''}`}
                value={mapEditorStore.editSpeed}
                onInput={(e) => mapEditorStore.setEditSpeed(e.currentTarget.value)}
                placeholder="1.0"
                step="0.1"
                min="0.5"
                max="2.0"
              />
              <Show when={mapEditorStore.speedError}>
                <span class={styles.errorMessage}>{mapEditorStore.speedError}</span>
              </Show>
              <span class={styles.landmarkFormHint}>
                Lower = faster (0.5 = twice as fast), Higher = slower (2.0 = twice as slow)
              </span>
            </div>

            <div class={styles.colorPicker}>
              <div class={styles.colorPickerRow}>
                <span class={styles.colorPickerLabel}>Pawn color:</span>
                <input
                  type="color"
                  class={styles.colorInput}
                  value={mapEditorStore.editColor}
                  onInput={(e) => mapEditorStore.setEditColor(e.target.value)}
                />
              </div>
              <div class={styles.colorQuickPicks}>
                <For each={props.quickColors}>
                  {(color) => (
                    <button
                      type="button"
                      class={`${styles.colorQuickPick} ${mapEditorStore.editColor === color.hex ? styles.selected : ''} ${color.name === 'White' ? styles.white : ''}`}
                      style={{ background: color.hex }}
                      onClick={() => mapEditorStore.setEditColor(color.hex)}
                      title={color.name}
                    />
                  )}
                </For>
              </div>
            </div>

            <div class={styles.sizePicker}>
              <span class={styles.sizePickerLabel}>Pawn variant:</span>
              <div class={styles.sizeButtons}>
                <button
                  type="button"
                  class={`${styles.sizeButton} ${mapEditorStore.editVariant === 'military' ? styles.selected : ''}`}
                  onClick={() => mapEditorStore.setEditVariant('military')}
                  title="Military/Capital (Triangle with star)"
                >
                  Military
                </button>
                <button
                  type="button"
                  class={`${styles.sizeButton} ${mapEditorStore.editVariant === 'transport' ? styles.selected : ''}`}
                  onClick={() => mapEditorStore.setEditVariant('transport')}
                  title="Transport/Logistics (Rectangle)"
                >
                  Transport
                </button>
                <button
                  type="button"
                  class={`${styles.sizeButton} ${mapEditorStore.editVariant === 'scout' ? styles.selected : ''}`}
                  onClick={() => mapEditorStore.setEditVariant('scout')}
                  title="Scout/Reconnaissance (Diamond)"
                >
                  Scout
                </button>
              </div>
            </div>

            <div class={styles.sizePicker}>
              <span class={styles.sizePickerLabel}>Pawn size:</span>
              <div class={styles.sizeButtons}>
                <button
                  type="button"
                  class={`${styles.sizeButton} ${mapEditorStore.editSize === 'small' ? styles.selected : ''}`}
                  onClick={() => mapEditorStore.setEditSize('small')}
                >
                  Small
                </button>
                <button
                  type="button"
                  class={`${styles.sizeButton} ${mapEditorStore.editSize === 'medium' ? styles.selected : ''}`}
                  onClick={() => mapEditorStore.setEditSize('medium')}
                >
                  Medium
                </button>
                <button
                  type="button"
                  class={`${styles.sizeButton} ${mapEditorStore.editSize === 'large' ? styles.selected : ''}`}
                  onClick={() => mapEditorStore.setEditSize('large')}
                >
                  Large
                </button>
              </div>
            </div>

            <div class={styles.landmarkFormActions}>
              <button
                class={styles.landmarkSaveButton}
                onClick={() => mapEditorStore.savePawn()}
                disabled={!mapEditorStore.editName.trim() || mapEditorStore.isSaving || !!mapEditorStore.speedError}
              >
                <Show
                  when={!mapEditorStore.isSaving}
                  fallback={
                    <>
                      <AiOutlineLoading3Quarters class="animate-spin" /> Saving...
                    </>
                  }
                >
                  <BsCheck /> Save
                </Show>
              </button>
              <button class={styles.landmarkCancelButton} onClick={() => mapEditorStore.cancelEditing()}>
                <BsX /> Cancel
              </button>
            </div>
          </div>
        </Show>
      </div>
    </div>
  )
}
