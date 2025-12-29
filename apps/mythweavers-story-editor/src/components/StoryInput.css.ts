import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const container = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['2.5'],
  padding: tokens.space['5'],
  background: tokens.color.bg.raised,
  borderTop: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
})

export const inputWithClear = style({
  position: 'relative',
  display: 'flex',
  alignItems: 'flex-start',
  gap: tokens.space['2.5'],
})

export const inputActions = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['1.5'],
})

export const buttons = style({
  display: 'flex',
  gap: tokens.space['2.5'],
  justifyContent: 'flex-end',
  flexWrap: 'wrap',
  alignItems: 'center',
})

export const paragraphSelector = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['1.5'],
})

export const thinkingSelector = style({
  marginRight: 'auto',
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['1.5'],
})

export const paragraphLabel = style({
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
})
