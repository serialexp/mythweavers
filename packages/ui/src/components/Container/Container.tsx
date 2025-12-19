import { JSX, splitProps } from 'solid-js'
import { container } from './Container.css'

export interface ContainerProps {
  /** Container max-width size */
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
  /** Container padding */
  padding?: 'none' | 'sm' | 'md' | 'lg'
  /** Center content */
  center?: boolean
  /** Container content */
  children?: JSX.Element
  /** Additional class */
  class?: string
  /** Inline styles */
  style?: JSX.CSSProperties
}

export const Container = (props: ContainerProps) => {
  const [local, variants] = splitProps(props, ['children', 'class', 'style'])

  return (
    <div
      class={`${container({
        size: variants.size,
        padding: variants.padding,
        center: variants.center,
      })} ${local.class ?? ''}`}
      style={local.style}
    >
      {local.children}
    </div>
  )
}
