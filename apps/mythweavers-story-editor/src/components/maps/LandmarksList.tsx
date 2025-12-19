import { BsArrowDown, BsArrowUp } from 'solid-icons/bs'
import { Accessor, Component, For, Show } from 'solid-js'
import { mapsStore } from '../../stores/mapsStore'
import { Landmark } from '../../types/core'
import { EJSRenderer } from '../EJSRenderer'
import * as styles from '../Maps.css'

interface LandmarksListProps {
  sortedLandmarks: Accessor<Landmark[]>
  selectedLandmark: Accessor<Landmark | null>
  sortAscending: Accessor<boolean>
  setSortAscending: (value: boolean) => void
  onFocusLandmark: (landmark: Landmark) => void
}

/**
 * Sidebar panel displaying list of all landmarks on the selected map
 */
export const LandmarksList: Component<LandmarksListProps> = (props) => {
  return (
    <Show when={mapsStore.selectedMap}>
      <div class={styles.landmarksList}>
        <div class={styles.landmarksListHeader}>
          <span>Landmarks</span>
          <button
            class={styles.sortButton}
            onClick={() => props.setSortAscending(!props.sortAscending())}
            title={props.sortAscending() ? 'Sort Z-A' : 'Sort A-Z'}
          >
            {props.sortAscending() ? <BsArrowDown /> : <BsArrowUp />}
          </button>
        </div>
        <div class={styles.landmarksListContent}>
          <Show
            when={props.sortedLandmarks().length > 0}
            fallback={<div class={styles.emptyLandmarksList}>No landmarks yet. Click on the map to add one.</div>}
          >
            <For each={props.sortedLandmarks()}>
              {(landmark) => (
                <div
                  class={`${styles.landmarkListItem} ${props.selectedLandmark()?.id === landmark.id ? styles.selected : ''}`}
                  onClick={() => props.onFocusLandmark(landmark)}
                >
                  <div class={styles.landmarkColorDot} style={{ background: landmark.color || '#3498db' }} />
                  <div class={styles.landmarkListName}>
                    <EJSRenderer template={landmark.name} mode="inline" />
                  </div>
                </div>
              )}
            </For>
          </Show>
        </div>
      </div>
    </Show>
  )
}
