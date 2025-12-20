import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const listItemName = style({
  fontSize: tokens.font.size.sm,
  fontWeight: tokens.font.weight.medium,
  color: tokens.color.text.primary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flex: '1',
})

export const form = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['4'],
})

export const fieldLabel = style({
  display: 'block',
  fontSize: tokens.font.size.xs,
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.secondary,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: tokens.space['1'],
})

export const fieldValue = style({
  fontSize: '0.9375rem',
  color: tokens.color.text.primary,
  lineHeight: tokens.font.lineHeight.relaxed,
})

export const typeSelector = style({
  display: 'flex',
  gap: tokens.space['4'],
  padding: tokens.space['4'],
  background: tokens.color.bg.raised,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
})

export const typeLabel = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.primary,
  cursor: 'pointer',
})

export const globalToggle = style({
  padding: tokens.space['4'],
  background: tokens.color.bg.raised,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
})

export const actionRow = style({
  paddingTop: tokens.space['4'],
  borderTop: `1px solid ${tokens.color.border.default}`,
})

export const fieldGroup = style({
  marginBottom: tokens.space['6'],
  flexWrap: 'wrap',
})
