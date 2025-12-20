import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const container = style({
  position: 'relative',
  display: 'flex',
  gap: 0,
})

export const popover = style({
  position: 'absolute',
  bottom: '100%',
  right: 0,
  marginBottom: '8px',
  background: tokens.color.bg.raised,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: '4px',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
  minWidth: '200px',
  zIndex: 1000,
})

export const optionButton = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  width: '100%',
  padding: '10px 16px',
  border: 'none',
  borderBottom: `1px solid ${tokens.color.border.default}`,
  cursor: 'pointer',
  textAlign: 'left',
})

export const optionButtonSelected = style({
  background: tokens.color.accent.primary,
  color: 'white',
})

export const optionButtonUnselected = style({
  background: 'none',
  color: tokens.color.text.primary,
})
