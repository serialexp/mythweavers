import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const centeredContainer = style({
  textAlign: 'center',
  padding: '2rem',
})

export const validatingText = style({
  color: tokens.color.text.secondary,
  marginTop: '1rem',
})

export const userInfoText = style({
  color: tokens.color.text.secondary,
  marginBottom: '1.5rem',
})

export const usernameHighlight = style({
  color: tokens.color.text.primary,
})

export const successContainer = style({
  textAlign: 'center',
  padding: '1rem 0',
})

export const redirectText = style({
  color: tokens.color.text.secondary,
})
