import { type RecipeVariants, recipe } from '@vanilla-extract/recipes'
import { tokens } from '../../theme/tokens.css'

export const container = recipe({
  base: {
    width: '100%',
    marginLeft: 'auto',
    marginRight: 'auto',
  },

  variants: {
    size: {
      sm: { maxWidth: '640px' },
      md: { maxWidth: '768px' },
      lg: { maxWidth: '1024px' },
      xl: { maxWidth: '1280px' },
      '2xl': { maxWidth: '1536px' },
      full: { maxWidth: '100%' },
    },

    padding: {
      none: { paddingLeft: 0, paddingRight: 0 },
      sm: { paddingLeft: tokens.space['4'], paddingRight: tokens.space['4'] },
      md: { paddingLeft: tokens.space['6'], paddingRight: tokens.space['6'] },
      lg: { paddingLeft: tokens.space['8'], paddingRight: tokens.space['8'] },
    },

    center: {
      true: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      },
      false: {},
    },
  },

  defaultVariants: {
    size: 'lg',
    padding: 'md',
    center: false,
  },
})

export type ContainerVariants = RecipeVariants<typeof container>
