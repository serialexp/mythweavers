import { style } from "@vanilla-extract/css"
import { tokens } from "@mythweavers/ui/tokens"

export const layout = style({
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  backgroundColor: tokens.color.bg.base,
  color: tokens.color.text.primary,
})

export const main = style({
  flex: 1,
  padding: tokens.space[6],
  maxWidth: "1200px",
  width: "100%",
  marginInline: "auto",
})
