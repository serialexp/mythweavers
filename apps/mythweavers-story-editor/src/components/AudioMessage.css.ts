import { tokens } from '@mythweavers/ui/tokens'
import { style } from '@vanilla-extract/css'

export const container = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: tokens.space['3'],
  padding: tokens.space['2'],
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
  background: tokens.color.bg.raised,
})

export const iconWrap = style({
  flex: '0 0 auto',
  width: '40px',
  height: '40px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: tokens.radius.sm,
  background: tokens.color.surface.default,
  color: tokens.color.text.secondary,
})

export const body = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['2'],
  minWidth: 0,
})

export const captionRow = style({
  display: 'flex',
  alignItems: 'baseline',
  gap: tokens.space['2'],
  flexWrap: 'wrap',
})

export const caption = style({
  fontSize: '0.85rem',
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.secondary,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
})

export const filename = style({
  fontSize: '0.8rem',
  color: tokens.color.text.muted,
  // Truncate when filenames blow out the row.
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
})

export const player = style({
  width: '100%',
  // Native control height varies by UA; cap so a tall Firefox bar doesn't
  // dominate the message stream.
  maxHeight: '40px',
})

export const missing = style({
  fontSize: '0.85rem',
  color: tokens.color.text.muted,
  fontStyle: 'italic',
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
