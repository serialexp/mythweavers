import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const inlineText = style({
  color: tokens.color.text.primary,
})

export const toggleContainer = style({
  marginTop: '0.5rem',
})

export const cardMargin = style({
  marginTop: '0.5rem',
})

export const previewLabel = style({
  fontSize: '0.85rem',
  color: tokens.color.text.secondary,
  marginBottom: '0.25rem',
})

export const previewText = style({
  color: tokens.color.text.primary,
  lineHeight: tokens.font.lineHeight.normal,
})

export const dataDetails = style({
  marginTop: '0.75rem',
  background: tokens.color.bg.elevated,
  borderRadius: tokens.radius.sm,
  padding: tokens.space['2'],
})

export const dataSummary = style({
  cursor: 'pointer',
  fontSize: '0.85rem',
  color: tokens.color.text.secondary,
  fontWeight: tokens.font.weight.medium,
})

export const evalTime = style({
  color: tokens.color.text.muted,
  fontSize: '0.8rem',
})

export const dataContent = style({
  marginTop: '0.5rem',
  fontFamily: tokens.font.family.mono,
  fontSize: '0.8rem',
  whiteSpace: 'pre-wrap',
  color: tokens.color.text.primary,
  maxHeight: '200px',
  overflowY: 'auto',
})

export const previewAlwaysContainer = style({
  marginTop: '0.75rem',
})

export const previewHeader = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '0.5rem',
})

export const previewTitle = style({
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.primary,
  fontSize: '0.9rem',
})

export const previewContent = style({
  color: tokens.color.text.primary,
  lineHeight: tokens.font.lineHeight.normal,
  minHeight: '1.5em',
  whiteSpace: 'pre-line',
})

export const emptyPlaceholder = style({
  color: tokens.color.text.muted,
  fontStyle: 'italic',
})

export const alertMargin = style({
  marginBottom: '0.5rem',
})
