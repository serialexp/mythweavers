import { style } from '@vanilla-extract/css'
import { type RecipeVariants, recipe } from '@vanilla-extract/recipes'
import { tokens } from '../../theme/tokens.css'

export const alert = recipe({
  base: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: tokens.space['3'],
    padding: tokens.space['4'],
    borderRadius: tokens.radius.lg,
    fontFamily: tokens.font.family.sans,
    fontSize: tokens.font.size.sm,
    lineHeight: tokens.font.lineHeight.normal,
  },

  variants: {
    variant: {
      info: {
        backgroundColor: tokens.color.semantic.infoSubtle,
        color: tokens.color.text.primary,
        border: `${tokens.borderWidth.default} solid ${tokens.color.semantic.info}`,
      },
      success: {
        backgroundColor: tokens.color.semantic.successSubtle,
        color: tokens.color.text.primary,
        border: `${tokens.borderWidth.default} solid ${tokens.color.semantic.success}`,
      },
      warning: {
        backgroundColor: tokens.color.semantic.warningSubtle,
        color: tokens.color.text.primary,
        border: `${tokens.borderWidth.default} solid ${tokens.color.semantic.warning}`,
      },
      error: {
        backgroundColor: tokens.color.semantic.errorSubtle,
        color: tokens.color.text.primary,
        border: `${tokens.borderWidth.default} solid ${tokens.color.semantic.error}`,
      },
    },
  },

  defaultVariants: {
    variant: 'info',
  },
})

export const alertIcon = style({
  flexShrink: 0,
  width: '20px',
  height: '20px',
})

export const alertContent = style({
  flex: 1,
  minWidth: 0,
})

export const alertTitle = style({
  fontWeight: tokens.font.weight.semibold,
  marginBottom: tokens.space['1'],
})

export const alertDescription = style({
  color: tokens.color.text.secondary,
})

export const alertDismiss = style({
  flexShrink: 0,
  padding: tokens.space['1'],
  marginLeft: 'auto',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  opacity: 0.7,
  transition: `opacity ${tokens.duration.fast} ${tokens.easing.default}`,

  ':hover': {
    opacity: 1,
  },
})

export type AlertVariants = RecipeVariants<typeof alert>
