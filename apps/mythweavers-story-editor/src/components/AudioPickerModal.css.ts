import { tokens } from '@mythweavers/ui/tokens'
import { style } from '@vanilla-extract/css'

export const body = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['3'],
  minHeight: 0,
})

export const help = style({
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.muted,
  margin: 0,
})

export const footer = style({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: tokens.space['2'],
})
