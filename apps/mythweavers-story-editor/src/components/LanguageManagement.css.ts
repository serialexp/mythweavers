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

export const emptyState = style({
  padding: '2rem',
  textAlign: 'center',
  color: tokens.color.text.secondary,
  background: tokens.color.bg.raised,
  border: `1px dashed ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
})

export const languageInfo = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
})

export const languageName = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  fontWeight: tokens.font.weight.medium,
  fontSize: '1rem',
  color: tokens.color.text.primary,
})

export const languageLabel = style({
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
})

export const formRow = style({
  display: 'flex',
  gap: tokens.space['2'],
  alignItems: 'flex-end',
})

export const formField = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['1'],
})

export const fieldLabel = style({
  fontSize: tokens.font.size.sm,
  fontWeight: tokens.font.weight.medium,
  color: tokens.color.text.primary,
})

export const cardMargin = style({
  marginTop: '0.5rem',
})
