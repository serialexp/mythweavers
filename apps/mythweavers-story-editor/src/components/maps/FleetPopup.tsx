import { AiOutlineLoading3Quarters } from 'solid-icons/ai'
import { BsCheck, BsPencil, BsTrash, BsX } from 'solid-icons/bs'
import { Accessor, Component, For, Setter, Show, createMemo } from 'solid-js'
import { Fleet } from '../../types/core'
import { getActiveMovement } from '../../utils/fleetUtils'
import * as styles from '../Maps.css'

interface FleetPopupProps {
  popupRef?: HTMLDivElement | ((el: HTMLDivElement) => void)
  selectedFleet: Accessor<Fleet | null>
  isAddingFleet: Accessor<boolean>
  popupPosition: Accessor<{ x: number; y: number }>
  isEditing: Accessor<boolean>
  isDeleting: Accessor<boolean>
  isSaving: Accessor<boolean>
  editName: Accessor<string>
  setEditName: Setter<string>
  editDescription: Accessor<string>
  setEditDescription: Setter<string>
  editDesignation: Accessor<string>
  setEditDesignation: Setter<string>
  editHyperdriveRating: Accessor<string>
  setEditHyperdriveRating: Setter<string>
  hyperdriveError: Accessor<string>
  editColor: Accessor<string>
  setEditColor: Setter<string>
  editSize: Accessor<'small' | 'medium' | 'large'>
  setEditSize: Setter<'small' | 'medium' | 'large'>
  editVariant: Accessor<'military' | 'transport' | 'scout'>
  setEditVariant: Setter<'military' | 'transport' | 'scout'>
  quickColors: Array<{ name: string; hex: string }>
  currentStoryTime: Accessor<number>
  isDeletingMovement: Accessor<boolean>
  onStartEditing: () => void
  onSaveFleet: () => void
  onCancelEditing: () => void
  onDeleteFleet: () => void
  onDeleteActiveMovement: () => void
}

/**
 * Popup showing fleet details with view and edit modes
 */
