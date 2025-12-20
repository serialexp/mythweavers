import { Button, Stack } from '@mythweavers/ui'
import { BsArrowDown, BsArrowUp } from 'solid-icons/bs'
import { Component, For, Show, createMemo } from 'solid-js'
import type { Landmark } from '../types/core'
import * as styles from './LandmarksList.css'

interface LandmarksListProps {
  landmarks: Landmark[]
  selectedLandmark: Landmark | null
  sortAscending: boolean
  onSelectLandmark: (landmark: Landmark) => void
  onToggleSort: () => void
}

export const LandmarksList: Component<LandmarksListProps> = (props) => {
  const sortedLandmarks = createMemo(() => {
    const sorted = [...props.landmarks].sort((a, b) => {
      const aName = a.name.toLowerCase()
      const bName = b.name.toLowerCase()
      if (props.sortAscending) {
        return aName < bName ? -1 : aName > bName ? 1 : 0
      }
      return aName > bName ? -1 : aName < bName ? 1 : 0
    })
    return sorted
  })

  return (
    <div class={`landmarks-list-panel ${styles.panel}`}>
      <Stack direction="horizontal" justify="between" align="center" class={styles.header}>
        <span>Landmarks ({props.landmarks.length})</span>
        <Button size="sm" variant="secondary" onClick={props.onToggleSort}>
          {props.sortAscending ? <BsArrowDown /> : <BsArrowUp />} Sort
        </Button>
      </Stack>

      <div class={styles.listContent}>
        <Show when={sortedLandmarks().length > 0} fallback={<div class={styles.emptyMessage}>No landmarks yet. Click on the map to add one.</div>}>
          <Stack direction="vertical" gap="xs">
            <For each={sortedLandmarks()}>
              {(landmark) => {
                const isSelected = () => props.selectedLandmark?.id === landmark.id
                return (
                  <div
                    onClick={() => props.onSelectLandmark(landmark)}
                    class={`${styles.landmarkItem} ${isSelected() ? styles.landmarkItemSelected : ''}`}
                  >
                    <div class={styles.colorDot} style={{ 'background-color': landmark.color || '#3498db' }} />
                    <div class={styles.landmarkName}>{landmark.name}</div>
                  </div>
                )
              }}
            </For>
          </Stack>
        </Show>
      </div>
    </div>
  )
}
