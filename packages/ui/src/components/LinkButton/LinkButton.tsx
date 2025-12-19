import { type JSX, type ParentComponent, splitProps } from 'solid-js'
import * as styles from './LinkButton.css'

export interface LinkButtonProps extends JSX.AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  /** Button size */
  size?: 'sm' | 'md' | 'lg'
  /** Full width */
  fullWidth?: boolean
  children: JSX.Element
}

/**
 * LinkButton - An anchor element styled as a button.
 * Use this for navigation links that should look like buttons.
 * For actual buttons that perform actions, use the Button component.
 */
export const LinkButton: ParentComponent<LinkButtonProps> = (props) => {
  const [local, variants, rest] = splitProps(props, ['children', 'class'], ['variant', 'size', 'fullWidth'])

  return (
    <a class={`${styles.linkButton(variants)} ${local.class ?? ''}`} {...rest}>
      {local.children}
    </a>
  )
}
