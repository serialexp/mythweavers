import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const panel = style({
  width: '250px',
  background: tokens.color.bg.base,
  borderLeft: `1px solid ${tokens.color.border.default}`,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
})

export const header = style({
  padding: '0.75rem',
  background: tokens.color.bg.raised,
  borderBottom: `1px solid ${tokens.color.border.default}`,
  fontWeight: 600,
  fontSize: '0.9rem',
  color: tokens.color.text.primary,
})

export const listContent = style({
  flex: 1,
  overflowY: 'auto',
  padding: '0.5rem',
})

export const emptyMessage = style({
  padding: '1rem',
  textAlign: 'center',
  color: tokens.color.text.secondary,
  fontSize: '0.85rem',
})

export const landmarkItem = style({
  padding: '0.5rem',
  background: tokens.color.bg.raised,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: '4px',
  cursor: 'pointer',
  transition: 'all 0.2s',
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
})

export const landmarkItemSelected = style({
  background: tokens.color.surface.selected,
  borderColor: tokens.color.accent.primary,
  color: tokens.color.accent.primary,
})

export const colorDot = style({
  width: '12px',
  height: '12px',
  borderRadius: '50%',
  flexShrink: 0,
  border: '1px solid rgba(255, 255, 255, 0.2)',
})

export const landmarkName = style({
  flex: 1,
  fontSize: '0.85rem',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
})
