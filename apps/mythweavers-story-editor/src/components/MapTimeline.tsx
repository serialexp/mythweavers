import { Button } from '@mythweavers/ui'
import { Component, Show } from 'solid-js'
import * as styles from './MapTimeline.css'

interface MapTimelineProps {
  hasTimeline: boolean
  timelinePosition: number
  maxPosition: number
  onPositionChange: (position: number) => void
  onReset: () => void
}

export const MapTimeline: Component<MapTimelineProps> = (props) => {
  return (
    <Show when={props.hasTimeline}>
      <div class={styles.section}>
        <div class={styles.header}>
          <span>
            Timeline: {props.timelinePosition} / {props.maxPosition}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={props.onReset}
            disabled={props.timelinePosition >= props.maxPosition}
          >
            Reset to Latest
          </Button>
        </div>
        <input
          type="range"
          class={styles.slider}
          min="0"
          max={props.maxPosition}
          value={props.timelinePosition}
          onInput={(e) => props.onPositionChange(Number.parseInt(e.currentTarget.value))}
        />
      </div>
    </Show>
  )
}
