import { style } from '@vanilla-extract/css'
import { type RecipeVariants, recipe } from '@vanilla-extract/recipes'
import { tokens } from '../../theme/tokens.css'

export const navBar = recipe({
  base: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    fontFamily: tokens.font.family.sans,
  },

  variants: {
    variant: {
      default: {
        backgroundColor: tokens.color.bg.raised,
        borderBottom: `${tokens.borderWidth.default} solid ${tokens.color.border.subtle}`,
      },
      transparent: {
        backgroundColor: 'transparent',
      },
      elevated: {
        backgroundColor: tokens.color.bg.raised,
        boxShadow: tokens.shadow.md,
      },
    },

    position: {
      static: {
        position: 'static',
      },
      sticky: {
        position: 'sticky',
        top: 0,
        zIndex: tokens.zIndex.sticky,
      },
      fixed: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: tokens.zIndex.sticky,
      },
    },

    size: {
      sm: {
        height: '48px',
        padding: `0 ${tokens.space['4']}`,
      },
      md: {
        height: '56px',
        padding: `0 ${tokens.space['6']}`,
      },
      lg: {
        height: '64px',
        padding: `0 ${tokens.space['8']}`,
      },
    },
  },

  defaultVariants: {
    variant: 'default',
    position: 'static',
    size: 'md',
  },
})

export const navBarContainer = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  maxWidth: '1280px',
  margin: '0 auto',
  height: '100%',
})

export const navBarBrand = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  fontSize: tokens.font.size.xl,
  fontWeight: tokens.font.weight.bold,
  color: tokens.color.text.primary,
  textDecoration: 'none',
  flexShrink: 0,
  marginRight: tokens.space['6'],
})

export const navBarNav = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['1'],
  listStyle: 'none',
  margin: 0,
  padding: 0,
})

export const navBarActions = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  marginLeft: 'auto',
})

export const navLink = recipe({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: `${tokens.space['2']} ${tokens.space['3']}`,
    fontSize: tokens.font.size.sm,
    fontWeight: tokens.font.weight.medium,
    color: tokens.color.text.secondary,
    textDecoration: 'none',
    borderRadius: tokens.radius.default,
    transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,

    ':hover': {
      color: tokens.color.text.primary,
      backgroundColor: tokens.color.surface.hover,
      textDecoration: 'none',
    },
  },

  variants: {
    active: {
      true: {
        color: tokens.color.accent.primary,
        backgroundColor: tokens.color.surface.selected,
      },
    },
  },
})

export type NavBarVariants = RecipeVariants<typeof navBar>
export type NavLinkVariants = RecipeVariants<typeof navLink>
