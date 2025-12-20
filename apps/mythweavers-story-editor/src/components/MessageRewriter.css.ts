import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const label = style({
  display: 'block',
  marginBottom: '0.25rem',
  color: tokens.color.text.secondary,
  fontSize: '0.9rem',
})

export const selectionInfo = style({
  color: tokens.color.text.secondary,
  fontSize: '0.9rem',
})

export const messageListContainer = style({
  maxHeight: '300px',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
})

export const messageCardSelected = style({
  cursor: 'pointer',
  border: `2px solid ${tokens.color.accent.primary}`,
  background: tokens.color.surface.selected,
})

export const messageCardUnselected = style({
  cursor: 'pointer',
  border: `1px solid ${tokens.color.border.default}`,
  background: tokens.color.bg.base,
})

export const messageContent = style({
  color: tokens.color.text.primary,
  fontSize: '0.9rem',
  lineHeight: 1.4,
})

export const footer = style({
  display: 'flex',
  gap: '0.5rem',
  justifyContent: 'flex-end',
  padding: '1rem',
  borderTop: `1px solid ${tokens.color.border.default}`,
})
