import { AiOutlineLoading3Quarters } from 'solid-icons/ai'
import { BsArrowReturnLeft, BsCheck, BsPencil, BsSearch, BsTrash, BsX } from 'solid-icons/bs'
import { Accessor, Component, For, Setter, Show } from 'solid-js'
import { settingsStore } from '../../stores/settingsStore'
import { Landmark, LandmarkIndustry } from '../../types/core'
import { LANDMARK_STATE_FIELDS } from '../../types/core'
import { EJSCodeEditor } from '../EJSCodeEditor'
import { EJSRenderer } from '../EJSRenderer'
import * as styles from '../Maps.css'

interface LandmarkPopupProps {
  popupRef?: HTMLDivElement | ((el: HTMLDivElement) => void)
  selectedLandmark: Accessor<Landmark | null>
  isAddingNew: Accessor<boolean>
  popupPosition: Accessor<{ x: number; y: number }>
  isEditing: Accessor<boolean>
  isDeleting: Accessor<boolean>
  isSaving: Accessor<boolean>
  isFetchingLandmarkInfo: Accessor<boolean>
  isSavingAllegiance: Accessor<boolean>
  editName: Accessor<string>
  setEditName: Setter<string>
  editDescription: Accessor<string>
  setEditDescription: Setter<string>
  editColor: Accessor<string>
  setEditColor: Setter<string>
  editSize: Accessor<'small' | 'medium' | 'large'>
  setEditSize: Setter<'small' | 'medium' | 'large'>
  editType: Accessor<'system' | 'station' | 'nebula' | 'junction'>
  setEditType: Setter<'system' | 'station' | 'nebula' | 'junction'>
  editPopulation: Accessor<string>
  handlePopulationInput: (value: string) => void
  populationError: Accessor<string>
  editIndustry: Accessor<LandmarkIndustry | ''>
  setEditIndustry: Setter<LandmarkIndustry | ''>
  editPlanetaryBodies: Accessor<string>
  setEditPlanetaryBodies: Setter<string>
  editRegion: Accessor<string>
  setEditRegion: Setter<string>
  editSector: Accessor<string>
  setEditSector: Setter<string>
  quickColors: Array<{ name: string; hex: string }>
  parsePopulation: (value: string) => number | null
  formatPopulation: (num: number) => string
  validatePopulation: (value: string) => boolean
  currentMessageId: Accessor<string | null>
  selectedAllegiance: Accessor<string | null>
  allegianceAtThisMessage: Accessor<string | null>
  allegianceSourceMessageId: Accessor<string | null>
  onStartEditing: () => void
  onSaveLandmark: () => void
  onCancelEditing: () => void
  onDeleteLandmark: () => void
  onFetchLandmarkInfo: () => void
  onJumpToMessage: (messageId: string) => void
  onSaveAllegiance: (value: string | null) => void
}

/**
 * Popup showing landmark details with view and edit modes
 */
