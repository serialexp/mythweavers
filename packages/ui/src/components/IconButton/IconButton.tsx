import { type JSX, splitProps } from 'solid-js'
import { iconButton } from './IconButton.css'

export interface IconButtonProps extends Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Button variant */
  variant?: 'ghost' | 'secondary' | 'primary' | 'danger'
  /** Button size */
  size?: 'sm' | 'md' | 'lg'
  /** Active/pressed state for toggle buttons */
  active?: boolean
  /** Icon element to display */
  children: JSX.Element
  /** Required for accessibility - describes the button action */
  'aria-label': string
}

export const IconButton = (props: IconButtonProps) => {
  const [local, variants, rest] = splitProps(props, ['children', 'class', 'aria-label'], ['variant', 'size', 'active'])

  return (
    <button
      class={`${iconButton(variants)} ${local.class ?? ''}`}
      aria-label={local['aria-label']}
      aria-pressed={variants.active}
      title={local['aria-label']}
      {...rest}
    >
      {local.children}
    </button>
  )
}
