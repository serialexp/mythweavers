import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const description = style({
  margin: '0 0 1rem 0',
  fontSize: '0.9rem',
  color: tokens.color.text.secondary,
})

export const previewHeader = style({
  margin: '0 0 0.5rem 0',
  fontSize: '0.9rem',
  color: tokens.color.text.secondary,
})

export const previewContent = style({
  margin: 0,
  fontFamily: "'Monaco', 'Consolas', monospace",
  fontSize: '0.8rem',
  color: tokens.color.text.primary,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
})

export const footer = style({
  display: 'flex',
  gap: '0.5rem',
  justifyContent: 'flex-end',
  padding: '1rem 1.5rem',
  borderTop: `1px solid ${tokens.color.border.default}`,
})