export const FleetPopup: Component<FleetPopupProps> = (props) => {
  // Check if there's an active movement at the current story time
  const activeMovement = createMemo(() => {
    const fleet = props.selectedFleet()
    if (!fleet) return null
    return getActiveMovement(fleet, props.currentStoryTime())
  })

  return (
    <Show when={props.selectedFleet() || props.isAddingFleet()}>
      <div
        ref={props.popupRef}
        class={styles.landmarkPopup}
        style={{
          left: `${props.popupPosition().x}px`,
          top: `${props.popupPosition().y}px`,
        }}
      >
        <div class={styles.landmarkPopupContent}>
          <Show
            when={props.isEditing()}
            fallback=<Show when={props.selectedFleet()}>
              <div class={styles.landmarkName}>{props.selectedFleet()!.name}</div>
              <div class={styles.landmarkDescription}>{props.selectedFleet()!.description || 'No description'}</div>
              <Show when={props.selectedFleet()!.designation}>
                <div class={styles.landmarkDetailRow}>
                  <span class={styles.landmarkDetailLabel}>Designation:</span>
                  <span class={styles.landmarkDetailValue}>{props.selectedFleet()!.designation}</span>
                </div>
              </Show>

              <div class={styles.landmarkDetails}>
                <div class={styles.landmarkDetailRow}>
                  <span class={styles.landmarkDetailLabel}>Hyperdrive Rating:</span>
                  <span class={styles.landmarkDetailValue}>{props.selectedFleet()!.hyperdriveRating}</span>
                </div>
                <div class={styles.landmarkDetailRow}>
                  <span class={styles.landmarkDetailLabel}>Movements:</span>
                  <span class={styles.landmarkDetailValue}>{props.selectedFleet()!.movements.length}</span>
                </div>
                <Show when={activeMovement()}>
                  <div class={styles.landmarkDetailRow}>
                    <span class={styles.landmarkDetailLabel}>Status:</span>
                    <span class={styles.landmarkDetailValue}>In Transit</span>
                  </div>
                </Show>
              </div>

              <div class={styles.landmarkActions}>
                <button class={styles.landmarkButton} onClick={props.onStartEditing}>
                  <BsPencil /> Edit
                </button>
                <Show when={activeMovement()}>
                  <button
                    class={`${styles.landmarkButton} ${styles.landmarkButtonDelete}`}
                    onClick={props.onDeleteActiveMovement}
                    disabled={props.isDeletingMovement()}
                  >
                    <Show
                      when={!props.isDeletingMovement()}
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
                  onClick={props.onDeleteFleet}
                  disabled={props.isDeleting()}
                >
                  <Show
                    when={!props.isDeleting()}
                    fallback={
                      <>
                        <AiOutlineLoading3Quarters class="animate-spin" /> Deleting...
                      </>
                    }
                  >
                    <BsTrash /> Delete Fleet
                  </Show>
                </button>
              </div>
            </Show>
          >
            <div class={styles.landmarkEditForm}>
              <input
                type="text"
                class={styles.landmarkInput}
                value={props.editName()}
                onInput={(e) => props.setEditName(e.target.value)}
                placeholder="Fleet name"
              />

              <textarea
                class={styles.landmarkInput}
                value={props.editDescription()}
                onInput={(e) => props.setEditDescription(e.target.value)}
                placeholder="Fleet description"
                rows={3}
              />

              <input
                type="text"
                class={styles.landmarkInput}
                value={props.editDesignation()}
                onInput={(e) => props.setEditDesignation(e.target.value)}
                placeholder="Fleet designation (e.g., 1st, A, Alpha)"
                maxlength={10}
              />

              <div class={styles.landmarkFormGroup}>
                <label>Hyperdrive Rating (0.5 - 2.0)</label>
                <input
                  type="number"
                  class={`${styles.landmarkInput} ${props.hyperdriveError() ? styles.inputError : ''}`}
                  value={props.editHyperdriveRating()}
                  onInput={(e) => {
                    const value = e.currentTarget.value
                    props.setEditHyperdriveRating(value)
                  }}
                  placeholder="1.0"
                  step="0.1"
                  min="0.5"
                  max="2.0"
                />
                <Show when={props.hyperdriveError()}>
                  <span class={styles.errorMessage}>{props.hyperdriveError()}</span>
                </Show>
                <span class={styles.landmarkFormHint}>
                  Lower = faster (0.5 = twice as fast), Higher = slower (2.0 = twice as slow)
                </span>
              </div>

              <div class={styles.colorPicker}>
                <div class={styles.colorPickerRow}>
                  <span class={styles.colorPickerLabel}>Fleet color:</span>
                  <input
                    type="color"
                    class={styles.colorInput}
                    value={props.editColor()}
                    onInput={(e) => props.setEditColor(e.target.value)}
                  />
                </div>
                <div class={styles.colorQuickPicks}>
                  <For each={props.quickColors}>
                    {(color) => (
                      <button
                        type="button"
                        class={`${styles.colorQuickPick} ${props.editColor() === color.hex ? styles.selected : ''} ${color.name === 'White' ? styles.white : ''}`}
                        style={{ background: color.hex }}
                        onClick={() => props.setEditColor(color.hex)}
                        title={color.name}
                      />
                    )}
                  </For>
                </div>
              </div>

              <div class={styles.sizePicker}>
                <span class={styles.sizePickerLabel}>Fleet variant:</span>
                <div class={styles.sizeButtons}>
                  <button
                    type="button"
                    class={`${styles.sizeButton} ${props.editVariant() === 'military' ? styles.selected : ''}`}
                    onClick={() => props.setEditVariant('military')}
                    title="Military/Capital Fleet (Triangle with star)"
                  >
                    Military
                  </button>
                  <button
                    type="button"
                    class={`${styles.sizeButton} ${props.editVariant() === 'transport' ? styles.selected : ''}`}
                    onClick={() => props.setEditVariant('transport')}
                    title="Transport/Logistics Fleet (Rectangle)"
                  >
                    Transport
                  </button>
                  <button
                    type="button"
                    class={`${styles.sizeButton} ${props.editVariant() === 'scout' ? styles.selected : ''}`}
                    onClick={() => props.setEditVariant('scout')}
                    title="Scout/Reconnaissance Fleet (Diamond)"
                  >
                    Scout
                  </button>
                </div>
              </div>

              <div class={styles.sizePicker}>
                <span class={styles.sizePickerLabel}>Fleet size:</span>
                <div class={styles.sizeButtons}>
                  <button
                    type="button"
                    class={`${styles.sizeButton} ${props.editSize() === 'small' ? styles.selected : ''}`}
                    onClick={() => props.setEditSize('small')}
                  >
                    Small
                  </button>
                  <button
                    type="button"
                    class={`${styles.sizeButton} ${props.editSize() === 'medium' ? styles.selected : ''}`}
                    onClick={() => props.setEditSize('medium')}
                  >
                    Medium
                  </button>
                  <button
                    type="button"
                    class={`${styles.sizeButton} ${props.editSize() === 'large' ? styles.selected : ''}`}
                    onClick={() => props.setEditSize('large')}
                  >
                    Large
                  </button>
                </div>
              </div>

              <div class={styles.landmarkFormActions}>
                <button
                  class={styles.landmarkSaveButton}
                  onClick={props.onSaveFleet}
                  disabled={!props.editName().trim() || props.isSaving() || !!props.hyperdriveError()}
                >
                  <Show
                    when={!props.isSaving()}
                    fallback={
                      <>
                        <AiOutlineLoading3Quarters class="animate-spin" /> Saving...
                      </>
                    }
                  >
                    <BsCheck /> Save
                  </Show>
                </button>
                <button class={styles.landmarkCancelButton} onClick={props.onCancelEditing}>
                  <BsX /> Cancel
                </button>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  )
}
