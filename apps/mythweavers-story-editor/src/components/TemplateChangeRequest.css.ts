import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const contextNodesInfo = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: tokens.space['1'],
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
  marginBottom: tokens.space['2'],
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
  backgroundColor: tokens.color.bg.raised,
  borderRadius: tokens.radius.default,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
})

export const contextLabel = style({
  color: tokens.color.text.muted,
  flexShrink: 0,
})

export const nodeList = style({
  color: tokens.color.text.primary,
  fontWeight: tokens.font.weight.medium,
})

export const noContextWarning = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['1'],
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
  marginBottom: tokens.space['2'],
  fontSize: tokens.font.size.sm,
  color: tokens.color.accent.primary,
  backgroundColor: tokens.color.bg.raised,
  borderRadius: tokens.radius.default,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
})
