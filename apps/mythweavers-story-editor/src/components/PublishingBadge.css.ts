import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

// Shared dot/pill shell; state colors override backgroundColor/color.
const base = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
})

export const dot = style([
  base,
  {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
])

export const pill = style([
  base,
  {
    height: '20px',
    padding: `0 ${tokens.space['2']}`,
    borderRadius: tokens.radius.full,
    fontSize: tokens.font.size.xs,
    fontWeight: tokens.font.weight.medium,
    lineHeight: '1',
  },
])

export const pillText = style({
  whiteSpace: 'nowrap',
})

// State color modifiers. Semantic tokens keep dark/light mode in sync.
export const draft = style({
  backgroundColor: tokens.color.surface.hover,
  color: tokens.color.text.muted,
})

export const scheduled = style({
  backgroundColor: tokens.color.semantic.warning,
  color: tokens.color.text.inverse,
})

export const live = style({
  backgroundColor: tokens.color.semantic.success,
  color: tokens.color.text.inverse,
})
