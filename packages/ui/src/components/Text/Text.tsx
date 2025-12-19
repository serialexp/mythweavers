import { type JSX, type ParentComponent, splitProps } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import * as styles from './Text.css'

type TextSize = 'xs' | 'sm' | 'base' | 'lg' | 'xl'
type TextWeight = 'normal' | 'medium' | 'semibold' | 'bold'
type TextColor = 'primary' | 'secondary' | 'muted' | 'accent' | 'success' | 'warning' | 'error'
type TextAlign = 'left' | 'center' | 'right'

export interface TextProps extends Omit<JSX.HTMLAttributes<HTMLParagraphElement>, 'color'> {
  /** Text size */
  size?: TextSize
  /** Font weight */
  weight?: TextWeight
  /** Text color */
  color?: TextColor
  /** Text alignment */
  align?: TextAlign
  /** Render as a different element (e.g., 'span', 'div', 'label') */
  as?: keyof JSX.IntrinsicElements
  children: JSX.Element
}

export const Text: ParentComponent<TextProps> = (props) => {
  const [local, variants, rest] = splitProps(
    props,
    ['children', 'class', 'as'],
    ['size', 'weight', 'color', 'align']
  )

  const tag = () => local.as ?? 'p'

  return (
    <Dynamic
      component={tag()}
      class={`${styles.text(variants)} ${local.class ?? ''}`}
      {...rest}
    >
      {local.children}
    </Dynamic>
  )
}
