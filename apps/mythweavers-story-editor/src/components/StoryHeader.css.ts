import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const headerToggle = style({
  position: 'fixed',
  top: '5px',
  right: '5px',
  zIndex: 240,
})

export const navigationButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: `0 ${tokens.space['4']}`,
  minWidth: '56px',
  height: '100%',
  background: tokens.color.accent.primary,
  color: tokens.color.text.inverse,
  border: 'none',
  borderRight: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  cursor: 'pointer',
  transition: `all ${tokens.duration.normal} ${tokens.easing.default}`,
  fontSize: tokens.font.size['2xl'],
  borderRadius: tokens.radius.none,

  ':hover': {
    background: tokens.color.accent.primaryHover,
  },

  ':active': {
    background: tokens.color.accent.primaryActive,
  },
})

export const navigationButtonActive = style({
  background: tokens.color.accent.primaryHover,
  boxShadow: tokens.shadow.inner,

  ':hover': {
    background: tokens.color.accent.primaryActive,
  },
})
