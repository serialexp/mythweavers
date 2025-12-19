import { style } from '@vanilla-extract/css'
import { type RecipeVariants, recipe } from '@vanilla-extract/recipes'
import { tokens } from '../../theme/tokens.css'

const base = style({
  width: '100%',
  fontFamily: tokens.font.family.sans,
  fontSize: tokens.font.size.base,
  lineHeight: tokens.font.lineHeight.normal,
  color: tokens.color.text.primary,
  backgroundColor: tokens.color.surface.default,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.default,
  transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,

  '::placeholder': {
    color: tokens.color.text.muted,
  },

  ':focus': {
    outline: 'none',
    borderColor: tokens.color.border.focus,
    boxShadow: `0 0 0 3px ${tokens.color.accent.primary}20`,
  },

  ':disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
    backgroundColor: tokens.color.bg.raised,
  },

  selectors: {
    '&[aria-invalid="true"]': {
      borderColor: tokens.color.semantic.error,
    },
    '&[aria-invalid="true"]:focus': {
      boxShadow: `0 0 0 3px ${tokens.color.semantic.error}20`,
    },
  },
})

export const input = recipe({
  base,

  variants: {
    size: {
      sm: {
        height: '32px',
        paddingLeft: tokens.space['2'],
        paddingRight: tokens.space['2'],
        fontSize: tokens.font.size.sm,
      },
      md: {
        height: '40px',
        paddingLeft: tokens.space['3'],
        paddingRight: tokens.space['3'],
        fontSize: tokens.font.size.base,
      },
      lg: {
        height: '48px',
        paddingLeft: tokens.space['4'],
        paddingRight: tokens.space['4'],
        fontSize: tokens.font.size.lg,
      },
    },
  },

  defaultVariants: {
    size: 'md',
  },
})

export type InputVariants = RecipeVariants<typeof input>
