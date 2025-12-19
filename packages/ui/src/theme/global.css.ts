import { globalStyle } from '@vanilla-extract/css'
import { chronicleTheme } from './chronicle.css'
import { starlightTheme } from './starlight.css'
import { tokens } from './tokens.css'

/**
 * Global styles scoped to theme containers
 * These only apply to elements inside a themed wrapper, not to the whole page
 */

// Helper to scope styles to both themes
const themed = (selector: string) => `.${chronicleTheme} ${selector}, .${starlightTheme} ${selector}`

const themedRoot = () => `.${chronicleTheme}, .${starlightTheme}`

// Reset box-sizing for all elements inside themed containers
globalStyle(`${themed('*')}, ${themed('*::before')}, ${themed('*::after')}`, {
  boxSizing: 'border-box',
})

// Also apply to the theme root itself
globalStyle(`${themedRoot()}, ${themedRoot()}::before, ${themedRoot()}::after`, {
  boxSizing: 'border-box',
})

// Base styles for themed containers
globalStyle(themedRoot(), {
  backgroundColor: tokens.color.bg.base,
  color: tokens.color.text.primary,
  fontFamily: tokens.font.family.sans,
  fontSize: tokens.font.size.base,
  lineHeight: tokens.font.lineHeight.normal,
  WebkitFontSmoothing: 'antialiased',
  MozOsxFontSmoothing: 'grayscale',
})

// Focus visible styles
globalStyle(themed(':focus-visible'), {
  outline: `2px solid ${tokens.color.border.focus}`,
  outlineOffset: '2px',
})

// Remove default focus for mouse users
globalStyle(themed(':focus:not(:focus-visible)'), {
  outline: 'none',
})

// Selection
globalStyle(themed('::selection'), {
  backgroundColor: tokens.color.accent.primary,
  color: tokens.color.text.inverse,
})

// Code
globalStyle(themed('code'), {
  fontFamily: tokens.font.family.mono,
  backgroundColor: tokens.color.surface.default,
  padding: `${tokens.space['0.5']} ${tokens.space['1']}`,
  borderRadius: tokens.radius.sm,
  fontSize: '0.9em',
})

globalStyle(themed('pre'), {
  fontFamily: tokens.font.family.mono,
  backgroundColor: tokens.color.bg.raised,
  padding: tokens.space['4'],
  borderRadius: tokens.radius.md,
  overflow: 'auto',
})

// Don't style code inside pre
globalStyle(themed('pre code'), {
  backgroundColor: 'transparent',
  padding: 0,
  borderRadius: 0,
})
