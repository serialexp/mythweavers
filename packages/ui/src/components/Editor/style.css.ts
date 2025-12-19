import { globalStyle, style } from '@vanilla-extract/css'
import { tokens } from '../../theme/tokens.css'

/**
 * Basic Editor Styles
 * Using design tokens from @mythweavers/ui for theme support
 */

export const editor = style({
  display: 'flex',
  alignItems: 'flex-start',
  paddingLeft: '80px', // Space for menus
})

globalStyle(`${editor} .ProseMirror`, {
  padding: '1em',
  border: `1px dotted ${tokens.color.border.default}`,
  outline: 'none',
  backgroundColor: tokens.color.bg.raised,
  color: tokens.color.text.primary,
})

export const inlineMenu = style({
  zIndex: tokens.zIndex.dropdown,
  display: 'flex',
  gap: '2px',
  borderRadius: tokens.radius.default,
  fontSize: tokens.font.size.xs,
  backgroundColor: tokens.color.bg.elevated,
  padding: tokens.space['1'],
  boxShadow: tokens.shadow.sm,
})

globalStyle(`${inlineMenu} button`, {
  backgroundColor: tokens.color.surface.default,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  color: tokens.color.text.primary,
  cursor: 'pointer',
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
})

globalStyle(`${inlineMenu} button.active`, {
  backgroundColor: tokens.color.accent.primary,
  border: `1px solid ${tokens.color.accent.primary}`,
  color: tokens.color.text.inverse,
})

export const row = style({
  padding: '1em',
  selectors: {
    '&:nth-child(odd)': {
      backgroundColor: tokens.color.surface.default,
    },
  },
})

export const blockMenu = style({
  position: 'absolute',
  display: 'flex',
  gap: '2px',
  maxWidth: '70px',
  overflow: 'hidden',
  zIndex: tokens.zIndex.dropdown,
})

globalStyle(`${blockMenu} button`, {
  backgroundColor: tokens.color.surface.default,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  color: tokens.color.text.primary,
  cursor: 'pointer',
})

// Blockquote styling
globalStyle('blockquote', {
  borderLeft: `4px solid ${tokens.color.accent.primary}`,
  marginLeft: 0,
  paddingLeft: tokens.space['2.5'],
  color: tokens.color.text.secondary,
})

// Heading styling
globalStyle('heading', {
  fontSize: tokens.font.size.xl,
  fontWeight: tokens.font.weight.bold,
  margin: '1em 0',
  color: tokens.color.text.primary,
})
