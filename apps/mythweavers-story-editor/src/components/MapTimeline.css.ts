import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const section = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  padding: '1rem',
  background: tokens.color.bg.raised,
  borderRadius: '4px',
  border: `1px solid ${tokens.color.border.default}`,
})

export const header = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  color: tokens.color.text.primary,
  fontSize: '0.9rem',
})

export const slider = style({
  width: '100%',
  height: '24px',
  background: tokens.color.bg.elevated,
  borderRadius: '12px',
  outline: 'none',
})
