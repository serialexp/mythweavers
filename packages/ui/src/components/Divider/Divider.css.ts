import { type RecipeVariants, recipe } from '@vanilla-extract/recipes'
import { tokens } from '../../theme/tokens.css'

export const divider = recipe({
  base: {
    border: 'none',
    margin: 0,
    flexShrink: 0,
  },

  variants: {
    orientation: {
      horizontal: {
        width: '100%',
        height: tokens.borderWidth.thin,
        backgroundColor: tokens.color.border.default,
      },
      vertical: {
        width: tokens.borderWidth.thin,
        height: '100%',
        alignSelf: 'stretch',
        backgroundColor: tokens.color.border.default,
      },
    },

    variant: {
      solid: {},
      dashed: {
        backgroundColor: 'transparent',
      },
      dotted: {
        backgroundColor: 'transparent',
      },
    },

    spacing: {
      none: {},
      sm: {},
      md: {},
      lg: {},
    },

    color: {
      subtle: { backgroundColor: tokens.color.border.subtle },
      default: { backgroundColor: tokens.color.border.default },
      strong: { backgroundColor: tokens.color.border.strong },
    },
  },

  compoundVariants: [
    // Horizontal spacing
    {
      variants: { orientation: 'horizontal', spacing: 'sm' },
      style: { marginTop: tokens.space['2'], marginBottom: tokens.space['2'] },
    },
    {
      variants: { orientation: 'horizontal', spacing: 'md' },
      style: { marginTop: tokens.space['4'], marginBottom: tokens.space['4'] },
    },
    {
      variants: { orientation: 'horizontal', spacing: 'lg' },
      style: { marginTop: tokens.space['6'], marginBottom: tokens.space['6'] },
    },

    // Vertical spacing
    {
      variants: { orientation: 'vertical', spacing: 'sm' },
      style: { marginLeft: tokens.space['2'], marginRight: tokens.space['2'] },
    },
    {
      variants: { orientation: 'vertical', spacing: 'md' },
      style: { marginLeft: tokens.space['4'], marginRight: tokens.space['4'] },
    },
    {
      variants: { orientation: 'vertical', spacing: 'lg' },
      style: { marginLeft: tokens.space['6'], marginRight: tokens.space['6'] },
    },

    // Dashed horizontal
    {
      variants: { orientation: 'horizontal', variant: 'dashed' },
      style: {
        height: 0,
        borderTop: `${tokens.borderWidth.thin} dashed ${tokens.color.border.default}`,
      },
    },
    // Dashed vertical
    {
      variants: { orientation: 'vertical', variant: 'dashed' },
      style: {
        width: 0,
        borderLeft: `${tokens.borderWidth.thin} dashed ${tokens.color.border.default}`,
      },
    },

    // Dotted horizontal
    {
      variants: { orientation: 'horizontal', variant: 'dotted' },
      style: {
        height: 0,
        borderTop: `${tokens.borderWidth.thin} dotted ${tokens.color.border.default}`,
      },
    },
    // Dotted vertical
    {
      variants: { orientation: 'vertical', variant: 'dotted' },
      style: {
        width: 0,
        borderLeft: `${tokens.borderWidth.thin} dotted ${tokens.color.border.default}`,
      },
    },
  ],

  defaultVariants: {
    orientation: 'horizontal',
    variant: 'solid',
    spacing: 'none',
    color: 'default',
  },
})

export type DividerVariants = RecipeVariants<typeof divider>