export const LandmarkPopup: Component<LandmarkPopupProps> = (props) => {
  return (
    <Show when={props.selectedLandmark() || props.isAddingNew()}>
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
            fallback=<Show when={props.selectedLandmark()}>
              <div class={styles.landmarkName}>
                <EJSRenderer template={props.selectedLandmark()!.name} mode="inline" />
              </div>
              <div class={styles.landmarkDescription}>
                <EJSRenderer template={props.selectedLandmark()!.description} mode="inline" />
              </div>

              {/* Population and Industry info */}
              <Show
                when={
                  props.selectedLandmark()!.population ||
                  props.selectedLandmark()!.industry ||
                  props.selectedLandmark()!.region ||
                  props.selectedLandmark()!.sector ||
                  props.selectedLandmark()!.planetaryBodies
                }
              >
                <div class={styles.landmarkDetails}>
                  <Show when={props.selectedLandmark()!.region}>
                    <div class={styles.landmarkDetailRow}>
                      <span class={styles.landmarkDetailLabel}>Region:</span>
                      <span class={styles.landmarkDetailValue}>{props.selectedLandmark()!.region}</span>
                    </div>
                  </Show>
                  <Show when={props.selectedLandmark()!.sector}>
                    <div class={styles.landmarkDetailRow}>
                      <span class={styles.landmarkDetailLabel}>Sector:</span>
                      <span class={styles.landmarkDetailValue}>{props.selectedLandmark()!.sector}</span>
                    </div>
                  </Show>
                  <Show when={props.selectedLandmark()!.population}>
                    <div class={styles.landmarkDetailRow}>
                      <span class={styles.landmarkDetailLabel}>Population:</span>
                      <span class={styles.landmarkDetailValue}>
                        {(() => {
                          const pop = props.selectedLandmark()!.population
                          // Try to format if it's a valid number
                          const parsed = props.parsePopulation(pop || '')
                          return parsed !== null ? props.formatPopulation(parsed) : pop
                        })()}
                      </span>
                    </div>
                  </Show>
                  <Show when={props.selectedLandmark()!.industry}>
                    <div class={styles.landmarkDetailRow}>
                      <span class={styles.landmarkDetailLabel}>Industry:</span>
                      <span class={styles.landmarkDetailValue}>
                        {props.selectedLandmark()!.industry!.charAt(0).toUpperCase() +
                          props.selectedLandmark()!.industry!.slice(1)}
                      </span>
                    </div>
                  </Show>
                  <Show when={props.selectedLandmark()!.planetaryBodies}>
                    <div class={styles.landmarkDetailRow}>
                      <span class={styles.landmarkDetailLabel}>Planetary Bodies:</span>
                      <span class={styles.landmarkDetailValue}>{props.selectedLandmark()!.planetaryBodies}</span>
                    </div>
                  </Show>
                </div>
              </Show>

              {/* Allegiance selector */}
              <Show when={props.currentMessageId()}>
                <div class={styles.allegianceSection}>
                  <div class={styles.allegianceHeader}>
                    <div class={styles.allegianceLabel}>Allegiance at this point:</div>
                    <Show
                      when={
                        props.allegianceSourceMessageId() &&
                        props.allegianceSourceMessageId() !== props.currentMessageId()
                      }
                    >
                      <button
                        class={styles.jumpButton}
                        onClick={() => props.onJumpToMessage(props.allegianceSourceMessageId()!)}
                        title="Jump to where this allegiance was set"
                      >
                        <BsArrowReturnLeft /> Jump to source
                      </button>
                    </Show>
                  </div>
                  <div class={styles.allegianceButtons}>
                    <For each={LANDMARK_STATE_FIELDS.allegiance.values}>
                      {(option) => {
                        // Use functions to ensure reactivity
                        const isSelected = () => props.selectedAllegiance() === option.value
                        const isSetHere = () => props.allegianceAtThisMessage() === option.value
                        const isInherited = () => isSelected() && !isSetHere()

                        return (
                          <button
                            class={`${styles.allegianceButton} ${
                              isSelected() ? styles.selected : ''
                            } ${isInherited() ? styles.inherited : ''}`}
                            style={{
                              'background-color': isSelected() ? option.color : 'transparent',
                              'border-color': option.color,
                              color: isSelected() ? '#fff' : option.color,
                              opacity: isInherited() ? 0.7 : 1,
                            }}
                            title={isInherited() ? 'Inherited from earlier message' : ''}
                            onClick={() => {
                              // Only allow unselecting if there's a state at this specific message
                              if (
                                props.selectedAllegiance() === option.value &&
                                props.allegianceAtThisMessage() === option.value
                              ) {
                                // Unselect - remove the state at this message
                                props.onSaveAllegiance(null)
                              } else if (props.selectedAllegiance() !== option.value) {
                                // Select/change - set the state at this message
                                props.onSaveAllegiance(option.value)
                              }
                              // If it's selected but not at this message, do nothing (can't unselect inherited state)
                            }}
                            disabled={props.isSavingAllegiance()}
                          >
                            {option.label}
                          </button>
                        )
                      }}
                    </For>
                  </div>
                  <Show when={props.isSavingAllegiance()}>
                    <div class={styles.savingIndicator}>
                      <AiOutlineLoading3Quarters class="animate-spin" /> Saving...
                    </div>
                  </Show>
                </div>
              </Show>

              <div class={styles.landmarkActions}>
                <button class={styles.landmarkButton} onClick={props.onStartEditing}>
                  <BsPencil /> Edit
                </button>
                <button
                  class={`${styles.landmarkButton} ${styles.landmarkButtonDelete}`}
                  onClick={props.onDeleteLandmark}
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
                    <BsTrash /> Delete
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
                placeholder="Landmark name"
              />

              <Show when={settingsStore.provider === 'anthropic' && props.editName().trim()}>
                <button
                  type="button"
                  class={styles.fetchInfoButton}
                  onClick={props.onFetchLandmarkInfo}
                  disabled={props.isFetchingLandmarkInfo()}
                  title="Search the web for information about this landmark"
                >
                  <Show
                    when={!props.isFetchingLandmarkInfo()}
                    fallback={
                      <>
                        <AiOutlineLoading3Quarters class="animate-spin" /> Searching...
                      </>
                    }
                  >
                    <BsSearch /> Search for Info
                  </Show>
                </button>
              </Show>

              <EJSCodeEditor
                value={props.editDescription()}
                onChange={props.setEditDescription}
                placeholder="Landmark description (supports EJS templates)"
                minHeight="80px"
              />

              <div class={styles.colorPicker}>
                <div class={styles.colorPickerRow}>
                  <span class={styles.colorPickerLabel}>Pin color:</span>
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
                <span class={styles.sizePickerLabel}>Pin size:</span>
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

              <div class={styles.sizePicker}>
                <span class={styles.sizePickerLabel}>Type:</span>
                <div class={styles.sizeButtons}>
                  <button
                    type="button"
                    class={`${styles.sizeButton} ${props.editType() === 'system' ? styles.selected : ''}`}
                    onClick={() => props.setEditType('system')}
                  >
                    System
                  </button>
                  <button
                    type="button"
                    class={`${styles.sizeButton} ${props.editType() === 'station' ? styles.selected : ''}`}
                    onClick={() => props.setEditType('station')}
                  >
                    Station
                  </button>
                  <button
                    type="button"
                    class={`${styles.sizeButton} ${props.editType() === 'nebula' ? styles.selected : ''}`}
                    onClick={() => props.setEditType('nebula')}
                  >
                    Nebula
                  </button>
                </div>
              </div>

              <div class={styles.landmarkFormGroup}>
                <label>Population</label>
                <input
                  type="text"
                  class={`${styles.landmarkInput} ${props.populationError() ? styles.inputError : ''}`}
                  value={props.editPopulation()}
                  onInput={(e) => props.handlePopulationInput(e.currentTarget.value)}
                  onBlur={(e) => {
                    // Format on blur if valid
                    const value = e.currentTarget.value
                    if (props.validatePopulation(value)) {
                      const parsed = props.parsePopulation(value)
                      if (parsed !== null) {
                        props.handlePopulationInput(props.formatPopulation(parsed))
                      }
                    }
                  }}
                  placeholder="e.g., 1,500,000"
                />
                <Show when={props.populationError()}>
                  <span class={styles.errorMessage}>{props.populationError()}</span>
                </Show>
              </div>

              <div class={styles.landmarkFormGroup}>
                <label>Primary Industry</label>
                <select
                  class={styles.landmarkSelect}
                  value={props.editIndustry()}
                  onChange={(e) => props.setEditIndustry(e.currentTarget.value as LandmarkIndustry | '')}
                >
                  <option value="">None</option>
                  <option value="farming">Farming</option>
                  <option value="political">Political</option>
                  <option value="industry">Industry</option>
                  <option value="trade">Trade</option>
                  <option value="mining">Mining</option>
                </select>
              </div>

              <div class={styles.landmarkFormGroup}>
                <label>Region</label>
                <input
                  type="text"
                  class={styles.landmarkInput}
                  value={props.editRegion()}
                  onInput={(e) => props.setEditRegion(e.target.value)}
                  placeholder="e.g., Core Worlds, Outer Rim"
                />
              </div>

              <div class={styles.landmarkFormGroup}>
                <label>Sector</label>
                <input
                  type="text"
                  class={styles.landmarkInput}
                  value={props.editSector()}
                  onInput={(e) => props.setEditSector(e.target.value)}
                  placeholder="e.g., Arkanis Sector"
                />
              </div>

              <Show when={props.editType() === 'system'}>
                <div class={styles.landmarkFormRow}>
                  <label class={styles.landmarkFormLabel}>Planetary Bodies:</label>
                  <input
                    type="text"
                    class={styles.landmarkInput}
                    value={props.editPlanetaryBodies()}
                    onInput={(e) => props.setEditPlanetaryBodies(e.target.value)}
                    placeholder="e.g., Planet Name I, Planet Name II, Moon Name"
                  />
                  <span class={styles.landmarkFormHint}>Comma-separated list of planets and moons in the system</span>
                </div>
              </Show>

              <div class={styles.landmarkFormActions}>
                <button
                  class={styles.landmarkSaveButton}
                  onClick={props.onSaveLandmark}
                  disabled={!props.editName().trim() || props.isSaving()}
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
