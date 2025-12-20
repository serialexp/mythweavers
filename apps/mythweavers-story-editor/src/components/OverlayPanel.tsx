import { IconButton } from '@mythweavers/ui'
import { BsX } from 'solid-icons/bs'
import { Component, JSX, Show, onCleanup, onMount } from 'solid-js'
import { Portal } from 'solid-js/web'
import * as styles from './OverlayPanel.css'

interface OverlayPanelProps {
  show: boolean
  onClose: () => void
  title: string
  children: JSX.Element
  position?: 'left' | 'right' | 'center'
  headerAction?: JSX.Element
}

export const OverlayPanel: Component<OverlayPanelProps> = (props) => {
  // Handle escape key to close
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && props.show) {
      props.onClose()
    }
  }

  onMount(() => {
    document.addEventListener('keydown', handleEscape)
  })

  onCleanup(() => {
    document.removeEventListener('keydown', handleEscape)
  })

  return (
    <Show when={props.show}>
      <Portal>
        {/* Overlay backdrop */}
        <div class={styles.backdrop} onClick={props.onClose}>
          {/* Panel */}
          <div class={styles.panel} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div class={styles.header}>
              <h2 class={styles.title}>{props.title}</h2>
              <div class={styles.headerActions}>
                {props.headerAction}
                <IconButton onClick={props.onClose} aria-label="Close panel" size="md">
                  <BsX size={24} />
                </IconButton>
              </div>
            </div>

            {/* Content */}
            <div class={styles.content}>{props.children}</div>
          </div>
        </div>
      </Portal>
    </Show>
  )
}
