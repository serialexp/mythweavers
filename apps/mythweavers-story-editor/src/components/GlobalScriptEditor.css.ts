import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const sectionTitle = style({
  margin: 0,
  fontSize: '1.1rem',
  color: tokens.color.text.primary,
})

export const description = style({
  margin: 0,
  fontSize: '0.9rem',
  color: tokens.color.text.secondary,
})

export const headerRow = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '0.5rem',
})
