import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const scriptCard = style({
  marginBottom: tokens.space['4'],
})

export const scriptHeader = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: tokens.space['4'],
})

export const summaryPreview = style({
  flex: 1,
  color: tokens.color.text.secondary,
  fontSize: '0.9rem',
  lineHeight: tokens.font.lineHeight.relaxed,
  padding: tokens.space['2'],
  background: tokens.color.bg.elevated,
  borderRadius: tokens.radius.sm,
})

export const codeHeading = style({
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.primary,
  marginBottom: tokens.space['1'],
  fontSize: tokens.font.size.sm,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
})

export const codeBlock = style({
  background: tokens.color.bg.base,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  padding: tokens.space['2'],
  overflowX: 'auto',
  fontFamily: tokens.font.family.mono,
  fontSize: tokens.font.size.sm,
  lineHeight: tokens.font.lineHeight.normal,
  color: tokens.color.text.primary,
  margin: 0,
})

export const codeContent = style({
  whiteSpace: 'pre',
})

export const dataStateDivider = style({
  marginTop: tokens.space['4'],
  paddingTop: tokens.space['4'],
  borderTop: `1px solid ${tokens.color.border.default}`,
})
