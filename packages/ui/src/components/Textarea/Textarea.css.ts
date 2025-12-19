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
  resize: 'vertical',

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
    resize: 'none',
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

export const textarea = recipe({
  base,

  variants: {
    size: {
      sm: {
        padding: tokens.space['2'],
        fontSize: tokens.font.size.sm,
        minHeight: '64px',
      },
      md: {
        padding: tokens.space['3'],
        fontSize: tokens.font.size.base,
        minHeight: '96px',
      },
      lg: {
        padding: tokens.space['4'],
        fontSize: tokens.font.size.lg,
        minHeight: '128px',
      },
    },

    resize: {
      none: { resize: 'none' },
      vertical: { resize: 'vertical' },
      horizontal: { resize: 'horizontal' },
      both: { resize: 'both' },
    },
  },

  defaultVariants: {
    size: 'md',
    resize: 'vertical',
  },
})

export type TextareaVariants = RecipeVariants<typeof textarea>
