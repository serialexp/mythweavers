import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const incrementLabel = style({
  fontSize: '0.85em',
  color: tokens.color.text.secondary,
  fontWeight: tokens.font.weight.medium,
})

export const incrementRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
})

export const daysText = style({
  fontSize: '0.85em',
  color: tokens.color.text.secondary,
})

export const previewBox = style({
  textAlign: 'center',
  fontFamily: tokens.font.family.mono,
  fontSize: '0.9em',
  color: tokens.color.text.secondary,
})

export const inputRow = style({
  display: 'grid',
  gridTemplateColumns: '80px 1fr auto',
  alignItems: 'center',
  gap: tokens.space['2'],
})

export const inputLabel = style({
  fontSize: '0.9em',
  color: tokens.color.text.secondary,
})

export const eraLabel = style({
  fontSize: '0.8em',
  color: tokens.color.text.muted,
  minWidth: '60px',
  textAlign: 'right',
})

export const actionRow = style({
  display: 'flex',
  gap: tokens.space['2'],
  justifyContent: 'flex-end',
})

export const cardTitle = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.primary,
})
