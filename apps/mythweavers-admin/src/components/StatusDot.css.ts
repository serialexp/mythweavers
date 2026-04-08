import { style, styleVariants } from "@vanilla-extract/css"
import { tokens } from "@mythweavers/ui/tokens"

export const base = style({
  display: "inline-block",
  width: "10px",
  height: "10px",
  borderRadius: tokens.radius.full,
  flexShrink: 0,
})

export const variant = styleVariants({
  success: { backgroundColor: tokens.color.semantic.success },
  error: { backgroundColor: tokens.color.semantic.error },
  warning: { backgroundColor: tokens.color.semantic.warning },
})
