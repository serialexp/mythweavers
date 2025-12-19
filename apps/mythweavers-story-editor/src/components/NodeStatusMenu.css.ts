import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const container = style({
  position: 'relative',
  width: '100%',
})

export const triggerButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  background: 'transparent',
  border: 'none',
  padding: tokens.space['2'],
  cursor: 'pointer',
  color: tokens.color.text.primary,
  borderRadius: tokens.radius.default,
  transition: `background ${tokens.duration.fast} ${tokens.easing.default}`,

  ':hover': {
    background: tokens.color.surface.hover,
  },
})

export const triggerContent = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
})

export const triggerButtonOpen = style({
  background: tokens.color.surface.hover,
})

export const chevron = style({
  transition: `transform ${tokens.duration.normal} ${tokens.easing.default}`,
})

export const chevronOpen = style({
  transform: 'rotate(90deg)',
})

export const dropdown = style({
  position: 'static',
  width: '100%',
  marginTop: tokens.space['2'],
  backgroundColor: tokens.color.bg.raised,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.default,
  padding: tokens.space['1'],
  zIndex: 1001,
})

export const optionButton = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  width: '100%',
  justifyContent: 'flex-start',
  background: 'transparent',
  border: 'none',
  padding: tokens.space['2'],
  cursor: 'pointer',
  borderRadius: tokens.radius.default,
  color: tokens.color.text.primary,
  transition: `background ${tokens.duration.fast} ${tokens.easing.default}`,

  ':hover': {
    background: tokens.color.surface.hover,
  },
})

export const optionButtonSelected = style({
  background: tokens.color.surface.selected,
})

export const statusIndicator = style({
  width: '10px',
  height: '10px',
  borderRadius: tokens.radius.full,
  flexShrink: 0,
})

export const statusIndicatorEmpty = style({
  backgroundColor: 'transparent',
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
})
