import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const itemLabel = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.5rem',
  borderRadius: tokens.radius.sm,
  cursor: 'pointer',
  transition: `background ${tokens.duration.fast}`,
})

export const sectionHeader = style({
  margin: '0 0 0.5rem 0',
  color: tokens.color.text.primary,
})

export const listContainer = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  maxHeight: '200px',
  overflowY: 'auto',
})

export const itemText = style({
  color: tokens.color.text.primary,
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
})

export const emptyMessage = style({
  color: tokens.color.text.muted,
  fontStyle: 'italic',
  margin: 0,
})

export const globalNote = style({
  marginTop: '0.5rem',
  fontSize: '0.85rem',
  color: tokens.color.text.muted,
  fontStyle: 'italic',
})

export const footer = style({
  display: 'flex',
  gap: '0.5rem',
  justifyContent: 'flex-end',
  padding: '1rem',
  borderTop: `1px solid ${tokens.color.border.default}`,
})
