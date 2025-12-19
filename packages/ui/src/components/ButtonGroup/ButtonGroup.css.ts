import { globalStyle, style } from '@vanilla-extract/css'
import { tokens } from '../../theme/tokens.css'

export const buttonGroup = style({
  display: 'inline-flex',
  alignItems: 'center',
})

// Reset all buttons in the group to have no border radius
globalStyle(`${buttonGroup} button`, {
  borderRadius: 0,
})

globalStyle(`${buttonGroup} button::after`, {
  borderRadius: 0,
})

// First child - either a direct button or a button inside the first child (display:contents wrapper)
globalStyle(`${buttonGroup} > button:first-child, ${buttonGroup} > :first-child button`, {
  borderTopLeftRadius: tokens.radius.default,
  borderBottomLeftRadius: tokens.radius.default,
})

globalStyle(`${buttonGroup} > button:first-child::after, ${buttonGroup} > :first-child button::after`, {
  borderTopLeftRadius: `calc(${tokens.radius.default} - 2px)`,
  borderBottomLeftRadius: `calc(${tokens.radius.default} - 2px)`,
})

// Last child - either a direct button or a button inside the last child (display:contents wrapper)
globalStyle(`${buttonGroup} > button:last-child, ${buttonGroup} > :last-child button`, {
  borderTopRightRadius: tokens.radius.default,
  borderBottomRightRadius: tokens.radius.default,
})

globalStyle(`${buttonGroup} > button:last-child::after, ${buttonGroup} > :last-child button::after`, {
  borderTopRightRadius: `calc(${tokens.radius.default} - 2px)`,
  borderBottomRightRadius: `calc(${tokens.radius.default} - 2px)`,
})

// If there's only one child with a button, it gets full radius
globalStyle(`${buttonGroup} > button:only-child, ${buttonGroup} > :only-child button`, {
  borderRadius: tokens.radius.default,
})

globalStyle(`${buttonGroup} > button:only-child::after, ${buttonGroup} > :only-child button::after`, {
  borderRadius: `calc(${tokens.radius.default} - 2px)`,
})
