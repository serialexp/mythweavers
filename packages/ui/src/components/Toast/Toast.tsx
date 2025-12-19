import { type JSX, type ParentComponent, Show, onCleanup } from 'solid-js'
import { Portal } from 'solid-js/web'
import * as styles from './Toast.css'

export type ToastVariant = 'default' | 'success' | 'warning' | 'error' | 'info'
export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center'

// Icons for different variants
const SuccessIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
    <polyline points="22,4 12,14.01 9,11.01" />
  </svg>
)

const WarningIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

const ErrorIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
)

const InfoIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
)

const getIcon = (variant: ToastVariant) => {
  switch (variant) {
    case 'success':
      return <SuccessIcon />
    case 'warning':
      return <WarningIcon />
    case 'error':
      return <ErrorIcon />
    case 'info':
      return <InfoIcon />
    default:
      return null
  }
}

export interface ToastProps {
  /** Toast variant */
  variant?: ToastVariant
  /** Toast title */
  title?: string
  /** Toast message */
  message: string
  /** Called when toast is dismissed */
  onClose?: () => void
  /** Auto-dismiss after ms (0 to disable) */
  duration?: number
}

export const Toast: ParentComponent<ToastProps> = (props) => {
  const variant = () => props.variant ?? 'default'
  const icon = () => getIcon(variant())

  // Auto-dismiss
  if (props.duration !== 0) {
    const timeout = setTimeout(() => {
      props.onClose?.()
    }, props.duration ?? 5000)

    onCleanup(() => clearTimeout(timeout))
  }

  return (
    <div class={styles.toast({ variant: variant() })} role="alert">
      <Show when={icon()}>
        <div class={styles.icon({ variant: variant() })}>{icon()}</div>
      </Show>
      <div class={styles.content}>
        <Show when={props.title}>
          <div class={styles.title}>{props.title}</div>
        </Show>
        <div class={styles.message}>{props.message}</div>
      </div>
      <Show when={props.onClose}>
        <button class={styles.closeButton} onClick={props.onClose} aria-label="Dismiss">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </Show>
    </div>
  )
}

// Toast container for managing multiple toasts
export interface ToastContainerProps {
  /** Container position */
  position?: ToastPosition
  children: JSX.Element
}

export const ToastContainer: ParentComponent<ToastContainerProps> = (props) => {
  return (
    <Portal>
      <div class={styles.container({ position: props.position })}>{props.children}</div>
    </Portal>
  )
}
