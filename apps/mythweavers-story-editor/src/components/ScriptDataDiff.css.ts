import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const header = style({
  fontWeight: 'bold',
  color: tokens.color.text.secondary,
  marginBottom: '0.5rem',
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
})

export const changesContainer = style({
  fontFamily: 'monospace',
  fontSize: '0.8rem',
})

export const changeRow = style({
  padding: '0.25rem 0',
  color: tokens.color.text.primary,
})

export const changeRowWithBorder = style([changeRow, {
  borderBottom: `1px solid ${tokens.color.border.default}`,
}])

export const bulletPoint = style({
  color: tokens.color.accent.primary,
  fontWeight: 'bold',
})
