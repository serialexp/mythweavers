import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const section = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['4'],
})

export const settingRow = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['1'],
})

export const label = style({
  fontSize: '0.75rem',
  fontWeight: 600,
  color: tokens.color.text.secondary,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
})

export const inputRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
})

export const input = style({
  flex: 1,
  padding: tokens.space['2'],
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  backgroundColor: tokens.color.bg.base,
  color: tokens.color.text.primary,
  fontSize: '0.875rem',

  ':focus': {
    outline: 'none',
    borderColor: tokens.color.border.focus,
  },

  '::placeholder': {
    color: tokens.color.text.muted,
  },
})

export const select = style({
  width: '100%',
  padding: tokens.space['2'],
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  backgroundColor: tokens.color.bg.base,
  color: tokens.color.text.primary,
  fontSize: '0.875rem',
  cursor: 'pointer',

  ':focus': {
    outline: 'none',
    borderColor: tokens.color.border.focus,
  },
})

export const showKeyButton = style({
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  backgroundColor: tokens.color.bg.base,
  color: tokens.color.text.secondary,
  fontSize: '0.75rem',
  cursor: 'pointer',
  transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,

  ':hover': {
    backgroundColor: tokens.color.surface.hover,
  },
})

export const infoText = style({
  fontSize: '0.875rem',
  color: tokens.color.text.secondary,
})

// --- API key tabs ---

export const keyTabs = style({
  display: 'flex',
  gap: tokens.space['1'],
  flexWrap: 'wrap',
})

export const keyTab = style({
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  backgroundColor: tokens.color.bg.base,
  color: tokens.color.text.secondary,
  fontSize: '0.75rem',
  fontWeight: 500,
  cursor: 'pointer',
  transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,
  userSelect: 'none',

  ':hover': {
    backgroundColor: tokens.color.surface.hover,
    color: tokens.color.text.primary,
  },
})

export const keyTabActive = style({
  backgroundColor: tokens.color.surface.hover,
  color: tokens.color.text.primary,
  borderColor: tokens.color.border.focus,
})

export const keyTabConfigured = style({
  borderColor: tokens.color.semantic.success,
  color: tokens.color.semantic.success,
})

export const keyTabActiveConfigured = style({
  backgroundColor: `color-mix(in srgb, ${tokens.color.semantic.success} 10%, ${tokens.color.bg.base})`,
  borderColor: tokens.color.semantic.success,
  color: tokens.color.semantic.success,
})

export const keyContent = style({
  padding: tokens.space['2'],
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['2'],
})
