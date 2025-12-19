import { splitProps } from 'solid-js'
import { divider } from './Divider.css'

export interface DividerProps {
  /** Divider orientation */
  orientation?: 'horizontal' | 'vertical'
  /** Divider style variant */
  variant?: 'solid' | 'dashed' | 'dotted'
  /** Spacing around divider */
  spacing?: 'none' | 'sm' | 'md' | 'lg'
  /** Divider color intensity */
  color?: 'subtle' | 'default' | 'strong'
  /** Additional class */
  class?: string
}

export const Divider = (props: DividerProps) => {
  const [local, variants] = splitProps(props, ['class'])

  const isVertical = variants.orientation === 'vertical'

  return (
    <hr
      class={`${divider({
        orientation: variants.orientation,
        variant: variants.variant,
        spacing: variants.spacing,
        color: variants.color,
      })} ${local.class ?? ''}`}
      aria-orientation={isVertical ? 'vertical' : 'horizontal'}
    />
  )
}
