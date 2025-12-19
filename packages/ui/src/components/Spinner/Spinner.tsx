import { spinner } from './Spinner.css'

export interface SpinnerProps {
  /** Spinner size */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Accessible label */
  label?: string
  /** Additional class */
  class?: string
}

export const Spinner = (props: SpinnerProps) => {
  return (
    <div
      class={`${spinner({ size: props.size })} ${props.class ?? ''}`}
      role="status"
      aria-label={props.label ?? 'Loading'}
    >
      <span
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          border: 0,
        }}
      >
        {props.label ?? 'Loading'}
      </span>
    </div>
  )
}
