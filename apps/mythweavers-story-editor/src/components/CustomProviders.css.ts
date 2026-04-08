import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const section = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['4'],
})

export const description = style({
  fontSize: '0.875rem',
  color: tokens.color.text.secondary,
  lineHeight: 1.5,
  margin: 0,
})

export const providerList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['3'],
})

export const providerCard = style({
  padding: tokens.space['3'],
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['2'],
})

export const providerHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: tokens.space['2'],
})

export const providerName = style({
  fontSize: '0.875rem',
  fontWeight: 600,
  color: tokens.color.text.primary,
})

export const providerEndpoint = style({
  fontSize: '0.75rem',
  color: tokens.color.text.muted,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
})

export const actions = style({
  display: 'flex',
  gap: tokens.space['2'],
  flexShrink: 0,
})

export const actionButton = style({
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
    color: tokens.color.text.primary,
  },
})

export const removeButton = style({
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  backgroundColor: tokens.color.bg.base,
  color: tokens.color.semantic.error,
  fontSize: '0.75rem',
  cursor: 'pointer',
  transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,

  ':hover': {
    backgroundColor: `color-mix(in srgb, ${tokens.color.semantic.error} 10%, transparent)`,
  },
})

export const form = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['3'],
  padding: tokens.space['3'],
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
})

export const formRow = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['1'],
})

export const label = style({
  fontSize: '0.7rem',
  fontWeight: 600,
  color: tokens.color.text.secondary,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
})

export const input = style({
  width: '100%',
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

export const inputRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
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
  fontSize: '0.75rem',
  color: tokens.color.text.muted,
  fontStyle: 'italic',
})

export const formActions = style({
  display: 'flex',
  gap: tokens.space['2'],
  justifyContent: 'flex-end',
})
