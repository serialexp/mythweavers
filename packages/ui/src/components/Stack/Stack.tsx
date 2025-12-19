import { JSX, splitProps } from 'solid-js'
import { stack } from './Stack.css'

export interface StackProps {
  /** Stack direction */
  direction?: 'vertical' | 'horizontal'
  /** Gap between items */
  gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  /** Cross-axis alignment */
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline'
  /** Main-axis justification */
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'
  /** Allow wrapping */
  wrap?: boolean
  /** Stack content */
  children?: JSX.Element
  /** Additional class */
  class?: string
  /** Inline styles */
  style?: JSX.CSSProperties
}

export const Stack = (props: StackProps) => {
  const [local, variants] = splitProps(props, ['children', 'class', 'style'])

  return (
    <div
      class={`${stack({
        direction: variants.direction,
        gap: variants.gap,
        align: variants.align,
        justify: variants.justify,
        wrap: variants.wrap,
      })} ${local.class ?? ''}`}
      style={local.style}
    >
      {local.children}
    </div>
  )
}

/** Convenience component for horizontal stacks */
export const HStack = (props: Omit<StackProps, 'direction'>) => {
  return <Stack {...props} direction="horizontal" />
}

/** Convenience component for vertical stacks */
export const VStack = (props: Omit<StackProps, 'direction'>) => {
  return <Stack {...props} direction="vertical" />
}
