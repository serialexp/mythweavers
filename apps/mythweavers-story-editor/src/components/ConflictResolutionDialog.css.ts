import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const description = style({
  margin: 0,
  color: tokens.color.text.secondary,
})

export const versionLabel = style({
  fontWeight: 500,
  color: tokens.color.text.secondary,
})

export const versionValue = style({
  color: tokens.color.text.primary,
  fontFamily: 'monospace',
  fontSize: '0.9rem',
})

export const warningText = style({
  margin: 0,
  color: tokens.color.semantic.warning,
  fontWeight: 500,
})
