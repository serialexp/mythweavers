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
  fontSize: '14px',
})

globalStyle(`${editor} .cm-editor .cm-content`, {
  fontFamily: tokens.font.family.mono,
  padding: tokens.space['3'],
  minHeight: '200px',
})

globalStyle(`${editor} .cm-editor .cm-line`, {
  padding: `0 ${tokens.space['1']}`,
})

globalStyle(`${editor} .cm-editor.cm-focused`, {
  outline: `2px solid ${tokens.color.accent.primary}`,
})

globalStyle(`${editor} .cm-editor .cm-cursor`, {
  borderLeftColor: tokens.color.accent.primary,
})

globalStyle(`${editor} .cm-editor .cm-placeholder`, {
  color: tokens.color.text.muted,
  fontStyle: 'italic',
})

globalStyle(`${editor} .cm-editor .cm-gutters`, {
  background: tokens.color.bg.base,
  borderRight: `1px solid ${tokens.color.border.default}`,
})

// Mobile optimizations
globalStyle(`${editor} .cm-editor`, {
  '@media': {
    '(max-width: 768px)': {
      fontSize: '13px',
    },
  },
})
