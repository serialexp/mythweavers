import {
  type JSX,
  type ParentComponent,
  Show,
  createEffect,
  createSignal,
  onCleanup,
} from 'solid-js'
import { Portal } from 'solid-js/web'
import * as styles from './Dropdown.css'

export interface DropdownProps {
  /** The trigger element (usually a button) */
  trigger: JSX.Element
  /** Align menu to right edge of trigger */
  alignRight?: boolean
  /** Additional class for the container */
  class?: string
  /** Render menu in a portal (useful when parent has overflow:hidden) */
  portal?: boolean
}

export const Dropdown: ParentComponent<DropdownProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal(false)
  const [menuPosition, setMenuPosition] = createSignal({ top: 0, left: 0, maxHeight: 0 })
  let containerRef: HTMLDivElement | undefined
  let triggerRef: HTMLDivElement | undefined
  let menuRef: HTMLDivElement | undefined

  const close = () => setIsOpen(false)
  const toggle = () => setIsOpen((prev) => !prev)

  // Update menu position when opened in portal mode
  const updatePosition = () => {
    if (props.portal && triggerRef) {
      // With display:contents, the wrapper has no box, so get the first child element
      const triggerElement = triggerRef.firstElementChild as HTMLElement | null
      const rect = triggerElement?.getBoundingClientRect() ?? triggerRef.getBoundingClientRect()
      const menuWidth = menuRef?.offsetWidth ?? 180
      const menuHeight = menuRef?.offsetHeight ?? 200
      const padding = 8 // Padding from viewport edges

      let left = props.alignRight ? rect.right - menuWidth : rect.left
      // Keep menu within viewport horizontally
      if (left + menuWidth > window.innerWidth) {
        left = window.innerWidth - menuWidth - padding
      }
      if (left < padding) {
        left = padding
      }

      // Calculate available space above and below
      const spaceBelow = window.innerHeight - rect.bottom - padding
      const spaceAbove = rect.top - padding
      const fitsBelow = spaceBelow >= menuHeight
      const fitsAbove = spaceAbove >= menuHeight

      console.log('[Dropdown] Auto-position debug:', {
        menuHeight,
        menuWidth,
        triggerTop: rect.top,
        triggerBottom: rect.bottom,
        spaceAbove,
        spaceBelow,
        fitsAbove,
        fitsBelow,
        windowHeight: window.innerHeight,
      })

      let top: number
      let maxHeight: number

      // Prefer dropping up if there's significantly more space above
      // This handles cases where menuHeight measurement is unreliable (e.g., menu not fully rendered yet)
      const hasMoreSpaceAbove = spaceAbove > spaceBelow * 2

      if ((fitsBelow && !hasMoreSpaceAbove) || (!fitsAbove && spaceBelow >= spaceAbove)) {
        // Position below
        console.log('[Dropdown] Positioning BELOW')
        top = rect.bottom + 4
        maxHeight = spaceBelow - 4 // Account for the 4px gap
      } else {
        // Position above
        console.log('[Dropdown] Positioning ABOVE')
        top = rect.top - Math.min(menuHeight, spaceAbove) - 4
        maxHeight = spaceAbove - 4 // Account for the 4px gap
      }

      setMenuPosition({ top, left, maxHeight })
    }
  }

  // Close on click outside - only attach listener when open
  createEffect(() => {
    if (isOpen()) {
      // Use requestAnimationFrame to wait for Portal to finish rendering
      // before measuring the menu height for auto-positioning
      requestAnimationFrame(() => {
        updatePosition()
      })

      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as Node
        // In portal mode with display:contents, check the trigger's first child element
        const triggerElement = props.portal ? triggerRef?.firstElementChild : triggerRef
        const isOutsideTrigger = !triggerElement || !triggerElement.contains(target)
        const isOutsideMenu = !menuRef || !menuRef.contains(target)

        if (isOutsideTrigger && isOutsideMenu) {
          close()
        }
      }

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          close()
        }
      }

      // Delay to avoid closing immediately from the opening click
      setTimeout(() => {
        document.addEventListener('click', handleClickOutside)
        document.addEventListener('keydown', handleKeyDown)
      }, 0)

      onCleanup(() => {
        document.removeEventListener('click', handleClickOutside)
        document.removeEventListener('keydown', handleKeyDown)
      })
    }
  })

  const menuContent = () => (
    <div
      ref={menuRef}
      class={`${styles.menu} ${props.alignRight && !props.portal ? styles.menuRight : ''}`}
      role="menu"
      style={
        props.portal
          ? {
              position: 'fixed',
              top: `${menuPosition().top}px`,
              left: `${menuPosition().left}px`,
              'max-height': `${menuPosition().maxHeight}px`,
              'overflow-y': 'auto',
              'z-index': '1000', // above mobile navigation (900) and other overlays
            }
          : undefined
      }
      onClick={(e) => {
        // Close dropdown when any menu item is clicked
        // (unless the click target is an expanding submenu)
        const target = e.target as HTMLElement
        if (target.closest('button, a, [role="menuitem"]')) {
          close()
        }
      }}
    >
      {props.children}
    </div>
  )

  // In portal mode, use display:contents so container doesn't affect layout
  // This allows buttons to be true siblings in ButtonGroup
  const containerClass = () =>
    props.portal
      ? `${styles.containerPortal} ${props.class ?? ''}`
      : `${styles.container} ${props.class ?? ''}`

  // Track if touch started to prevent double-firing from touch + synthesized click
  let touchStarted = false

  const handleTouchStart = () => {
    touchStarted = true
  }

  const handleTouchEnd = (e: TouchEvent) => {
    e.preventDefault() // Prevent synthesized click event
    e.stopPropagation()
    toggle()
    // Reset after a short delay
    setTimeout(() => { touchStarted = false }, 300)
  }

  const handleClick = (e: MouseEvent) => {
    // Ignore if this click was triggered by a touch (already handled)
    if (touchStarted) return
    e.stopPropagation()
    toggle()
  }

  return (
    <div ref={containerRef} class={containerClass()}>
      <div
        ref={triggerRef}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={props.portal ? { display: 'contents' } : undefined}
      >
        {props.trigger}
      </div>
      <Show when={isOpen()}>
        <Show when={props.portal} fallback={menuContent()}>
          <Portal>{menuContent()}</Portal>
        </Show>
      </Show>
    </div>
  )
}

export interface DropdownItemProps {
  /** Click handler */
  onClick?: () => void
  /** Danger/destructive styling */
  danger?: boolean
  /** Disabled state */
  disabled?: boolean
  /** Icon to display before label */
  icon?: JSX.Element
  /** Active/selected state - shows checkmark and highlights */
  active?: boolean
  children: JSX.Element
}

export const DropdownItem: ParentComponent<DropdownItemProps> = (props) => {
  return (
    <button
      class={`${styles.item} ${props.danger ? styles.itemDanger : ''} ${props.active ? styles.itemActive : ''}`}
      onClick={props.onClick}
      disabled={props.disabled}
      role="menuitem"
      aria-checked={props.active}
    >
      {props.icon}
      <span class={styles.itemLabel}>{props.children}</span>
      <Show when={props.active}>
        <svg class={styles.checkmark} viewBox="0 0 16 16" fill="currentColor">
          <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
        </svg>
      </Show>
    </button>
  )
}

export const DropdownDivider = () => <div class={styles.divider} role="separator" />
