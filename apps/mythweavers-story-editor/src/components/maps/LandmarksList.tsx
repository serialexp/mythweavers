import { BsArrowDown, BsArrowUp } from 'solid-icons/bs'
import { Component, For, Show, createMemo, createSignal, onCleanup, onMount } from 'solid-js'
import { mapEditorStore } from '../../stores/mapEditorStore'
import { mapsStore } from '../../stores/mapsStore'
import { EJSRenderer } from '../EJSRenderer'
import * as styles from '../Maps.css'

// Fixed item height for virtualization (content + padding + border + gap)
const ITEM_HEIGHT = 40
const OVERSCAN = 5 // Extra items to render above/below viewport

/**
 * Sidebar panel displaying list of all landmarks on the selected map.
 * Uses virtualization to handle large lists efficiently.
 * Reads all state directly from mapEditorStore and mapsStore.
 */
export const LandmarksList: Component = () => {
  let containerRef: HTMLDivElement | undefined
  const [scrollTop, setScrollTop] = createSignal(0)
  const [containerHeight, setContainerHeight] = createSignal(400)

  // Sorted landmarks - derived from mapsStore and mapEditorStore.sortAscending
  const sortedLandmarks = createMemo(() => {
    const map = mapsStore.selectedMap
    if (!map) return []

    const landmarks = [...map.landmarks]
    landmarks.sort((a, b) => {
      const comparison = a.name.localeCompare(b.name)
      return mapEditorStore.sortAscending ? comparison : -comparison
    })
    return landmarks
  })

  // Calculate visible range
  const visibleRange = createMemo(() => {
    const landmarks = sortedLandmarks()
    const totalItems = landmarks.length
    const scroll = scrollTop()
    const height = containerHeight()

    const startIndex = Math.max(0, Math.floor(scroll / ITEM_HEIGHT) - OVERSCAN)
    const endIndex = Math.min(totalItems, Math.ceil((scroll + height) / ITEM_HEIGHT) + OVERSCAN)

    return { startIndex, endIndex, totalItems }
  })

  // Get visible items
  const visibleItems = createMemo(() => {
    const { startIndex, endIndex } = visibleRange()
    return sortedLandmarks().slice(startIndex, endIndex).map((landmark, i) => ({
      landmark,
      index: startIndex + i,
    }))
  })

  // Total height of all items
  const totalHeight = createMemo(() => sortedLandmarks().length * ITEM_HEIGHT)

  // Handle scroll
  const handleScroll = (e: Event) => {
    const target = e.target as HTMLDivElement
    setScrollTop(target.scrollTop)
  }

  // Update container height on mount and resize
  onMount(() => {
    if (containerRef) {
      setContainerHeight(containerRef.clientHeight)

      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerHeight(entry.contentRect.height)
        }
      })
      resizeObserver.observe(containerRef)

      onCleanup(() => resizeObserver.disconnect())
    }
  })

  return (
    <Show when={mapsStore.selectedMap}>
      <div class={styles.landmarksList}>
        <div class={styles.landmarksListHeader}>
          <span>Landmarks ({sortedLandmarks().length})</span>
          <button
            class={styles.sortButton}
            onClick={() => mapEditorStore.toggleSortOrder()}
            title={mapEditorStore.sortAscending ? 'Sort Z-A' : 'Sort A-Z'}
          >
            {mapEditorStore.sortAscending ? <BsArrowDown /> : <BsArrowUp />}
          </button>
        </div>
        <div
          ref={containerRef}
          class={styles.landmarksListContent}
          onScroll={handleScroll}
        >
          <Show
            when={sortedLandmarks().length > 0}
            fallback={<div class={styles.emptyLandmarksList}>No landmarks yet. Click on the map to add one.</div>}
          >
            {/* Virtual scroll container */}
            <div style={{ height: `${totalHeight()}px`, position: 'relative' }}>
              <For each={visibleItems()}>
                {({ landmark, index }) => {
                  // Use function for reactivity inside For callback
                  const isSelected = () => mapEditorStore.selectedLandmark?.id === landmark.id
                  return (
                    <div
                      class={`${styles.landmarkListItem} ${isSelected() ? styles.selected : ''}`}
                      style={{
                        position: 'absolute',
                        top: `${index * ITEM_HEIGHT}px`,
                        left: 0,
                        right: 0,
                        height: `${ITEM_HEIGHT - 4}px`, // Subtract gap
                        'box-sizing': 'border-box',
                      }}
                      onClick={() => mapEditorStore.focusOnLandmark(landmark)}
                    >
                      <div class={styles.landmarkColorDot} style={{ background: landmark.color || '#3498db' }} />
                      <div class={styles.landmarkListName}>
                        <EJSRenderer template={landmark.name} mode="inline" />
                      </div>
                    </div>
                  )
                }}
              </For>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  )
}
