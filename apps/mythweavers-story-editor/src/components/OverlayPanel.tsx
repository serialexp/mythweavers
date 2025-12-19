import { IconButton } from '@mythweavers/ui'
import { BsX } from 'solid-icons/bs'
import { Component, JSX, Show, onCleanup, onMount } from 'solid-js'
import { Portal } from 'solid-js/web'

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
        <div
          style={{
            position: 'fixed',
            top: '0',
            left: '0',
            right: '0',
            bottom: '0',
            background: 'rgba(0, 0, 0, 0.5)',
            'z-index': '250',
            display: 'flex',
            'align-items': 'flex-start',
            'justify-content': 'flex-start',
          }}
          onClick={props.onClose}
        >
          {/* Panel */}
          <div
            style={{
              background: 'var(--bg-primary)',
              position: 'fixed',
              top: '0',
              bottom: '0',
              left: '0',
              right: '0',
              display: 'flex',
              'flex-direction': 'column',
              'box-shadow': '2px 0 10px rgba(0, 0, 0, 0.2)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                'align-items': 'center',
                'justify-content': 'space-between',
                padding: '15px 20px',
                background: 'var(--bg-secondary)',
                'border-bottom': '1px solid var(--border-color)',
                'flex-shrink': '0',
              }}
            >
              <h2
                style={{
                  'font-size': '18px',
                  'font-weight': '600',
                  color: 'var(--text-primary)',
                  margin: '0',
                }}
              >
                {props.title}
              </h2>
              <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
                {props.headerAction}
                <IconButton onClick={props.onClose} aria-label="Close panel" size="md">
                  <BsX size={24} />
                </IconButton>
              </div>
            </div>

            {/* Content */}
            <div
              style={{
                flex: '1',
                'overflow-y': 'auto',
                'overflow-x': 'hidden',
              }}
            >
              {props.children}
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  )
}
