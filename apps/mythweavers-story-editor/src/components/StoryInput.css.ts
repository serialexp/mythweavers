import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const container = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['2.5'],
  padding: tokens.space['5'],
  background: tokens.color.bg.raised,
  borderTop: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
})

export const inputWithClear = style({
  position: 'relative',
  display: 'flex',
  alignItems: 'flex-start',
  gap: tokens.space['2.5'],
})

export const inputActions = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['1.5'],
})

export const buttons = style({
  display: 'flex',
  gap: tokens.space['2.5'],
  justifyContent: 'flex-end',
  flexWrap: 'wrap',
  alignItems: 'center',
})

export const paragraphSelector = style({
  marginRight: 'auto',
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['1.5'],
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
  background: tokens.color.bg.elevated,
  borderRadius: tokens.radius.default,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
})

export const paragraphSelectorNoMargin = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['1.5'],
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
  background: tokens.color.bg.elevated,
  borderRadius: tokens.radius.default,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
})

export const paragraphLabel = style({
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
  marginRight: tokens.space['1'],
})

export const paragraphButton = style({
  padding: `${tokens.space['1']} ${tokens.space['2.5']}`,
  background: tokens.color.bg.base,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.default,
  color: tokens.color.text.secondary,
  fontSize: tokens.font.size.sm,
  fontWeight: tokens.font.weight.medium,
  cursor: 'pointer',
  minWidth: '28px',
  transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,

  ':hover': {
    background: tokens.color.surface.hover,
  },
})

export const paragraphButtonActive = style({
  padding: `${tokens.space['1']} ${tokens.space['2.5']}`,
  background: tokens.color.accent.primary,
  border: `${tokens.borderWidth.default} solid ${tokens.color.accent.primary}`,
  borderRadius: tokens.radius.default,
  color: tokens.color.text.inverse,
  fontSize: tokens.font.size.sm,
  fontWeight: tokens.font.weight.medium,
  cursor: 'pointer',
  minWidth: '28px',

  ':hover': {
    background: tokens.color.accent.primaryHover,
  },
})
