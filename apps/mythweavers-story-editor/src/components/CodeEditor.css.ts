import { tokens } from '@mythweavers/ui/tokens'
import { globalStyle, style } from '@vanilla-extract/css'

/**
 * Styles for CodeEditor component
 * Uses design tokens from @mythweavers/ui for consistent theming
 */

export const container = style({
  width: '100%',
})

export const editor = style({
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.default,
  overflow: 'hidden',
  background: tokens.color.bg.raised,
})

export const hasError = style({
  borderColor: tokens.color.semantic.error,
})

// Override CodeMirror styles for better integration
globalStyle(`${editor} .cm-editor`, {
  background: tokens.color.bg.raised,
  color: tokens.color.text.primary,
})

globalStyle(`${editor} .cm-editor .cm-content`, {
  fontFamily: tokens.font.family.mono,
})

globalStyle(`${editor} .cm-editor .cm-line`, {
  padding: '0 4px',
})
