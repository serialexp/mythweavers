import { type RecipeVariants, recipe } from '@vanilla-extract/recipes'
import { tokens } from '../../theme/tokens.css'

export const stack = recipe({
  base: {
    display: 'flex',
  },

  variants: {
    direction: {
      vertical: {
        flexDirection: 'column',
      },
      horizontal: {
        flexDirection: 'row',
      },
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
      start: { alignItems: 'flex-start' },
      center: { alignItems: 'center' },
      end: { alignItems: 'flex-end' },
      stretch: { alignItems: 'stretch' },
      baseline: { alignItems: 'baseline' },
    },

    justify: {
      start: { justifyContent: 'flex-start' },
      center: { justifyContent: 'center' },
      end: { justifyContent: 'flex-end' },
      between: { justifyContent: 'space-between' },
      around: { justifyContent: 'space-around' },
      evenly: { justifyContent: 'space-evenly' },
    },

    wrap: {
      true: { flexWrap: 'wrap' },
      false: { flexWrap: 'nowrap' },
    },
  },

  defaultVariants: {
    direction: 'vertical',
    gap: 'md',
    align: 'stretch',
    justify: 'start',
    wrap: false,
  },
})

export type StackVariants = RecipeVariants<typeof stack>
