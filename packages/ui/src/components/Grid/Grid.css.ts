import { type RecipeVariants, recipe } from '@vanilla-extract/recipes'
import { tokens } from '../../theme/tokens.css'

export const grid = recipe({
  base: {
    display: 'grid',
  },

  variants: {
    cols: {
      1: { gridTemplateColumns: 'repeat(1, minmax(0, 1fr))' },
      2: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
      3: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' },
      4: { gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' },
      5: { gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' },
      6: { gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' },
      12: { gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' },
      auto: { gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' },
    },

    rows: {
      1: { gridTemplateRows: 'repeat(1, minmax(0, 1fr))' },
      2: { gridTemplateRows: 'repeat(2, minmax(0, 1fr))' },
      3: { gridTemplateRows: 'repeat(3, minmax(0, 1fr))' },
      4: { gridTemplateRows: 'repeat(4, minmax(0, 1fr))' },
      5: { gridTemplateRows: 'repeat(5, minmax(0, 1fr))' },
      6: { gridTemplateRows: 'repeat(6, minmax(0, 1fr))' },
      auto: { gridAutoRows: 'minmax(0, 1fr)' },
    },

    gap: {
      none: { gap: 0 },
      xs: { gap: tokens.space['1'] },
      sm: { gap: tokens.space['2'] },
      md: { gap: tokens.space['4'] },
      lg: { gap: tokens.space['6'] },
      xl: { gap: tokens.space['8'] },
      '2xl': { gap: tokens.space['12'] },
    },

    align: {
      start: { alignItems: 'start' },
      center: { alignItems: 'center' },
      end: { alignItems: 'end' },
      stretch: { alignItems: 'stretch' },
    },

    justify: {
      start: { justifyItems: 'start' },
      center: { justifyItems: 'center' },
      end: { justifyItems: 'end' },
      stretch: { justifyItems: 'stretch' },
    },

    flow: {
      row: { gridAutoFlow: 'row' },
      col: { gridAutoFlow: 'column' },
      dense: { gridAutoFlow: 'dense' },
      rowDense: { gridAutoFlow: 'row dense' },
      colDense: { gridAutoFlow: 'column dense' },
    },
  },

  defaultVariants: {
    cols: 1,
    gap: 'md',
    align: 'stretch',
    justify: 'stretch',
    flow: 'row',
  },
})

export type GridVariants = RecipeVariants<typeof grid>

// Grid item styles for spanning
export const gridItem = recipe({
  base: {},

  variants: {
    colSpan: {
      1: { gridColumn: 'span 1 / span 1' },
      2: { gridColumn: 'span 2 / span 2' },
      3: { gridColumn: 'span 3 / span 3' },
      4: { gridColumn: 'span 4 / span 4' },
      5: { gridColumn: 'span 5 / span 5' },
      6: { gridColumn: 'span 6 / span 6' },
      full: { gridColumn: '1 / -1' },
    },

    rowSpan: {
      1: { gridRow: 'span 1 / span 1' },
      2: { gridRow: 'span 2 / span 2' },
      3: { gridRow: 'span 3 / span 3' },
      4: { gridRow: 'span 4 / span 4' },
      5: { gridRow: 'span 5 / span 5' },
      6: { gridRow: 'span 6 / span 6' },
      full: { gridRow: '1 / -1' },
    },
  },
})

export type GridItemVariants = RecipeVariants<typeof gridItem>
