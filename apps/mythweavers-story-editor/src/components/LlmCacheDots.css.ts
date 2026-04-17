import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const cacheDots = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '3px',
  cursor: 'pointer',
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
  borderRadius: tokens.radius.sm,
  transition: `background ${tokens.duration.fast} ${tokens.easing.default}`,
  ':hover': {
    background: tokens.color.bg.elevated,
  },
})

export const cacheDot = style({
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  transition: `transform ${tokens.duration.fast} ${tokens.easing.default}`,
  ':hover': {
    transform: 'scale(1.3)',
  },
})
