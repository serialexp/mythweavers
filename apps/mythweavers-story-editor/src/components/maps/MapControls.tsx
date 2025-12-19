import { BsCheck, BsPencil, BsPlus, BsTrash, BsX } from 'solid-icons/bs'
import { Accessor, Component, For, Setter, Show } from 'solid-js'
import { mapsStore } from '../../stores/mapsStore'
import { EJSCodeEditor } from '../EJSCodeEditor'
import * as styles from '../Maps.css'

interface MapControlsProps {
  showAddMap: Accessor<boolean>
  setShowAddMap: Setter<boolean>
  newMapName: Accessor<string>
  setNewMapName: Setter<string>
  newMapBorderColor: Accessor<string>
  setNewMapBorderColor: Setter<string>
  selectedFileName: Accessor<string>
  editingBorderColor: Accessor<boolean>
  setEditingBorderColor: Setter<boolean>
  editBorderColorValue: Accessor<string>
  setEditBorderColorValue: Setter<string>
  onFileSelect: (e: Event) => void
  onAddMap: () => void
}

/**
 * Controls for managing maps: selector, add/delete, and border color editing
 */
export const MapControls: Component<MapControlsProps> = (props) => {
  const handleToggleAddMap = () => {
    if (props.showAddMap()) {
      // Reset form when hiding
      props.setNewMapName('')
      props.setNewMapBorderColor('')
    }
    props.setShowAddMap(!props.showAddMap())
  }

  const handleToggleBorderColorEdit = () => {
    if (mapsStore.selectedMap) {
      props.setEditBorderColorValue(mapsStore.selectedMap.borderColor || '')
      props.setEditingBorderColor(!props.editingBorderColor())
    }
  }

  const handleDeleteMap = async () => {
    if (mapsStore.selectedMapId) {
      if (confirm('Are you sure you want to delete this map?')) {
        await mapsStore.deleteMap(mapsStore.selectedMapId)
      }
    }
  }

  const handleSaveBorderColor = async () => {
    if (mapsStore.selectedMapId) {
      await mapsStore.updateMap(mapsStore.selectedMapId, {
        borderColor: props.editBorderColorValue() || undefined,
      })
      props.setEditingBorderColor(false)
    }
  }

  return (
    <>
      <div class={styles.mapSelector}>
        <div class={styles.mapSelectorHeader}>
          <h4>Maps</h4>
        </div>

        <div class={styles.mapDropdown}>
          <select
            class={styles.mapSelect}
            value={mapsStore.selectedMapId || ''}
            onChange={(e) => {
              if (e.target.value) {
                mapsStore.selectMap(e.target.value)
              }
            }}
          >
            <option value="">Select a map...</option>
            <For each={mapsStore.maps}>{(map) => <option value={map.id}>{map.name}</option>}</For>
          </select>

          <div class={styles.mapActions}>
            <button
              class={styles.iconButton}
              onClick={handleToggleAddMap}
              title={props.showAddMap() ? 'Hide add map' : 'Add new map'}
            >
              <BsPlus />
            </button>
            <button
              class={styles.iconButton}
              onClick={handleToggleBorderColorEdit}
              disabled={!mapsStore.selectedMapId}
              title="Edit border color template"
            >
              <BsPencil />
            </button>
            <button
              class={`${styles.iconButton} ${styles.deleteButton}`}
              onClick={handleDeleteMap}
              disabled={!mapsStore.selectedMapId}
              title="Delete map"
            >
              <BsTrash />
            </button>
          </div>
        </div>
      </div>

      {/* Edit border color for selected map */}
      <Show when={props.editingBorderColor() && mapsStore.selectedMap}>
        <div class={styles.addMapSection}>
          <h4>Edit Border Color Template</h4>
          <EJSCodeEditor
            value={props.editBorderColorValue()}
            onChange={props.setEditBorderColorValue}
            placeholder="Border color template (e.g., <%= systems && systems[currentSystemName] === 'republic' ? '#3498db' : '' %>)"
            minHeight="100px"
          />
          <div class={styles.mapActions}>
            <button class={styles.addMapButton} onClick={handleSaveBorderColor}>
              <BsCheck /> Save Border Color
            </button>
            <button class={styles.landmarkCancelButton} onClick={() => props.setEditingBorderColor(false)}>
              <BsX /> Cancel
            </button>
          </div>
        </div>
      </Show>

      <Show when={props.showAddMap()}>
        <div class={styles.addMapSection}>
          <h4>Add New Map</h4>
          <input
            type="text"
            class={styles.mapNameInput}
            value={props.newMapName()}
            onInput={(e) => props.setNewMapName(e.target.value)}
            placeholder="Map name"
          />

          <EJSCodeEditor
            value={props.newMapBorderColor()}
            onChange={props.setNewMapBorderColor}
            placeholder="Border color template (optional, e.g., <%= systems && systems[currentSystemName] === 'republic' ? '#3498db' : '' %>)"
            minHeight="60px"
          />

          <div class={styles.fileUpload}>
            <input
              type="file"
              id="map-file-input"
              class={styles.fileInput}
              accept="image/*"
              onChange={props.onFileSelect}
            />
            <label for="map-file-input" class={styles.fileInputLabel}>
              {props.selectedFileName() || 'Choose map image...'}
            </label>
          </div>

          <button class={styles.addMapButton} onClick={props.onAddMap} disabled={!props.newMapName().trim()}>
            <BsPlus /> Add Map
          </button>
        </div>
      </Show>
    </>
  )
}
