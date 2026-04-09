import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const list = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['2'],
})

export const emptyState = style({
  textAlign: 'center',
  padding: `${tokens.space['8']} 0`,
})

export const newButton = style({
  marginBottom: tokens.space['3'],
})
