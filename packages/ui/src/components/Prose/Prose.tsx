import { type JSX, splitProps } from 'solid-js'
import * as styles from './Prose.css'

export interface ProseProps extends JSX.HTMLAttributes<HTMLDivElement> {
  /** Text size */
  size?: 'sm' | 'md' | 'lg'
  /** Center the prose block */
  center?: boolean
  /** HTML content to render (use with caution - ensure it's sanitized) */
  html?: string
  children?: JSX.Element
}

export const Prose = (props: ProseProps) => {
  const [local, variants, rest] = splitProps(props, ['children', 'class', 'html'], ['size', 'center'])

  // Combine the recipe class with the global style target class
  const className = () => `${styles.prose(variants)} ${styles.proseClass} ${local.class ?? ''}`

  // If html prop is provided, render it using innerHTML
  if (local.html !== undefined) {
    return <div class={className()} innerHTML={local.html} {...rest} />
  }

  return (
    <div class={className()} {...rest}>
      {local.children}
    </div>
  )
}
