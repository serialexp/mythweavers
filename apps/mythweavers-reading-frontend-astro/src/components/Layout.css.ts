import { tokens } from '@mythweavers/ui/theme'
import { style } from '@vanilla-extract/css'

export const pageWrapper = style({
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100vh',
  backgroundColor: tokens.color.bg.base,
})

export const mainContent = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
})

// Theme class for data-theme attribute styling
export const lightTheme = style({})
export const darkTheme = style({})
