import { style } from '@vanilla-extract/css'
import { type RecipeVariants, recipe } from '@vanilla-extract/recipes'
import { tokens } from '../../theme/tokens.css'

const base = style({
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: tokens.radius.full,
  border: 'none',
  cursor: 'pointer',
  transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,
  userSelect: 'none',
  flexShrink: 0,

  // Reset for icons
  padding: 0,
  lineHeight: 1,

  ':disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },

  ':focus-visible': {
    outline: `2px solid ${tokens.color.border.focus}`,
    outlineOffset: '2px',
  },

  selectors: {
    '&:hover:not(:disabled)': {
      transform: 'scale(1.1)',
    },
    '&:active:not(:disabled)': {
      transform: 'scale(0.95)',
    },
  },
})

export const iconButton = recipe({
  base,

  variants: {
    variant: {
      ghost: {
        color: tokens.color.text.secondary,
        backgroundColor: 'transparent',
        selectors: {
          '&:hover:not(:disabled)': {
            color: tokens.color.text.primary,
            backgroundColor: tokens.color.surface.hover,
          },
          '&:active:not(:disabled)': {
            backgroundColor: tokens.color.surface.active,
          },
        },
      },
      secondary: {
        color: tokens.color.text.secondary,
        backgroundColor: tokens.color.surface.default,
        border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
        selectors: {
          '&:hover:not(:disabled)': {
            color: tokens.color.text.primary,
            backgroundColor: tokens.color.surface.hover,
            borderColor: tokens.color.border.strong,
          },
          '&:active:not(:disabled)': {
            backgroundColor: tokens.color.surface.active,
          },
        },
      },
      primary: {
        color: tokens.color.text.inverse,
        backgroundColor: tokens.color.accent.primary,
        selectors: {
          '&:hover:not(:disabled)': {
            backgroundColor: tokens.color.accent.primaryHover,
          },
          '&:active:not(:disabled)': {
            backgroundColor: tokens.color.accent.primaryActive,
          },
        },
      },
      danger: {
        color: tokens.color.text.inverse,
        backgroundColor: tokens.color.semantic.error,
        selectors: {
          '&:hover:not(:disabled)': {
            filter: 'brightness(1.1)',
          },
          '&:active:not(:disabled)': {
            filter: 'brightness(0.95)',
          },
        },
      },
    },

    size: {
      sm: {
        width: '32px',
        height: '32px',
        fontSize: tokens.font.size.sm,
      },
      md: {
        width: '40px',
        height: '40px',
        fontSize: tokens.font.size.base,
      },
      lg: {
        width: '48px',
        height: '48px',
        fontSize: tokens.font.size.lg,
      },
    },

    active: {
      true: {
        color: tokens.color.text.inverse,
        backgroundColor: tokens.color.accent.primary,
        borderColor: tokens.color.accent.primary,
        selectors: {
          '&:hover:not(:disabled)': {
            backgroundColor: tokens.color.accent.primaryHover,
          },
          '&:active:not(:disabled)': {
            backgroundColor: tokens.color.accent.primaryActive,
          },
        },
      },
    },
  },

  defaultVariants: {
    variant: 'ghost',
    size: 'md',
    active: false,
  },
})

export type IconButtonVariants = RecipeVariants<typeof iconButton>
