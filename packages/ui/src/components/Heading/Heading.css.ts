import { recipe } from '@vanilla-extract/recipes'
import { tokens } from '../../theme/tokens.css'

export const heading = recipe({
  base: {
    margin: 0,
    fontFamily: tokens.font.family.sans,
    fontWeight: tokens.font.weight.bold,
    color: tokens.color.text.primary,
    lineHeight: tokens.font.lineHeight.tight,
  },

  variants: {
    size: {
      xs: { fontSize: tokens.font.size.xs },
      sm: { fontSize: tokens.font.size.sm },
      base: { fontSize: tokens.font.size.base },
      lg: { fontSize: tokens.font.size.lg },
      xl: { fontSize: tokens.font.size.xl },
      '2xl': { fontSize: tokens.font.size['2xl'] },
      '3xl': { fontSize: tokens.font.size['3xl'] },
      '4xl': { fontSize: tokens.font.size['4xl'] },
    },
    weight: {
      normal: { fontWeight: tokens.font.weight.normal },
      medium: { fontWeight: tokens.font.weight.medium },
      semibold: { fontWeight: tokens.font.weight.semibold },
      bold: { fontWeight: tokens.font.weight.bold },
    },
    color: {
      primary: { color: tokens.color.text.primary },
      secondary: { color: tokens.color.text.secondary },
      muted: { color: tokens.color.text.muted },
      accent: { color: tokens.color.accent.primary },
    },
    align: {
      left: { textAlign: 'left' },
      center: { textAlign: 'center' },
      right: { textAlign: 'right' },
    },
  },

  defaultVariants: {
    size: '2xl',
    weight: 'bold',
    color: 'primary',
    align: 'left',
  },
})
