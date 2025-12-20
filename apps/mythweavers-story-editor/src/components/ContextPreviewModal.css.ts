import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const messageTitle = style({
  margin: 0,
  color: tokens.color.text.primary,
  fontSize: '16px',
})

export const codeBlock = style({
  background: tokens.color.bg.base,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: '5px',
  padding: '15px',
  whiteSpace: 'pre-wrap',
  wordWrap: 'break-word',
  fontFamily: "'Courier New', monospace",
  fontSize: '13px',
  lineHeight: 1.5,
  color: tokens.color.text.secondary,
  maxHeight: '300px',
  overflowY: 'auto',
  margin: 0,
})
