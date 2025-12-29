import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const backdrop = style({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.5)',
  zIndex: 250,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'flex-start',
})

export const panel = style({
  background: tokens.color.bg.base,
  position: 'fixed',
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '2px 0 10px rgba(0, 0, 0, 0.2)',
  overflow: 'hidden',
})

export const header = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: tokens.space['3'],
  background: tokens.color.bg.raised,
  borderBottom: `1px solid ${tokens.color.border.default}`,
  flexShrink: 0,
})

export const title = style({
  fontSize: '18px',
  fontWeight: 600,
  color: tokens.color.text.primary,
  margin: 0,
})

export const headerActions = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
})

export const content = style({
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
})
