import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const container = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  padding: '1.5rem',
})

export const headerRow = style({
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '1rem',
})

export const sectionTitle = style({
  margin: 0,
  fontSize: '1.25rem',
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.primary,
})

export const cardTitle = style({
  margin: 0,
  fontSize: '1rem',
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.primary,
})

export const emptyState = style({
  padding: '2rem',
  textAlign: 'center',
  color: tokens.color.text.secondary,
  background: tokens.color.bg.raised,
  border: `1px dashed ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
})

export const calendarInfo = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
})

export const calendarName = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  fontWeight: tokens.font.weight.medium,
  fontSize: '1rem',
  color: tokens.color.text.primary,
})

export const calendarDescription = style({
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
})

export const calendarDetails = style({
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.muted,
  fontFamily: tokens.font.family.mono,
})

export const presetDescription = style({
  padding: tokens.space['2'],
  background: tokens.color.bg.elevated,
  borderRadius: tokens.radius.sm,
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
})

export const startWithLabel = style({
  fontWeight: tokens.font.weight.medium,
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.primary,
})

export const cardMargin = style({
  marginTop: '0.5rem',
})
