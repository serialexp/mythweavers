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

// Layout styles
export const headerWrapper = style({
  position: 'relative',
})

export const header = style({
  display: 'flex',
  alignItems: 'stretch',
  justifyContent: 'flex-start',
  padding: 0,
  background: tokens.color.bg.raised,
  borderBottom: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  position: 'relative',
  transition: `all ${tokens.duration.slow} ${tokens.easing.default}`,
  overflow: 'visible',
  height: '52px',
  minHeight: '52px',
})

export const headerCollapsed = style({
  height: 0,
  minHeight: 0,
  maxHeight: 0,
  padding: 0,
  borderBottom: 'none',
  opacity: 0,
  overflow: 'hidden',
})

export const config = style({
  display: 'flex',
  gap: tokens.space['2'],
  alignItems: 'center',
  flexWrap: 'wrap',
  flex: 1,
  padding: `0 ${tokens.space['4']}`,
  height: '100%',
  overflow: 'visible',
})

export const statsWrapper = style({
  transition: `all ${tokens.duration.slow} ${tokens.easing.default}`,
  overflow: 'hidden',
})

export const statsWrapperCollapsed = style({
  maxHeight: 0,
  opacity: 0,
})
