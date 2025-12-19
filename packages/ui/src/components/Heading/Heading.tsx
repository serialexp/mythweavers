import { type JSX, type ParentComponent, splitProps } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import * as styles from './Heading.css'

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6
type HeadingSize = 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl'
type HeadingWeight = 'normal' | 'medium' | 'semibold' | 'bold'
type HeadingColor = 'primary' | 'secondary' | 'muted' | 'accent'
type HeadingAlign = 'left' | 'center' | 'right'

// Default size mapping for each heading level
const levelSizeMap: Record<HeadingLevel, HeadingSize> = {
  1: '4xl',
  2: '3xl',
  3: '2xl',
  4: 'xl',
  5: 'lg',
  6: 'base',
}

export interface HeadingProps extends Omit<JSX.HTMLAttributes<HTMLHeadingElement>, 'color'> {
  /** Semantic heading level (h1-h6) */
  level?: HeadingLevel
  /** Visual size - overrides the default size for the level */
  size?: HeadingSize
  /** Font weight */
  weight?: HeadingWeight
  /** Text color */
  color?: HeadingColor
  /** Text alignment */
  align?: HeadingAlign
  /** Render as a different element (e.g., 'span', 'div') */
  as?: keyof JSX.IntrinsicElements
  children: JSX.Element
}

export const Heading: ParentComponent<HeadingProps> = (props) => {
  const [local, variants, rest] = splitProps(
    props,
    ['children', 'class', 'level', 'as'],
    ['size', 'weight', 'color', 'align']
  )

  const level = () => local.level ?? 2
  const tag = () => local.as ?? (`h${level()}` as keyof JSX.IntrinsicElements)

  // Use provided size or default based on level
  const size = () => variants.size ?? levelSizeMap[level()]

  return (
    <Dynamic
      component={tag()}
      class={`${styles.heading({ ...variants, size: size() })} ${local.class ?? ''}`}
      {...rest}
    >
      {local.children}
    </Dynamic>
  )
}
