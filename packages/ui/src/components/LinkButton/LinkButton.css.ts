import { type RecipeVariants, recipe } from '@vanilla-extract/recipes'
import { tokens } from '../../theme/tokens.css'

// LinkButton shares the same visual styles as Button but is an anchor element
export const linkButton = recipe({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space['2'],
    fontFamily: tokens.font.family.sans,
    fontWeight: tokens.font.weight.medium,
    lineHeight: tokens.font.lineHeight.tight,
    borderRadius: tokens.radius.default,
    border: 'none',
    cursor: 'pointer',
    transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,
    userSelect: 'none',
    textDecoration: 'none',
  },

  variants: {
    variant: {
      primary: {
        backgroundColor: tokens.color.accent.primary,
        color: tokens.color.text.inverse,
        ':hover': { backgroundColor: tokens.color.accent.primaryHover },
        ':active': { backgroundColor: tokens.color.accent.primaryActive },
      },
      secondary: {
        backgroundColor: tokens.color.surface.default,
        color: tokens.color.text.primary,
        border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
        ':hover': {
          backgroundColor: tokens.color.surface.hover,
          borderColor: tokens.color.border.strong,
        },
        ':active': { backgroundColor: tokens.color.surface.active },
      },
      ghost: {
        backgroundColor: 'transparent',
        color: tokens.color.text.primary,
        ':hover': { backgroundColor: tokens.color.surface.hover },
        ':active': { backgroundColor: tokens.color.surface.active },
      },
      danger: {
        backgroundColor: tokens.color.semantic.error,
        color: tokens.color.text.inverse,
        ':hover': { filter: 'brightness(1.1)' },
        ':active': { filter: 'brightness(0.95)' },
      },
    },

    size: {
      sm: {
        height: '32px',
        paddingLeft: tokens.space['3'],
        paddingRight: tokens.space['3'],
        fontSize: tokens.font.size.sm,
      },
      md: {
        height: '40px',
        paddingLeft: tokens.space['4'],
        paddingRight: tokens.space['4'],
        fontSize: tokens.font.size.base,
      },
      lg: {
        height: '48px',
        paddingLeft: tokens.space['6'],
        paddingRight: tokens.space['6'],
        fontSize: tokens.font.size.lg,
      },
    },

    fullWidth: {
      true: {
        width: '100%',
      },
    },
  },

  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
})

export type LinkButtonVariants = RecipeVariants<typeof linkButton>
