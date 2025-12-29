import { AiOutlineLoading3Quarters } from 'solid-icons/ai'
import { BsArrowLeft, BsArrowReturnLeft, BsCheck, BsPencil, BsSearch, BsTrash, BsX } from 'solid-icons/bs'
import { Accessor, Component, For, Show, createMemo } from 'solid-js'
import { landmarkStatesStore } from '../../stores/landmarkStatesStore'
import { mapEditorStore } from '../../stores/mapEditorStore'
import { mapsStore } from '../../stores/mapsStore'
import { settingsStore } from '../../stores/settingsStore'
import { DEFAULT_PROPERTY_SCHEMA, Landmark } from '../../types/core'
import { EJSCodeEditor } from '../EJSCodeEditor'
import { EJSRenderer } from '../EJSRenderer'
import * as styles from '../Maps.css'
import { PropertyField } from './PropertyField'

interface LandmarkDetailProps {
  // Data that comes from parent context
  selectedLandmark: Accessor<Landmark | null>
  quickColors: Array<{ name: string; hex: string }>

  // Callbacks that involve parent logic (complex operations not in store)
  onBack: () => void
  onFetchLandmarkInfo: () => void
}

// Format number with thousand separators (for display)
const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-US').format(num)
}

// Parse number string (removes commas, spaces, etc.)
const parseNumber = (value: string): number | null => {
  if (!value.trim()) return null
  const cleaned = value.replace(/[^\d.-]/g, '')
  const num = Number.parseFloat(cleaned)
  return Number.isNaN(num) ? null : num
}

/**
 * Inline panel showing landmark details with view and edit modes.
 * Reads editing state directly from mapEditorStore.
 */
