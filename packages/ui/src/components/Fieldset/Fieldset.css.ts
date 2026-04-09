import { style } from '@vanilla-extract/css'
import { tokens } from '../../theme/tokens.css'

export const fieldset = style({
  margin: 0,
  padding: `${tokens.space['3']} ${tokens.space['3']} ${tokens.space['3']}`,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['3'],
})

export const legend = style({
  fontSize: tokens.font.size.sm,
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.primary,
  padding: `0 ${tokens.space['1']}`,
})
