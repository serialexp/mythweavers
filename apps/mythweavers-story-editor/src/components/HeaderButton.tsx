import { IconButton } from '@mythweavers/ui'
import { Component, JSX } from 'solid-js'

interface HeaderButtonProps {
  onClick?: () => void
  title?: string
  variant?: 'default' | 'active' | 'danger' | 'primary'
  disabled?: boolean
  children: JSX.Element
  class?: string
}

export const HeaderButton: Component<HeaderButtonProps> = (props) => {
  // Map HeaderButton variants to IconButton props
  const getIconButtonVariant = (): 'secondary' | 'primary' | 'danger' => {
    if (props.variant === 'danger') return 'danger'
    if (props.variant === 'primary') return 'primary'
    return 'secondary' // default maps to secondary
  }

  const isActive = () => props.variant === 'active'

  return (
    <IconButton
      onClick={props.onClick}
      aria-label={props.title || 'Button'}
      variant={getIconButtonVariant()}
      active={isActive()}
      disabled={props.disabled}
      size="sm"
      class={props.class}
    >
      {props.children}
    </IconButton>
  )
}
