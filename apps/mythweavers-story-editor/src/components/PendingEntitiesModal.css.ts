import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const sectionHeader = style({
  margin: '0 0 0.5rem 0',
  color: tokens.color.text.primary,
})

export const sectionDescription = style({
  margin: 0,
  color: tokens.color.text.secondary,
  fontSize: '0.9rem',
})

export const entityCardSelected = style({
  borderColor: tokens.color.accent.primary,
  background: tokens.color.surface.selected,
})

export const entityLabel = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  cursor: 'pointer',
})

export const entityIcon = style({
  color: tokens.color.accent.primary,
  fontSize: '1.1rem',
})

export const entityType = style({
  color: tokens.color.text.secondary,
  fontSize: '0.9rem',
  fontStyle: 'italic',
})
