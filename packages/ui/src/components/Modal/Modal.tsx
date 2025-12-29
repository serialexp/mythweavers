import {
  type JSX,
  type ParentComponent,
  Show,
  createEffect,
  createUniqueId,
  onCleanup,
  onMount,
  splitProps,
} from 'solid-js'
import { Portal } from 'solid-js/web'
import * as styles from './Modal.css'

export interface ModalProps {
  /** Modal size */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  /** Whether the modal is open */
  open: boolean
  /** Called when the modal should close */
  onClose: () => void
  /** Modal title displayed in header */
  title?: string | JSX.Element
  /** Hide the close button in the header */
  hideCloseButton?: boolean
  /** Content for the modal body */
  children: JSX.Element
  /** Optional footer content (e.g., action buttons) */
  footer?: JSX.Element
  /** Additional class for the modal container */
  class?: string
}

export const Modal: ParentComponent<ModalProps> = (props) => {
  const [local, variants, _rest] = splitProps(
    props,
    ['open', 'onClose', 'title', 'hideCloseButton', 'children', 'footer', 'class'],
    ['size'],
  )

  const titleId = createUniqueId()
  let modalRef: HTMLDivElement | undefined
  let previousActiveElement: Element | null = null

  // Handle escape key
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && local.open) {
      local.onClose()
    }
  }

  // Focus trap - keep focus inside modal
  const handleFocusTrap = (e: FocusEvent) => {
    if (!modalRef || !local.open) return

    const focusableElements = modalRef.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )

    if (focusableElements.length === 0) return

    const firstElement = focusableElements[0]

    // If focus moved outside modal, bring it back
    if (!modalRef.contains(e.target as Node)) {
      firstElement.focus()
    }
  }

  onMount(() => {
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('focusin', handleFocusTrap)
  })

  onCleanup(() => {
    document.removeEventListener('keydown', handleKeyDown)
    document.removeEventListener('focusin', handleFocusTrap)
  })

  // Manage focus and body scroll when modal opens/closes
  createEffect(() => {
    if (local.open) {
      // Store currently focused element
      previousActiveElement = document.activeElement

      // Prevent body scroll
      document.body.style.overflow = 'hidden'

      // Focus the modal after a tick (let it render first)
      setTimeout(() => {
        if (modalRef) {
          const firstFocusable = modalRef.querySelector<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          )
          firstFocusable?.focus()
        }
      }, 0)
    } else {
      // Restore body scroll
      document.body.style.overflow = ''

      // Restore focus to previously focused element
      if (previousActiveElement instanceof HTMLElement) {
        previousActiveElement.focus()
      }
    }
  })

  // Cleanup on unmount
  onCleanup(() => {
    document.body.style.overflow = ''
  })

  return (
    <Show when={local.open}>
      <Portal>
        {/* Backdrop */}
        <div class={styles.overlay} onClick={local.onClose} />

        {/* Modal */}
        <div
          ref={modalRef}
          class={`${styles.modal(variants)} ${local.class ?? ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={local.title ? titleId : undefined}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <Show when={local.title || !local.hideCloseButton}>
            <div class={styles.header}>
              <Show when={local.title}>
                <h2 id={titleId} class={styles.title}>
                  {local.title}
                </h2>
              </Show>
              <Show when={!local.hideCloseButton}>
                <button class={styles.closeButton} onClick={local.onClose} aria-label="Close modal">
                  ×
                </button>
              </Show>
            </div>
          </Show>

          {/* Content */}
          <div class={styles.content}>{local.children}</div>

          {/* Footer */}
          <Show when={local.footer}>
            <div class={styles.footer}>{local.footer}</div>
          </Show>
        </div>
      </Portal>
    </Show>
  )
}
