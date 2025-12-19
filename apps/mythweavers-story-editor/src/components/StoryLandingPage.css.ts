import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const pageWrapper = style({
  height: '100vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  backgroundColor: tokens.color.bg.base,
})

export const contentArea = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '2rem',
  overflow: 'hidden',
  minHeight: 0,
})
