import { JSX, splitProps } from 'solid-js'
import { grid, gridItem } from './Grid.css'

export interface GridProps {
  /** Number of columns */
  cols?: 1 | 2 | 3 | 4 | 5 | 6 | 12 | 'auto'
  /** Number of rows */
  rows?: 1 | 2 | 3 | 4 | 5 | 6 | 'auto'
  /** Gap between items */
  gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  /** Vertical alignment */
  align?: 'start' | 'center' | 'end' | 'stretch'
  /** Horizontal alignment */
  justify?: 'start' | 'center' | 'end' | 'stretch'
  /** Grid auto flow */
  flow?: 'row' | 'col' | 'dense' | 'rowDense' | 'colDense'
  /** Grid content */
  children?: JSX.Element
  /** Additional class */
  class?: string
  /** Inline styles */
  style?: JSX.CSSProperties
}

export const Grid = (props: GridProps) => {
  const [local, variants] = splitProps(props, ['children', 'class', 'style'])

  return (
    <div
      class={`${grid({
        cols: variants.cols,
        rows: variants.rows,
        gap: variants.gap,
        align: variants.align,
        justify: variants.justify,
        flow: variants.flow,
      })} ${local.class ?? ''}`}
      style={local.style}
    >
      {local.children}
    </div>
  )
}

export interface GridItemProps {
  /** Column span */
  colSpan?: 1 | 2 | 3 | 4 | 5 | 6 | 'full'
  /** Row span */
  rowSpan?: 1 | 2 | 3 | 4 | 5 | 6 | 'full'
  /** Item content */
  children?: JSX.Element
  /** Additional class */
  class?: string
  /** Inline styles */
  style?: JSX.CSSProperties
}

/** Grid item with span control */
export const GridItem = (props: GridItemProps) => {
  const [local, variants] = splitProps(props, ['children', 'class', 'style'])

  return (
    <div
      class={`${gridItem({
        colSpan: variants.colSpan,
        rowSpan: variants.rowSpan,
      })} ${local.class ?? ''}`}
      style={local.style}
    >
      {local.children}
    </div>
  )
}
