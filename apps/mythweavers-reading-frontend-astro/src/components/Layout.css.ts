import { style } from '@vanilla-extract/css'

// Transparent so <BackgroundLayer /> (z-index: -1) shows through. The
// layer owns the visible backdrop — theme default when idle, chapter
// background when a chapter pushes one. Nothing on this wrapper or its
// children should paint a solid background over the full viewport.
export const pageWrapper = style({
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100vh',
})

export const mainContent = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
})

// Theme class for data-theme attribute styling
export const lightTheme = style({})
export const darkTheme = style({})
