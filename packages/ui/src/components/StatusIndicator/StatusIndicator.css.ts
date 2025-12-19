import { keyframes } from '@vanilla-extract/css'
import { type RecipeVariants, recipe } from '@vanilla-extract/recipes'
import { tokens } from '../../theme/tokens.css'

const spin = keyframes({
  '0%': { transform: 'rotate(0deg)' },
  '100%': { transform: 'rotate(360deg)' },
})

export const indicator = recipe({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'help',
    borderRadius: tokens.radius.default,
    transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,
  },

  variants: {
    size: {
      sm: {
        width: '24px',
        height: '24px',
        fontSize: tokens.font.size.sm,
      },
      md: {
        width: '32px',
        height: '32px',
        fontSize: tokens.font.size.base,
      },
      lg: {
        width: '40px',
        height: '40px',
        fontSize: tokens.font.size.lg,
      },
    },

    status: {
      idle: {},
      loading: {},
      success: {},
      warning: {},
      error: {},
    },
  },

  defaultVariants: {
    size: 'md',
    status: 'idle',
  },
})

export type StatusIndicatorVariants = RecipeVariants<typeof indicator>

export const icon = recipe({
  base: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  variants: {
    status: {
      idle: {
        color: tokens.color.text.secondary,
      },
      loading: {
        color: tokens.color.text.secondary,
        animation: `${spin} 1s linear infinite`,
      },
      success: {
        color: tokens.color.semantic.success,
      },
      warning: {
        color: tokens.color.semantic.warning,
      },
      error: {
        color: tokens.color.semantic.error,
      },
    },
  },

  defaultVariants: {
    status: 'idle',
  },
})
