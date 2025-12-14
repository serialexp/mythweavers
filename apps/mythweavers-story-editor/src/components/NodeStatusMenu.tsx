import { Component, For, Show, createEffect, createSignal } from 'solid-js'
import { BsChevronRight } from 'solid-icons/bs'
import { ChapterStatus } from '../types/core'
import styles from './NodeStatusMenu.module.css'

export interface StatusOption {
  value: ChapterStatus | null
  label: string
  color?: string
}

export const STATUS_OPTIONS: StatusOption[] = [
  { value: null, label: 'None' },
  { value: 'draft', label: 'Draft', color: '#94a3b8' },
  { value: 'needs_work', label: 'Needs Work', color: '#f97316' },
  { value: 'review', label: 'Ready for Review', color: '#3b82f6' },
  { value: 'done', label: 'Done', color: '#22c55e' }
]

interface NodeStatusMenuProps {
  currentStatus?: ChapterStatus | null
  onSelect: (status: ChapterStatus | undefined) => void
  onOptionSelected?: () => void
  parentMenuOpen?: () => boolean
  labelPrefix?: string
  placement?: 'left' | 'right'
  onLayoutChange?: () => void
  onOpenChange?: (isOpen: boolean) => void
}

export const NodeStatusMenu: Component<NodeStatusMenuProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal(false)

  const labelPrefix = () => props.labelPrefix ?? 'Status'
  const placement = () => props.placement ?? 'left'

  const notifyLayoutChange = () => {
    if (!props.onLayoutChange) return
    // Call immediately to catch current state
    props.onLayoutChange?.()
    // Then call again after DOM updates
    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        props.onLayoutChange?.()
        // One more time after any CSS transitions
        setTimeout(() => props.onLayoutChange?.(), 100)
      })
    }
  }

  const selectedOption = () => {
    const current = props.currentStatus ?? null
    return STATUS_OPTIONS.find(option => option.value === current) ?? STATUS_OPTIONS[0]
  }

  createEffect(() => {
    const parentOpen = props.parentMenuOpen ? props.parentMenuOpen() : true
    if (!parentOpen && isOpen()) {
      setIsOpen(false)
      props.onOpenChange?.(false)
      notifyLayoutChange()
    }
  })

  const handleToggle = (e: MouseEvent) => {
    e.stopPropagation()
    const newState = !isOpen()
    setIsOpen(newState)
    // Notify parent of open state change
    props.onOpenChange?.(newState)
    // Let notifyLayoutChange handle the timing
    notifyLayoutChange()
  }

  const handleSelect = (option: StatusOption, e: MouseEvent) => {
    e.stopPropagation()
    props.onSelect(option.value ?? undefined)
    setIsOpen(false)
    props.onOpenChange?.(false)
    props.onOptionSelected?.()
    notifyLayoutChange()
  }

  const indicatorStyle = (option: StatusOption) => {
    if (option.color) {
      return { 'background-color': option.color }
    }
    return {
      'background-color': 'transparent',
      border: '1px solid var(--border-color)'
    }
  }

  return (
    <div class={styles.container} onClick={(e) => e.stopPropagation()}>
      <button
        class={`${styles.trigger} ${isOpen() ? styles.triggerActive : ''}`}
        onClick={handleToggle}
        type="button"
      >
        <span>
          {labelPrefix()}: {selectedOption().label}
        </span>
        <BsChevronRight class={`${styles.caret} ${isOpen() ? styles.caretOpen : ''}`} />
      </button>
      <Show when={isOpen()}>
        <div
          class={`${styles.menu} ${placement() === 'right' ? styles.menuRight : styles.menuLeft}`}
          onClick={(e) => e.stopPropagation()}
        >
          <For each={STATUS_OPTIONS}>
            {(option) => {
              const isSelected = (props.currentStatus ?? null) === option.value
              return (
                <button
                  type="button"
                  class={`${styles.option} ${isSelected ? styles.optionSelected : ''}`}
                  onClick={(e) => handleSelect(option, e)}
                >
                  <span
                    class={styles.indicator}
                    style={indicatorStyle(option)}
                  />
                  <span>{option.label}</span>
                </button>
              )
            }}
          </For>
        </div>
      </Show>
    </div>
  )
}
