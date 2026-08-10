import { tokens } from '@mythweavers/ui/tokens'
import { style } from '@vanilla-extract/css'

export const scopeList = style({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['2'],
})

export const scopeItem = style({
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: tokens.space['3'],
  padding: `${tokens.space['2']} ${tokens.space['3']}`,
  backgroundColor: tokens.color.bg.raised,
  border: `1px solid ${tokens.color.border.subtle}`,
  borderRadius: tokens.radius.md,
})

export const scopeDescription = style({
  color: tokens.color.text.primary,
  fontSize: tokens.font.size.sm,
})

export const scopeCode = style({
  fontFamily: tokens.font.family.mono,
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.muted,
  whiteSpace: 'nowrap',
})

export const redirectUri = style({
  display: 'block',
  fontFamily: tokens.font.family.mono,
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.primary,
  padding: `${tokens.space['2']} ${tokens.space['3']}`,
  backgroundColor: tokens.color.bg.raised,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
  // A long redirect URI must stay fully readable — truncating it would hide
  // exactly the part an attacker would want hidden.
  overflowWrap: 'anywhere',
})
