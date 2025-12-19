import { globalStyle, style } from '@vanilla-extract/css'
import { type RecipeVariants, recipe } from '@vanilla-extract/recipes'
import { tokens } from '../../theme/tokens.css'

export const prose = recipe({
  base: {
    fontFamily: tokens.font.family.serif,
    color: tokens.color.text.primary,
    lineHeight: tokens.font.lineHeight.relaxed,
    maxWidth: '65ch',
  },

  variants: {
    size: {
      sm: {
        fontSize: tokens.font.size.sm,
      },
      md: {
        fontSize: tokens.font.size.base,
      },
      lg: {
        fontSize: tokens.font.size.lg,
      },
    },

    center: {
      true: {
        marginLeft: 'auto',
        marginRight: 'auto',
      },
    },
  },

  defaultVariants: {
    size: 'md',
  },
})

// Create a unique class for targeting children
export const proseClass = style({})

// Typography styles for child elements
globalStyle(`${proseClass} h1`, {
  fontFamily: tokens.font.family.sans,
  fontSize: tokens.font.size['3xl'],
  fontWeight: tokens.font.weight.bold,
  lineHeight: tokens.font.lineHeight.tight,
  marginTop: tokens.space['8'],
  marginBottom: tokens.space['4'],
})

globalStyle(`${proseClass} h2`, {
  fontFamily: tokens.font.family.sans,
  fontSize: tokens.font.size['2xl'],
  fontWeight: tokens.font.weight.semibold,
  lineHeight: tokens.font.lineHeight.tight,
  marginTop: tokens.space['6'],
  marginBottom: tokens.space['3'],
})

globalStyle(`${proseClass} h3`, {
  fontFamily: tokens.font.family.sans,
  fontSize: tokens.font.size.xl,
  fontWeight: tokens.font.weight.semibold,
  lineHeight: tokens.font.lineHeight.tight,
  marginTop: tokens.space['5'],
  marginBottom: tokens.space['2'],
})

globalStyle(`${proseClass} p`, {
  marginTop: 0,
  marginBottom: tokens.space['4'],
})

globalStyle(`${proseClass} a`, {
  color: tokens.color.accent.primary,
  textDecoration: 'underline',
})

globalStyle(`${proseClass} a:hover`, {
  color: tokens.color.accent.primaryHover,
})

globalStyle(`${proseClass} strong`, {
  fontWeight: tokens.font.weight.semibold,
})

globalStyle(`${proseClass} em`, {
  fontStyle: 'italic',
})

globalStyle(`${proseClass} blockquote`, {
  borderLeft: `4px solid ${tokens.color.border.default}`,
  paddingLeft: tokens.space['4'],
  marginLeft: 0,
  marginRight: 0,
  fontStyle: 'italic',
  color: tokens.color.text.secondary,
})

globalStyle(`${proseClass} ul, ${proseClass} ol`, {
  paddingLeft: tokens.space['6'],
  marginTop: tokens.space['4'],
  marginBottom: tokens.space['4'],
})

globalStyle(`${proseClass} li`, {
  marginBottom: tokens.space['2'],
})

globalStyle(`${proseClass} hr`, {
  border: 'none',
  borderTop: `1px solid ${tokens.color.border.default}`,
  marginTop: tokens.space['8'],
  marginBottom: tokens.space['8'],
})

globalStyle(`${proseClass} code`, {
  fontFamily: tokens.font.family.mono,
  fontSize: '0.875em',
  backgroundColor: tokens.color.surface.default,
  padding: `${tokens.space['0.5']} ${tokens.space['1']}`,
  borderRadius: tokens.radius.sm,
})

globalStyle(`${proseClass} pre`, {
  fontFamily: tokens.font.family.mono,
  fontSize: tokens.font.size.sm,
  backgroundColor: tokens.color.surface.default,
  padding: tokens.space['4'],
  borderRadius: tokens.radius.default,
  overflow: 'auto',
  marginTop: tokens.space['4'],
  marginBottom: tokens.space['4'],
})

globalStyle(`${proseClass} pre code`, {
  backgroundColor: 'transparent',
  padding: 0,
})

globalStyle(`${proseClass} img`, {
  maxWidth: '100%',
  height: 'auto',
  borderRadius: tokens.radius.default,
})

globalStyle(`${proseClass} > :first-child`, {
  marginTop: 0,
})

globalStyle(`${proseClass} > :last-child`, {
  marginBottom: 0,
})

export type ProseVariants = RecipeVariants<typeof prose>
