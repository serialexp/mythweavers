import { type Component, type JSX } from 'solid-js'
import * as styles from './StatusIndicator.css'

// Default icons for each status
const CloudIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor">
    <path d="M4.406 3.342A5.53 5.53 0 0 1 8 2c2.69 0 4.923 2 5.166 4.579C14.758 6.804 16 8.137 16 9.773 16 11.569 14.502 13 12.687 13H3.781C1.708 13 0 11.366 0 9.318c0-1.763 1.266-3.223 2.942-3.593.143-.863.698-1.723 1.464-2.383zm.653.757c-.757.653-1.153 1.44-1.153 2.056v.448l-.445.049C2.064 6.805 1 7.952 1 9.318 1 10.785 2.23 12 3.781 12h8.906C13.98 12 15 10.988 15 9.773c0-1.216-1.02-2.228-2.313-2.228h-.5v-.5C12.188 4.825 10.328 3 8 3a4.53 4.53 0 0 0-2.941 1.1z" />
    <path d="M7.646 5.146l-1.5 1.5a.5.5 0 0 0 .708.708L7.5 6.707V10.5a.5.5 0 0 0 1 0V6.707l.646.647a.5.5 0 0 0 .708-.708l-1.5-1.5a.5.5 0 0 0-.708 0z" />
  </svg>
)

const CloudCheckIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor">
    <path d="M10.354 6.146a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7 8.793l2.646-2.647a.5.5 0 0 1 .708 0z" />
    <path d="M4.406 3.342A5.53 5.53 0 0 1 8 2c2.69 0 4.923 2 5.166 4.579C14.758 6.804 16 8.137 16 9.773 16 11.569 14.502 13 12.687 13H3.781C1.708 13 0 11.366 0 9.318c0-1.763 1.266-3.223 2.942-3.593.143-.863.698-1.723 1.464-2.383zm.653.757c-.757.653-1.153 1.44-1.153 2.056v.448l-.445.049C2.064 6.805 1 7.952 1 9.318 1 10.785 2.23 12 3.781 12h8.906C13.98 12 15 10.988 15 9.773c0-1.216-1.02-2.228-2.313-2.228h-.5v-.5C12.188 4.825 10.328 3 8 3a4.53 4.53 0 0 0-2.941 1.1z" />
  </svg>
)

const HddIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor">
    <path d="M4.5 11a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zM3 10.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0z" />
    <path d="M16 11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V9.51c0-.418.105-.83.305-1.197l2.472-4.531A1.5 1.5 0 0 1 4.094 3h7.812a1.5 1.5 0 0 1 1.317.782l2.472 4.53c.2.368.305.78.305 1.198V11zM3.655 4.26L1.592 8.043C1.724 8.014 1.86 8 2 8h12c.14 0 .276.014.408.043L12.345 4.26a.5.5 0 0 0-.439-.26H4.094a.5.5 0 0 0-.44.26zM1 10v1a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1z" />
  </svg>
)

const RefreshIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor">
    <path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z" />
    <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z" />
  </svg>
)

const WarningIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor">
    <path d="M7.938 2.016A.13.13 0 0 1 8.002 2a.13.13 0 0 1 .063.016.146.146 0 0 1 .054.057l6.857 11.667c.036.06.035.124.002.183a.163.163 0 0 1-.054.06.116.116 0 0 1-.066.017H1.146a.115.115 0 0 1-.066-.017.163.163 0 0 1-.054-.06.176.176 0 0 1 .002-.183L7.884 2.073a.147.147 0 0 1 .054-.057zm1.044-.45a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566z" />
    <path d="M7.002 12a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 5.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995z" />
  </svg>
)

const CheckIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor">
    <path d="M10.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425a.267.267 0 0 1 .02-.022z" />
  </svg>
)

export type StatusIndicatorStatus = 'idle' | 'loading' | 'success' | 'warning' | 'error'
export type StatusIndicatorMode = 'cloud' | 'local'

export interface StatusIndicatorProps {
  /** Indicator size */
  size?: 'sm' | 'md' | 'lg'
  /** Current status */
  status?: StatusIndicatorStatus
  /** Storage/connection mode - affects which icon is shown in idle state */
  mode?: StatusIndicatorMode
  /** Tooltip text */
  title?: string
  /** Custom icon - overrides default icon selection */
  icon?: JSX.Element
  /** Additional CSS class */
  class?: string
}

const getDefaultIcon = (status: StatusIndicatorStatus, mode: StatusIndicatorMode) => {
  switch (status) {
    case 'loading':
      return <RefreshIcon />
    case 'error':
      return <WarningIcon />
    case 'warning':
      return <WarningIcon />
    case 'success':
      return mode === 'cloud' ? <CloudCheckIcon /> : <CheckIcon />
    default:
      return mode === 'cloud' ? <CloudIcon /> : <HddIcon />
  }
}

export const StatusIndicator: Component<StatusIndicatorProps> = (props) => {
  const status = () => props.status ?? 'idle'
  const mode = () => props.mode ?? 'cloud'
  const icon = () => props.icon ?? getDefaultIcon(status(), mode())

  return (
    <div class={`${styles.indicator({ size: props.size, status: status() })} ${props.class ?? ''}`} title={props.title}>
      <span class={styles.icon({ status: status() })}>{icon()}</span>
    </div>
  )
}
