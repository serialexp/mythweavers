import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const sectionHeader = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  width: '100%',
  padding: tokens.space['2'],
  background: tokens.color.bg.raised,
  border: 'none',
  borderRadius: tokens.radius.sm,
  cursor: 'pointer',
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.primary,
  fontSize: '0.9rem',
})

export const codeBlock = style({
  display: 'block',
  background: tokens.color.bg.elevated,
  padding: tokens.space['2'],
  borderRadius: tokens.radius.sm,
  fontFamily: tokens.font.family.mono,
  fontSize: '0.85rem',
  whiteSpace: 'pre-wrap',
  color: tokens.color.text.primary,
})

export const codeBlockSpaced = style({
  display: 'block',
  background: tokens.color.bg.elevated,
  padding: tokens.space['2'],
  borderRadius: tokens.radius.sm,
  fontFamily: tokens.font.family.mono,
  fontSize: '0.85rem',
  whiteSpace: 'pre-wrap',
  color: tokens.color.text.primary,
  marginTop: '0.25rem',
})

export const sectionContent = style({
  padding: '0.75rem',
  color: tokens.color.text.secondary,
  fontSize: '0.9rem',
})

export const sectionParagraph = style({
  margin: '0 0 0.5rem 0',
})

export const sectionLabel = style({
  marginBottom: '0.25rem',
  fontWeight: tokens.font.weight.medium,
})

export const cardMargin = style({
  marginTop: '0.5rem',
})

export const emptyMessage = style({
  color: tokens.color.text.muted,
  fontSize: tokens.font.size.sm,
  textAlign: 'center',
})

export const functionsLabel = style({
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
  fontWeight: tokens.font.weight.medium,
  marginBottom: tokens.space['2'],
})

export const functionItem = style({
  padding: '0.25rem 0',
})

export const functionCode = style({
  fontFamily: tokens.font.family.mono,
  fontSize: '0.8125rem',
  color: tokens.color.accent.primary,
  background: tokens.color.bg.base,
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
  borderRadius: '3px',
  display: 'inline-block',
})

export const functionsFooter = style({
  marginTop: '1rem',
  paddingTop: '0.75rem',
  borderTop: `1px solid ${tokens.color.border.default}`,
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.muted,
})

export const inlineCode = style({
  fontFamily: tokens.font.family.mono,
  background: tokens.color.bg.base,
  padding: '0.125rem 0.25rem',
  borderRadius: '2px',
  color: tokens.color.text.secondary,
})