export const LandmarkDetail: Component<LandmarkDetailProps> = (props) => {
  const schema = () => mapsStore.selectedMap?.propertySchema || DEFAULT_PROPERTY_SCHEMA

  // Compute current story time from stores (pending takes priority)
  const currentStoryTime = (): number | null => {
    const pending = mapEditorStore.pendingStoryTime
    if (pending !== null) return pending
    return mapsStore.currentStoryTime
  }

  // Derive allegiance state from landmarkStatesStore
  const selectedAllegiance = createMemo(() => {
    const landmark = props.selectedLandmark()
    const map = mapsStore.selectedMap
    if (!landmark || !map) return null
    const key = `${map.id}:${landmark.id}:allegiance`
    return landmarkStatesStore.accumulatedStates[key]?.value || null
  })

  const allegianceAtThisStoryTime = createMemo(() => {
    const landmark = props.selectedLandmark()
    const map = mapsStore.selectedMap
    const storyTime = currentStoryTime()
    if (!landmark || !map || storyTime === null) return null
    const stateAtThisTime = landmarkStatesStore.states.find(
      (s) => s.mapId === map.id && s.landmarkId === landmark.id && s.storyTime === storyTime && s.field === 'allegiance',
    )
    return stateAtThisTime?.value || null
  })

  const allegianceSourceStoryTime = createMemo(() => {
    const landmark = props.selectedLandmark()
    const map = mapsStore.selectedMap
    if (!landmark || !map) return null
    const key = `${map.id}:${landmark.id}:allegiance`
    return landmarkStatesStore.accumulatedStates[key]?.storyTime || null
  })

  // Jump to a specific story time
  const handleJumpToStoryTime = (storyTime: number) => {
    mapEditorStore.setPendingStoryTime(null)
    mapsStore.setCurrentStoryTime(storyTime)
  }

  return (
    <div class={styles.landmarkDetail}>
      {/* Header with back button */}
      <div class={styles.landmarkDetailHeader}>
        <button class={styles.backButton} onClick={props.onBack} title="Back to list">
          <BsArrowLeft />
        </button>
        <span class={styles.landmarkDetailTitle}>
          {mapEditorStore.isAddingLandmark ? 'New Landmark' : 'Landmark Details'}
        </span>
      </div>

      <div class={styles.landmarkDetailContent}>
        <Show
          when={mapEditorStore.isEditing}
          fallback={
            <Show when={props.selectedLandmark()}>
              <div class={styles.landmarkName}>
                <EJSRenderer template={props.selectedLandmark()!.name} mode="inline" />
              </div>
              <div class={styles.landmarkDescription}>
                <EJSRenderer template={props.selectedLandmark()!.description} mode="inline" />
              </div>

              {/* Dynamic properties display */}
              {(() => {
                const landmark = props.selectedLandmark()!
                const properties = landmark.properties || {}
                const hasAnyProperty = schema().properties.some((p) => properties[p.key])

                return (
                  <Show when={hasAnyProperty}>
                    <div class={styles.landmarkDetails}>
                      <For each={schema().properties}>
                        {(propDef) => {
                          const value = () => properties[propDef.key]
                          return (
                            <Show when={value()}>
                              <div class={styles.landmarkDetailRow}>
                                <span class={styles.landmarkDetailLabel}>{propDef.label}:</span>
                                <span class={styles.landmarkDetailValue}>
                                  {(() => {
                                    const v = value()
                                    if (propDef.type === 'number' && typeof v === 'string') {
                                      const parsed = parseNumber(v)
                                      return parsed !== null ? formatNumber(parsed) : v
                                    }
                                    if (propDef.type === 'enum' && propDef.options) {
                                      const opt = propDef.options.find((o) => o.value === v)
                                      return opt?.label || String(v)
                                    }
                                    if (propDef.type === 'boolean') {
                                      return v ? 'Yes' : 'No'
                                    }
                                    return String(v)
                                  })()}
                                </span>
                              </div>
                            </Show>
                          )
                        }}
                      </For>
                    </div>
                  </Show>
                )
              })()}

              {/* State fields selector (e.g., allegiance) */}
              <Show when={currentStoryTime() !== null}>
                <For each={schema().stateFields}>
                  {(stateField) => (
                    <div class={styles.allegianceSection}>
                      <div class={styles.allegianceHeader}>
                        <div class={styles.allegianceLabel}>{stateField.label} at this point:</div>
                        <Show
                          when={
                            allegianceSourceStoryTime() !== null &&
                            allegianceSourceStoryTime() !== currentStoryTime()
                          }
                        >
                          <button
                            class={styles.jumpButton}
                            onClick={() => handleJumpToStoryTime(allegianceSourceStoryTime()!)}
                            title={`Jump to where this ${stateField.label.toLowerCase()} was set`}
                          >
                            <BsArrowReturnLeft /> Jump to source
                          </button>
                        </Show>
                      </div>
                      <div class={styles.allegianceButtons}>
                        <For each={stateField.options}>
                          {(option) => {
                            const isSelected = () => selectedAllegiance() === option.value
                            const isSetHere = () => allegianceAtThisStoryTime() === option.value
                            const isInherited = () => isSelected() && !isSetHere()

                            return (
                              <button
                                class={`${styles.allegianceButton} ${isSelected() ? styles.selected : ''} ${isInherited() ? styles.inherited : ''}`}
                                style={{
                                  'background-color': isSelected() ? option.color : 'transparent',
                                  'border-color': option.color,
                                  color: isSelected() ? '#fff' : option.color,
                                  opacity: isInherited() ? 0.7 : 1,
                                }}
                                title={isInherited() ? `Inherited from earlier in the timeline` : ''}
                                onClick={() => {
                                  if (
                                    selectedAllegiance() === option.value &&
                                    allegianceAtThisStoryTime() === option.value
                                  ) {
                                    mapEditorStore.saveAllegiance(null)
                                  } else if (selectedAllegiance() !== option.value) {
                                    mapEditorStore.saveAllegiance(option.value)
                                  }
                                }}
                                disabled={mapEditorStore.isSavingAllegiance}
                              >
                                {option.label}
                              </button>
                            )
                          }}
                        </For>
                      </div>
                      <Show when={mapEditorStore.isSavingAllegiance}>
                        <div class={styles.savingIndicator}>
                          <AiOutlineLoading3Quarters class="animate-spin" /> Saving...
                        </div>
                      </Show>
                    </div>
                  )}
                </For>
              </Show>

              <div class={styles.landmarkActions}>
                <button
                  class={styles.landmarkButton}
                  onClick={() => {
                    const lm = props.selectedLandmark()
                    if (lm) {
                      mapEditorStore.initEditFromLandmark(lm)
                      mapEditorStore.startEditing()
                    }
                  }}
                >
                  <BsPencil /> Edit
                </button>
                <button
                  class={`${styles.landmarkButton} ${styles.landmarkButtonDelete}`}
                  onClick={() => mapEditorStore.deleteLandmark()}
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
                    <BsTrash /> Delete
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
              placeholder="Landmark name"
            />

            <Show when={settingsStore.provider === 'anthropic' && mapEditorStore.editName.trim()}>
              <button
                type="button"
                class={styles.fetchInfoButton}
                onClick={props.onFetchLandmarkInfo}
                disabled={mapEditorStore.isFetchingLandmarkInfo}
                title="Search the web for information about this landmark"
              >
                <Show
                  when={!mapEditorStore.isFetchingLandmarkInfo}
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
              value={mapEditorStore.editDescription}
              onChange={(v) => mapEditorStore.setEditDescription(v)}
              placeholder="Landmark description (supports EJS templates)"
              minHeight="80px"
            />

            <div class={styles.colorPicker}>
              <div class={styles.colorPickerRow}>
                <span class={styles.colorPickerLabel}>Pin color:</span>
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
              <span class={styles.sizePickerLabel}>Pin size:</span>
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

            <div class={styles.sizePicker}>
              <span class={styles.sizePickerLabel}>Type:</span>
              <div class={styles.sizeButtons}>
                <button
                  type="button"
                  class={`${styles.sizeButton} ${mapEditorStore.editType === 'system' ? styles.selected : ''}`}
                  onClick={() => mapEditorStore.setEditType('system')}
                >
                  System
                </button>
                <button
                  type="button"
                  class={`${styles.sizeButton} ${mapEditorStore.editType === 'station' ? styles.selected : ''}`}
                  onClick={() => mapEditorStore.setEditType('station')}
                >
                  Station
                </button>
                <button
                  type="button"
                  class={`${styles.sizeButton} ${mapEditorStore.editType === 'nebula' ? styles.selected : ''}`}
                  onClick={() => mapEditorStore.setEditType('nebula')}
                >
                  Nebula
                </button>
              </div>
            </div>

            {/* Dynamic property fields from schema */}
            <For each={schema().properties}>
              {(propDef) => (
                <PropertyField
                  definition={propDef}
                  value={mapEditorStore.editProperties[propDef.key] ?? ''}
                  error={mapEditorStore.propertyErrors[propDef.key] || ''}
                  onChange={(value) => mapEditorStore.setEditProperty(propDef.key, value)}
                />
              )}
            </For>

            <div class={styles.landmarkFormActions}>
              <button
                class={styles.landmarkSaveButton}
                onClick={() => mapEditorStore.saveLandmark()}
                disabled={!mapEditorStore.editName.trim() || mapEditorStore.isSaving}
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
