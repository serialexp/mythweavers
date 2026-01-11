import { tokens } from '@mythweavers/ui/tokens'
import { style } from '@vanilla-extract/css'

/**
 * Shared styles for view mode components (NormalModeView, ScriptModeView, etc.)
 * Uses design tokens from @mythweavers/ui for consistent theming
 */

// Warning/Info message container - used for "No Scene Selected" etc.
export const infoMessage = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['4'],
  padding: tokens.space['8'],
  margin: `${tokens.space['8']} auto`,
  maxWidth: '600px',
  background: tokens.color.bg.raised,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.lg,
  color: tokens.color.text.secondary,
})

export const infoMessageIcon = style({
  fontSize: tokens.font.size['2xl'],
  flexShrink: 0,
})

export const warningIcon = style([
  infoMessageIcon,
  {
    color: tokens.color.semantic.warning,
  },
])

export const primaryIcon = style([
  infoMessageIcon,
  {
    color: tokens.color.accent.primary,
  },
])

export const infoMessageTitle = style({
  margin: `0 0 ${tokens.space['2']} 0`,
  fontSize: tokens.font.size.lg,
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.primary,
})

export const infoMessageText = style({
  margin: '0',
  fontSize: tokens.font.size.sm,
  lineHeight: tokens.font.lineHeight.normal,
  color: tokens.color.text.secondary,
})

// Wrapper for messages - centers content with max-width
export const messageWrapper = style({
  position: 'relative',
  padding: '0 1rem',
  maxWidth: '60rem',
  margin: '0 auto',
})
