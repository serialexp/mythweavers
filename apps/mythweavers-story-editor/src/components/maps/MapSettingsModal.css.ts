import { tokens } from '@mythweavers/ui/tokens'
import { style } from '@vanilla-extract/css'

export const modalContent = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['4'],
  maxHeight: '70vh',
  overflowY: 'auto',
})

export const formSection = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['2'],
})

export const label = style({
  fontSize: tokens.font.size.sm,
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.primary,
})

export const input = style({
  fontSize: tokens.font.size.sm,
  padding: `${tokens.space['2']} ${tokens.space['3']}`,
  borderRadius: tokens.radius.default,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  backgroundColor: tokens.color.bg.base,
  color: tokens.color.text.primary,
  outline: 'none',
  selectors: {
    '&:focus': {
      borderColor: tokens.color.accent.primary,
    },
  },
})

export const errorBox = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  padding: `${tokens.space['2']} ${tokens.space['3']}`,
  fontSize: tokens.font.size.sm,
  color: '#ef4444',
  backgroundColor: 'rgba(239, 68, 68, 0.1)',
  borderRadius: tokens.radius.default,
  border: `${tokens.borderWidth.default} solid rgba(239, 68, 68, 0.3)`,
})

export const actions = style({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: tokens.space['2'],
  paddingTop: tokens.space['2'],
  borderTop: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
})
