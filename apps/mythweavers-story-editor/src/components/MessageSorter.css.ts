import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const footer = style({
  paddingTop: '16px',
  borderTop: `1px solid ${tokens.color.border.default}`,
})
