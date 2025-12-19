import { keyframes } from '@vanilla-extract/css'
import { type RecipeVariants, recipe } from '@vanilla-extract/recipes'
import { tokens } from '../../theme/tokens.css'

const spin = keyframes({
  '0%': { transform: 'rotate(0deg)' },
  '100%': { transform: 'rotate(360deg)' },
})

export const spinner = recipe({
  base: {
    display: 'inline-block',
    borderRadius: '50%',
    borderStyle: 'solid',
    borderColor: tokens.color.border.subtle,
    borderTopColor: tokens.color.accent.primary,
    animation: `${spin} 0.8s linear infinite`,
  },

  variants: {
    size: {
      sm: {
        width: '16px',
        height: '16px',
        borderWidth: '2px',
      },
      md: {
        width: '24px',
        height: '24px',
        borderWidth: '3px',
      },
      lg: {
        width: '32px',
        height: '32px',
        borderWidth: '3px',
      },
      xl: {
        width: '48px',
        height: '48px',
        borderWidth: '4px',
      },
    },
  },

  defaultVariants: {
    size: 'md',
  },
})

export type SpinnerVariants = RecipeVariants<typeof spinner>
