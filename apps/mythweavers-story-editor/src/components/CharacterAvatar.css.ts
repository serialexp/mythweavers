import { tokens } from '@mythweavers/ui/tokens'
import { style, styleVariants } from '@vanilla-extract/css'

const shared = style({
  borderRadius: tokens.radius.full,
  flexShrink: 0,
})

const imageBase = style([
  shared,
  {
    objectFit: 'cover',
    display: 'block',
  },
])

const placeholderBase = style([
  shared,
  {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.color.bg.elevated,
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.text.muted,
    lineHeight: 1,
    userSelect: 'none',
  },
])

const sizes = {
  // xs exists for dense rows like the story navigation tree, where the avatar
  // sits inline with 0.9em indicator icons.
  xs: { width: '16px', height: '16px', fontSize: '9px' },
  sm: { width: '20px', height: '20px', fontSize: '10px' },
  md: { width: '24px', height: '24px', fontSize: tokens.font.size.xs },
} as const

export const image = styleVariants(sizes, (size) => [imageBase, size])

export const placeholder = styleVariants(sizes, (size) => [placeholderBase, size])

/** Dimmed, for an avatar that was inferred rather than explicitly chosen. */
export const muted = style({
  opacity: 0.45,
})
