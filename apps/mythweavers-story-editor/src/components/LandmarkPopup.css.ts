import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const container = style({
  position: 'absolute',
  background: tokens.color.bg.base,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
  padding: '0.75rem',
  boxShadow: tokens.shadow.lg,
  zIndex: 1000,
  width: '280px',
  maxWidth: 'calc(100vw - 20px)',
  maxHeight: '400px',
  overflowY: 'auto',
})

export const name = style({
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.primary,
  marginBottom: '0.25rem',
})

export const description = style({
  color: tokens.color.text.secondary,
  fontSize: '0.9rem',
  lineHeight: tokens.font.lineHeight.normal,
})

export const label = style({
  color: tokens.color.text.secondary,
  fontSize: '0.9rem',
  flexShrink: 0,
})

export const colorInput = style({
  width: '60px',
  flexShrink: 0,
  padding: '0.25rem',
  background: tokens.color.bg.raised,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  cursor: 'pointer',
})

export const colorGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: '0.25rem',
  width: '100%',
  maxWidth: '100%',
})

export const colorButton = style({
  width: '100%',
  aspectRatio: '1',
  borderRadius: '50%',
  cursor: 'pointer',
  maxWidth: '40px',
  border: '2px solid transparent',
  transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,
})

export const colorButtonSelected = style({
  borderColor: tokens.color.accent.primary,
  boxShadow: `0 0 0 2px ${tokens.color.bg.base}`,
})

export const colorButtonWhite = style({
  border: `2px solid ${tokens.color.border.default}`,
})

export const sizeButton = style({
  flex: 1,
  padding: '0.4rem 0.6rem',
  background: tokens.color.bg.elevated,
  color: tokens.color.text.primary,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  cursor: 'pointer',
  fontSize: '0.85rem',
  transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,
})

export const sizeButtonSelected = style({
  background: tokens.color.surface.selected,
  color: tokens.color.accent.primary,
  borderColor: tokens.color.accent.primary,
})

export const actionRow = style({
  marginTop: '0.5rem',
  paddingTop: '0.5rem',
  borderTop: `1px solid ${tokens.color.border.default}`,
})

export const formContainer = style({
  width: '100%',
})

export const buttonRow = style({
  marginTop: '0.5rem',
})
