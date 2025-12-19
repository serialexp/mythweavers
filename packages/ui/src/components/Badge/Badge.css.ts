import { type RecipeVariants, recipe } from '@vanilla-extract/recipes'
import { tokens } from '../../theme/tokens.css'

export const badge = recipe({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: tokens.space['1'],
    fontFamily: tokens.font.family.sans,
    fontWeight: tokens.font.weight.medium,
    lineHeight: 1,
    borderRadius: tokens.radius.full,
    whiteSpace: 'nowrap',
  },

  variants: {
    variant: {
      default: {
        backgroundColor: tokens.color.surface.default,
        color: tokens.color.text.primary,
        border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
      },
      primary: {
        backgroundColor: tokens.color.accent.primary,
        color: tokens.color.text.inverse,
      },
      secondary: {
        backgroundColor: tokens.color.surface.hover,
        color: tokens.color.text.secondary,
      },
      success: {
        backgroundColor: tokens.color.semantic.successSubtle,
        color: tokens.color.semantic.success,
      },
      warning: {
        backgroundColor: tokens.color.semantic.warningSubtle,
        color: tokens.color.semantic.warning,
      },
      error: {
        backgroundColor: tokens.color.semantic.errorSubtle,
        color: tokens.color.semantic.error,
      },
      info: {
        backgroundColor: tokens.color.semantic.infoSubtle,
        color: tokens.color.semantic.info,
      },
    },

    size: {
      sm: {
        padding: `${tokens.space['0.5']} ${tokens.space['2']}`,
        fontSize: tokens.font.size.xs,
      },
      md: {
        padding: `${tokens.space['1']} ${tokens.space['2.5']}`,
        fontSize: tokens.font.size.sm,
      },
      lg: {
        padding: `${tokens.space['1.5']} ${tokens.space['3']}`,
        fontSize: tokens.font.size.base,
      },
    },
  },

  defaultVariants: {
    variant: 'default',
    size: 'md',
  },
})

export type BadgeVariants = RecipeVariants<typeof badge>
