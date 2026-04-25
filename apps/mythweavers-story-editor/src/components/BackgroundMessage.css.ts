import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const container = style({
  display: 'flex',
  alignItems: 'stretch',
  gap: tokens.space['3'],
  padding: tokens.space['2'],
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
  background: tokens.color.bg.raised,
})

export const thumbnailWrap = style({
  flex: '0 0 120px',
  maxWidth: '120px',
  aspectRatio: '16 / 9',
  overflow: 'hidden',
  borderRadius: tokens.radius.sm,
  background: tokens.color.surface.default,
})

export const thumbnail = style({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
})

export const placeholder = style({
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: tokens.space['1'],
  color: tokens.color.text.muted,
  fontSize: '0.75rem',
})

export const body = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  gap: tokens.space['2'],
})

export const caption = style({
  fontSize: '0.85rem',
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.secondary,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
})

export const actions = style({
  display: 'flex',
  gap: tokens.space['2'],
})

export const actionButton = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: tokens.space['1'],
  padding: `${tokens.space['1']} ${tokens.space['3']}`,
  fontSize: '0.8rem',
  borderRadius: tokens.radius.sm,
  border: `1px solid ${tokens.color.border.default}`,
  background: tokens.color.bg.base,
  color: tokens.color.text.primary,
  cursor: 'pointer',
  transition: `background ${tokens.duration.fast} ${tokens.easing.default}`,
  selectors: {
    '&:hover:not(:disabled)': { background: tokens.color.surface.hover },
    '&:disabled': { opacity: 0.6, cursor: 'not-allowed' },
  },
})
