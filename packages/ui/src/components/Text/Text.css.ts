import { recipe } from '@vanilla-extract/recipes'
import { tokens } from '../../theme/tokens.css'

export const text = recipe({
  base: {
    margin: 0,
    fontFamily: tokens.font.family.sans,
    lineHeight: tokens.font.lineHeight.normal,
  },

  variants: {
    size: {
      xs: { fontSize: tokens.font.size.xs },
      sm: { fontSize: tokens.font.size.sm },
      base: { fontSize: tokens.font.size.base },
      lg: { fontSize: tokens.font.size.lg },
      xl: { fontSize: tokens.font.size.xl },
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
      success: { color: tokens.color.semantic.success },
      warning: { color: tokens.color.semantic.warning },
      error: { color: tokens.color.semantic.error },
    },
    align: {
      left: { textAlign: 'left' },
      center: { textAlign: 'center' },
      right: { textAlign: 'right' },
    },
  },

  defaultVariants: {
    size: 'base',
    weight: 'normal',
    color: 'primary',
    align: 'left',
  },
})
