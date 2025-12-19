import { Button, Stack } from '@mythweavers/ui'
import { BsArrowDown, BsArrowUp } from 'solid-icons/bs'
import { Component, For, Show, createMemo } from 'solid-js'
import type { Landmark } from '../types/core'

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
    <div
      class="landmarks-list-panel"
      style={{
        width: '250px',
        background: 'var(--bg-primary)',
        'border-left': '1px solid var(--border-color)',
        display: 'flex',
        'flex-direction': 'column',
        overflow: 'hidden',
      }}
    >
      <Stack
        direction="horizontal"
        justify="between"
        align="center"
        style={{
          padding: '0.75rem',
          background: 'var(--bg-secondary)',
          'border-bottom': '1px solid var(--border-color)',
          'font-weight': '600',
          'font-size': '0.9rem',
          color: 'var(--text-primary)',
        }}
      >
        <span>Landmarks ({props.landmarks.length})</span>
        <Button size="sm" variant="secondary" onClick={props.onToggleSort}>
          {props.sortAscending ? <BsArrowDown /> : <BsArrowUp />} Sort
        </Button>
      </Stack>

      <div style={{ flex: 1, 'overflow-y': 'auto', padding: '0.5rem' }}>
        <Show
          when={sortedLandmarks().length > 0}
          fallback={
            <div
              style={{
                padding: '1rem',
                'text-align': 'center',
                color: 'var(--text-secondary)',
                'font-size': '0.85rem',
              }}
            >
              No landmarks yet. Click on the map to add one.
            </div>
          }
        >
          <Stack direction="vertical" gap="xs">
            <For each={sortedLandmarks()}>
              {(landmark) => {
                const isSelected = () => props.selectedLandmark?.id === landmark.id
                return (
                  <div
                    onClick={() => props.onSelectLandmark(landmark)}
                    style={{
                      padding: '0.5rem',
                      background: isSelected() ? 'var(--accent-bg)' : 'var(--bg-secondary)',
                      border: `1px solid ${isSelected() ? 'var(--accent-border)' : 'var(--border-color)'}`,
                      'border-radius': '4px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      'align-items': 'center',
                      gap: '0.5rem',
                      color: isSelected() ? 'var(--accent-color)' : 'inherit',
                    }}
                  >
                    <div
                      style={{
                        width: '12px',
                        height: '12px',
                        'border-radius': '50%',
                        'flex-shrink': '0',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        'background-color': landmark.color || '#3498db',
                      }}
                    />
                    <div
                      style={{
                        flex: 1,
                        'font-size': '0.85rem',
                        overflow: 'hidden',
                        'text-overflow': 'ellipsis',
                        'white-space': 'nowrap',
                      }}
                    >
                      {landmark.name}
                    </div>
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
