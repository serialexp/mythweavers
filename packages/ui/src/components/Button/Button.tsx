import { type JSX, createSignal, splitProps } from 'solid-js'
import { button, pressedGhostStyle } from './Button.css'

export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger'
  /** Button size */
  size?: 'sm' | 'md' | 'lg'
  /** Full width button */
  fullWidth?: boolean
  /** Icon-only button (square, no text padding) */
  iconOnly?: boolean
  /** Track pressed state internally (for use when preventDefault blocks :active) */
  manualPress?: boolean
  children: JSX.Element
}

export const Button = (props: ButtonProps) => {
  const [local, variants, rest] = splitProps(
    props,
    ['children', 'class', 'manualPress', 'onMouseDown', 'onMouseUp', 'onMouseLeave'],
    ['variant', 'size', 'fullWidth', 'iconOnly'],
  )

  const [pressed, setPressed] = createSignal(false)

  const handleMouseDown: JSX.EventHandler<HTMLButtonElement, MouseEvent> = (e) => {
    if (local.manualPress) setPressed(true)
    if (typeof local.onMouseDown === 'function') local.onMouseDown(e)
  }

  const handleMouseUp: JSX.EventHandler<HTMLButtonElement, MouseEvent> = (e) => {
    if (local.manualPress) setPressed(false)
    if (typeof local.onMouseUp === 'function') local.onMouseUp(e)
  }

  const handleMouseLeave: JSX.EventHandler<HTMLButtonElement, MouseEvent> = (e) => {
    if (local.manualPress) setPressed(false)
    if (typeof local.onMouseLeave === 'function') local.onMouseLeave(e)
  }

  const isPressed = () => local.manualPress && pressed()
  const isGhostPressed = () => isPressed() && variants.variant === 'ghost'

  return (
    <button
      class={`${button({ ...variants, pressed: isPressed() })} ${isGhostPressed() ? pressedGhostStyle : ''} ${local.class ?? ''}`}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      {...rest}
    >
      {local.children}
    </button>
  )
}
