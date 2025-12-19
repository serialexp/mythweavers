import { style } from '@vanilla-extract/css'
import { type RecipeVariants, recipe } from '@vanilla-extract/recipes'
import { tokens } from '../../theme/tokens.css'

export const container = style({
  display: 'flex',
  flexDirection: 'column',
})

export const tabList = recipe({
  base: {
    display: 'flex',
    gap: tokens.space['1'],
    borderBottom: `${tokens.borderWidth.default} solid ${tokens.color.border.subtle}`,
    overflowX: 'auto',
    flexShrink: 0,
    // Hide scrollbar but keep functionality
    scrollbarWidth: 'none',
    '::-webkit-scrollbar': {
      display: 'none',
    },
  },

  variants: {
    variant: {
      underline: {},
      pills: {
        borderBottom: 'none',
        gap: tokens.space['2'],
      },
    },
  },

  defaultVariants: {
    variant: 'underline',
  },
})

export type TabListVariants = RecipeVariants<typeof tabList>

export const tab = recipe({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space['1'],
    padding: `${tokens.space['1']} 0`,
    fontSize: tokens.font.size.xs,
    fontWeight: tokens.font.weight.medium,
    color: tokens.color.text.secondary,
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,
    position: 'relative',
    flex: 1,
    textAlign: 'center',

    ':hover': {
      color: tokens.color.text.primary,
    },

    ':focus-visible': {
      outline: `2px solid ${tokens.color.border.focus}`,
      outlineOffset: '-2px',
    },

    ':disabled': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  },

  variants: {
    variant: {
      underline: {
        marginBottom: '-1px',
        borderBottom: '2px solid transparent',

        selectors: {
          '&[data-selected="true"]': {
            color: tokens.color.accent.primary,
            borderBottomColor: tokens.color.accent.primary,
          },
        },
      },
      pills: {
        borderRadius: tokens.radius.default,

        selectors: {
          '&[data-selected="true"]': {
            color: tokens.color.text.inverse,
            backgroundColor: tokens.color.accent.primary,
          },
          '&:hover:not([data-selected="true"]):not(:disabled)': {
            backgroundColor: tokens.color.surface.hover,
          },
        },
      },
    },
  },

  defaultVariants: {
    variant: 'underline',
  },
})

export type TabVariants = RecipeVariants<typeof tab>

export const tabPanel = style({
  padding: `${tokens.space['4']} 0`,
})
