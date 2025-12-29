import { ToggleButton } from '@mythweavers/ui'
import { Component, For, Show } from 'solid-js'
import { BsCursor, BsGeoAlt, BsPerson, BsShare } from 'solid-icons/bs'
import { mapEditorStore, type CreationMode, type OverlayMethod } from '../../stores/mapEditorStore'
import { mapsStore } from '../../stores/mapsStore'
import { DEFAULT_PROPERTY_SCHEMA } from '../../types/core'
import * as styles from '../Maps.css'

// Get allegiance options from schema
const getAllegianceOptions = () => {
  const allegianceField = DEFAULT_PROPERTY_SCHEMA.stateFields.find((f) => f.key === 'allegiance')
  return allegianceField?.options || []
}

interface MapToolbarProps {
  onModeChange?: (mode: CreationMode) => void
}

/**
 * Toolbar for map tools and overlay controls.
 * Reads and writes state directly from mapEditorStore.
 */
export const MapToolbar: Component<MapToolbarProps> = (props) => {
  const handleModeClick = (mode: CreationMode) => {
    mapEditorStore.setCreationMode(mode)
    props.onModeChange?.(mode)
  }

  return (
    <div class={styles.mapToolbar}>
      {/* Left side: Tool buttons */}
      <div class={styles.toolbarLeft}>
        <ToggleButton
          size="sm"
          active={mapEditorStore.creationMode === 'select'}
          onClick={() => handleModeClick('select')}
          title="Select and pan"
        >
          <BsCursor />
          Select
        </ToggleButton>
        <ToggleButton
          size="sm"
          active={mapEditorStore.creationMode === 'landmark'}
          onClick={() => handleModeClick('landmark')}
          title="Click map to add landmarks"
        >
          <BsGeoAlt />
          Add Landmark
        </ToggleButton>
        <ToggleButton
          size="sm"
          active={mapEditorStore.creationMode === 'pawn'}
          onClick={() => handleModeClick('pawn')}
          title="Click map to add pawns"
        >
          <BsPerson />
          Add Pawn
        </ToggleButton>
        <ToggleButton
          size="sm"
          active={mapEditorStore.creationMode === 'path'}
          onClick={() => handleModeClick('path')}
          title="Click landmarks to create paths"
        >
          <BsShare />
          Add Path
        </ToggleButton>
      </div>

      {/* Right side: Overlay controls */}
      <Show when={mapsStore.selectedMap?.borderColor}>
        <div class={styles.toolbarRight}>
          {/* Faction Control Toggle */}
          <ToggleButton
            size="sm"
            active={mapEditorStore.showFactionOverlay}
            onClick={() => mapEditorStore.setShowFactionOverlay(!mapEditorStore.showFactionOverlay)}
          >
            Faction Control
          </ToggleButton>
          <Show when={mapEditorStore.showFactionOverlay}>
            <select
              class={styles.toolbarSelect}
              value={mapEditorStore.overlayMethod}
              onChange={(e) => mapEditorStore.setOverlayMethod(e.target.value as OverlayMethod)}
            >
              <option value="voronoi">Standard Voronoi</option>
              <option value="metaball">Distance Field</option>
              <option value="blurred">Blurred Voronoi</option>
              <option value="noise" disabled>
                Noise (Coming Soon)
              </option>
            </select>
          </Show>

          {/* Paint Mode Toggle */}
          <ToggleButton
            size="sm"
            active={mapEditorStore.paintModeEnabled}
            onClick={() => mapEditorStore.setPaintModeEnabled(!mapEditorStore.paintModeEnabled)}
          >
            Paint Mode
          </ToggleButton>
          <Show when={mapEditorStore.paintModeEnabled}>
            <select
              class={styles.toolbarSelect}
              value={mapEditorStore.selectedPaintFaction || ''}
              onChange={(e) => mapEditorStore.setSelectedPaintFaction(e.target.value || null)}
            >
              <option value="">Clear Allegiance</option>
              <For each={getAllegianceOptions()}>
                {(option) => <option value={option.value}>{option.label}</option>}
              </For>
            </select>
          </Show>
        </div>
      </Show>
    </div>
  )
}
