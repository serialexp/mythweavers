import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const container = style({
  padding: `${tokens.space['2']} ${tokens.space['4']}`,
  background: tokens.color.bg.raised,
  borderBottom: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: tokens.space['2'],
  position: 'relative',
  transition: `all ${tokens.duration.slow} ${tokens.easing.default}`,
  overflow: 'hidden',
})

export const cachedNote = style({
  opacity: 0.7,
  fontStyle: 'italic',
})
