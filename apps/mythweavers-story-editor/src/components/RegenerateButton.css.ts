import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const container = style({
  display: 'flex',
  position: 'relative',
})

export const mainButton = style({
  borderRadius: '5px 0 0 5px',
  borderRight: '1px solid rgba(255, 255, 255, 0.2)',
  display: 'flex',
  alignItems: 'center',
  gap: '5px',
  background: tokens.color.semantic.warning,
  color: 'white',
})

export const dropdownButton = style({
  borderRadius: '0 5px 5px 0',
  padding: '0.5rem 0.75rem',
  background: tokens.color.semantic.warning,
  color: 'white',
})

export const popover = style({
  position: 'absolute',
  bottom: 'calc(100% + 8px)',
  right: 0,
  background: tokens.color.bg.raised,
  borderRadius: '8px',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
  padding: '8px',
  minWidth: '200px',
  zIndex: 1000,
  border: `1px solid ${tokens.color.border.default}`,
})

export const optionButton = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  width: '100%',
  padding: '8px 12px',
  border: 'none',
  background: 'none',
  textAlign: 'left',
  cursor: 'pointer',
  borderRadius: '4px',
})

export const optionButtonSelected = style({
  background: tokens.color.accent.primary,
  color: 'white',
})

export const optionButtonUnselected = style({
  color: tokens.color.text.primary,
})
