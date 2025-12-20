import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const popup = style({
  position: 'absolute',
  background: tokens.color.bg.base,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.lg,
  padding: '1rem',
  minWidth: '250px',
  boxShadow: tokens.shadow.lg,
  zIndex: 1000,
})

export const title = style({
  margin: 0,
  fontSize: '1.1rem',
  color: tokens.color.text.primary,
})

export const label = style({
  display: 'block',
  marginBottom: '0.25rem',
  color: tokens.color.text.secondary,
  fontSize: '0.9rem',
})

export const hint = style({
  color: tokens.color.text.muted,
  fontSize: '0.8rem',
})

export const buttonRow = style({
  display: 'flex',
  gap: '0.5rem',
})

export const quickButtonRow = style({
  display: 'flex',
  gap: '0.25rem',
})

export const paragraph = style({
  margin: 0,
  color: tokens.color.text.secondary,
})

export const connectedList = style({
  margin: 0,
  padding: '0 0 0 1.25rem',
  color: tokens.color.text.secondary,
  fontSize: '0.9rem',
})

export const actionRow = style({
  display: 'flex',
  gap: '0.5rem',
  marginTop: '0.5rem',
})

export const alertMargin = style({
  marginTop: '0.5rem',
})
