import { Button } from '@mythweavers/ui'
import { Component, JSX, Show } from 'solid-js'

interface MapTimelineProps {
  hasTimeline: boolean
  timelinePosition: number
  maxPosition: number
  onPositionChange: (position: number) => void
  onReset: () => void
}

export const MapTimeline: Component<MapTimelineProps> = (props) => {
  const sectionStyle: JSX.CSSProperties = {
    display: 'flex',
    'flex-direction': 'column',
    gap: '0.5rem',
    padding: '1rem',
    background: 'var(--bg-secondary)',
    'border-radius': '4px',
    border: '1px solid var(--border-color)',
  }

  const headerStyle: JSX.CSSProperties = {
    display: 'flex',
    'justify-content': 'space-between',
    'align-items': 'center',
    color: 'var(--text-primary)',
    'font-size': '0.9rem',
  }

  const sliderStyle: JSX.CSSProperties = {
    width: '100%',
    height: '24px',
    background: 'var(--bg-tertiary)',
    'border-radius': '12px',
    outline: 'none',
  }

  return (
    <Show when={props.hasTimeline}>
      <div style={sectionStyle}>
        <div style={headerStyle}>
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
          style={sliderStyle}
          min="0"
          max={props.maxPosition}
          value={props.timelinePosition}
          onInput={(e) => props.onPositionChange(Number.parseInt(e.currentTarget.value))}
        />
      </div>
    </Show>
  )
}
