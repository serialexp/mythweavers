import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const modalContent = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: tokens.space['4'],
})

export const cropperContainer = style({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  width: '100%',
  backgroundColor: tokens.color.bg.raised,
  borderRadius: tokens.radius.default,
  padding: tokens.space['4'],
})

export const actions = style({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: tokens.space['2'],
  width: '100%',
  paddingTop: tokens.space['2'],
  borderTop: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
})

export const instructions = style({
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.muted,
  textAlign: 'center',
})
