import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const container = style({
  display: 'flex',
  gap: tokens.space['4'],
  alignItems: 'center',
  justifyContent: 'center',
  opacity: 0,
  transition: `opacity ${tokens.duration.fast} ${tokens.easing.default}`,

  ':hover': {
    opacity: 1,
  },

  // Always visible on mobile - touch devices need visible targets
  '@media': {
    '(max-width: 768px)': {
      opacity: 1,
    },
  },
})
