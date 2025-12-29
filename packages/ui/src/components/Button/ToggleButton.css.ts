import { style } from '@vanilla-extract/css'
import { tokens } from '../../theme/tokens.css'

/**
 * Active state style for ToggleButton.
 * Applied when the button is in its "on" state.
 * Works with both ghost and outline variants.
 */
export const toggleButtonActive = style({
  backgroundColor: tokens.color.surface.selected,
  color: tokens.color.accent.primary,
  selectors: {
    '&:hover:not(:disabled)': {
      backgroundColor: tokens.color.surface.selected,
    },
  },
})
