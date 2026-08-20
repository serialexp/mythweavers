import { tokens } from '@mythweavers/ui/tokens'
import { style } from '@vanilla-extract/css'

export const scopeToggle = style({
  display: 'flex',
  gap: 0,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  overflow: 'hidden',
  marginBottom: tokens.space['2'],
})

export const scopeButton = style({
  flex: 1,
  padding: `${tokens.space['1']} ${tokens.space['3']}`,
  border: 'none',
  backgroundColor: 'transparent',
  color: tokens.color.text.secondary,
  fontSize: '0.8rem',
  fontWeight: 500,
  cursor: 'pointer',
  transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,

  ':hover': {
    backgroundColor: tokens.color.surface.hover,
  },
})

export const scopeButtonActive = style({
  backgroundColor: tokens.color.accent.primary,
  color: tokens.color.text.inverse,

  ':hover': {
    backgroundColor: tokens.color.accent.primary,
    opacity: 0.9,
  },
})

export const scopeHint = style({
  fontSize: '0.75rem',
  color: tokens.color.text.muted,
  margin: 0,
  marginBottom: tokens.space['2'],
  lineHeight: 1.4,
})

export const inheritHint = style({
  fontSize: '0.7rem',
  color: tokens.color.text.muted,
  fontStyle: 'italic',
})

export const localProviderStatus = style({
  fontSize: '0.7rem',
  color: tokens.color.text.muted,
})

export const refreshProvidersButton = style({
  border: 'none',
  background: 'none',
  color: tokens.color.accent.primary,
  font: 'inherit',
  cursor: 'pointer',
  padding: 0,
  textDecoration: 'underline',
})

export const clearOverrideButton = style({
  border: 'none',
  background: 'none',
  color: tokens.color.accent.primary,
  fontSize: '0.7rem',
  cursor: 'pointer',
  padding: 0,
  marginLeft: tokens.space['1'],
  textDecoration: 'underline',

  ':hover': {
    opacity: 0.8,
  },
})
