import { BsChevronRight, BsFlag } from 'solid-icons/bs'
import { Component, For, Show, createEffect, createSignal } from 'solid-js'
import { NodeStatus } from '../types/core'
import * as styles from './NodeStatusMenu.css'

export interface StatusOption {
  value: NodeStatus | null
  label: string
  color?: string
}

export const STATUS_OPTIONS: StatusOption[] = [
  { value: null, label: 'None' },
  { value: 'draft', label: 'Draft', color: '#94a3b8' },
  { value: 'needs_work', label: 'Needs Work', color: '#f97316' },
  { value: 'review', label: 'Ready for Review', color: '#3b82f6' },
  { value: 'done', label: 'Done', color: '#22c55e' },
]

interface NodeStatusMenuProps {
  currentStatus?: NodeStatus | null
  onSelect: (status: NodeStatus | undefined) => void
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

  const notifyLayoutChange = () => {
    if (!props.onLayoutChange) return
    props.onLayoutChange?.()
    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        props.onLayoutChange?.()
        setTimeout(() => props.onLayoutChange?.(), 100)
      })
    }
  }

  const selectedOption = () => {
    const current = props.currentStatus ?? null
    return STATUS_OPTIONS.find((option) => option.value === current) ?? STATUS_OPTIONS[0]
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
    props.onOpenChange?.(newState)
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

  return (
    <div class={styles.container} onClick={(e) => e.stopPropagation()}>
      <button
        class={`${styles.triggerButton} ${isOpen() ? styles.triggerButtonOpen : ''}`}
        onClick={handleToggle}
        type="button"
      >
        <span class={styles.triggerContent}>
          <BsFlag />
          <span>
            {labelPrefix()}: {selectedOption().label}
          </span>
        </span>
        <BsChevronRight class={`${styles.chevron} ${isOpen() ? styles.chevronOpen : ''}`} />
      </button>
      <Show when={isOpen()}>
        <div class={styles.dropdown} onClick={(e) => e.stopPropagation()}>
          <For each={STATUS_OPTIONS}>
            {(option) => {
              const isSelected = () => (props.currentStatus ?? null) === option.value
              return (
                <button
                  type="button"
                  class={`${styles.optionButton} ${isSelected() ? styles.optionButtonSelected : ''}`}
                  onClick={(e) => handleSelect(option, e)}
                >
                  <span
                    class={`${styles.statusIndicator} ${!option.color ? styles.statusIndicatorEmpty : ''}`}
                    style={option.color ? { 'background-color': option.color } : undefined}
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
