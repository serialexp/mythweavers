import { type JSX, type ParentComponent } from 'solid-js'
import { badge } from './Badge.css'

export interface BadgeProps {
  /** Badge variant */
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'
  /** Badge size */
  size?: 'sm' | 'md' | 'lg'
  /** Icon to display before text */
  icon?: JSX.Element
  /** Additional class */
  class?: string
  /** Inline styles */
  style?: JSX.CSSProperties
  children: JSX.Element
}

export const Badge: ParentComponent<BadgeProps> = (props) => {
  return (
    <span
      class={`${badge({ variant: props.variant, size: props.size })} ${props.class ?? ''}`}
      style={props.style}
    >
      {props.icon}
      {props.children}
    </span>
  )
}
