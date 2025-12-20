import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const container = style({
  margin: '0.5rem 0',
})

export const sectionLabel = style({
  fontSize: '0.875rem',
  color: tokens.color.text.secondary,
  fontWeight: 500,
  marginBottom: '0.5rem',
})

export const functionCode = style({
  fontFamily: 'monospace',
  fontSize: '0.8125rem',
  color: tokens.color.accent.primary,
  background: tokens.color.bg.base,
  padding: '0.25rem 0.5rem',
  borderRadius: '3px',
  display: 'inline-block',
})

export const usageNote = style({
  marginTop: '1rem',
  paddingTop: '0.75rem',
  borderTop: `1px solid ${tokens.color.border.default}`,
  fontSize: '0.75rem',
  color: tokens.color.text.muted,
})

export const usageCode = style({
  fontFamily: 'monospace',
  background: tokens.color.bg.base,
  padding: '0.125rem 0.25rem',
  borderRadius: '2px',
  color: tokens.color.text.secondary,
})

export const emptyMessage = style({
  color: tokens.color.text.muted,
  fontSize: '0.875rem',
  textAlign: 'center',
})
