import { tokens } from '@mythweavers/ui/tokens'
import { style } from '@vanilla-extract/css'

/**
 * Shared styles for message-related components
 * Uses design tokens from @mythweavers/ui for consistent theming
 */

export const regenerateTokenBadge = style({
  fontSize: tokens.font.size.xs,
  opacity: 0.7,
  marginLeft: tokens.space['0.5'],
})
