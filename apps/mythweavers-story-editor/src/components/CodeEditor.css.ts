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

// Autocomplete popup styles (rendered in portal, so use global selectors)
globalStyle(`.cm-tooltip`, {
  background: tokens.color.bg.elevated,
})

globalStyle(`.cm-tooltip-autocomplete`, {
  background: tokens.color.bg.elevated,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.default,
  boxShadow: tokens.shadow.lg,
  overflow: 'hidden',
})

globalStyle(`.cm-tooltip-autocomplete > ul`, {
  fontFamily: tokens.font.family.mono,
  fontSize: tokens.font.size.sm,
  background: tokens.color.bg.elevated,
})

globalStyle(`.cm-tooltip-autocomplete ul li`, {
  padding: `${tokens.space['1.5']} ${tokens.space['2']}`,
  color: tokens.color.text.primary,
  background: tokens.color.bg.elevated,
  cursor: 'pointer',
})

globalStyle(`.cm-tooltip-autocomplete ul li:hover`, {
  background: tokens.color.surface.hover,
})

globalStyle(`.cm-tooltip-autocomplete ul li[aria-selected="true"]`, {
  background: tokens.color.surface.hover,
})

globalStyle(`.cm-tooltip-autocomplete .cm-completionLabel`, {
  color: 'inherit',
})

globalStyle(`.cm-tooltip-autocomplete .cm-completionDetail`, {
  marginLeft: tokens.space['2'],
  color: tokens.color.text.muted,
  fontStyle: 'italic',
})

globalStyle(`.cm-tooltip-autocomplete .cm-completionMatchedText`, {
  textDecoration: 'none',
  fontWeight: tokens.font.weight.bold,
  color: tokens.color.accent.primary,
})

// Syntax highlighting overrides (default theme has harsh blue #00f for variables)
globalStyle(`${editor} .cm-editor .ͼg`, {
  color: tokens.color.semantic.info,
})

// More semantic syntax highlighting overrides
globalStyle(`${editor} .cm-editor .cm-variableName`, {
  color: tokens.color.semantic.info,
})

globalStyle(`${editor} .cm-editor .cm-propertyName`, {
  color: tokens.color.accent.primary,
})

globalStyle(`${editor} .cm-editor .cm-keyword`, {
  color: tokens.color.accent.secondary,
})

globalStyle(`${editor} .cm-editor .cm-string`, {
  color: tokens.color.semantic.success,
})

globalStyle(`${editor} .cm-editor .cm-number`, {
  color: tokens.color.semantic.warning,
})

globalStyle(`${editor} .cm-editor .cm-comment`, {
  color: tokens.color.text.muted,
  fontStyle: 'italic',
})
