import { style } from "@vanilla-extract/css"
import { tokens } from "@mythweavers/ui/tokens"

export const userRow = style({
  display: "flex",
  alignItems: "center",
  gap: tokens.space[3],
  width: "100%",
  textAlign: "left",
})

export const userInfo = style({
  flex: 1,
  minWidth: 0,
})

export const userMeta = style({
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.muted,
  display: "flex",
  gap: tokens.space[3],
})

export const searchRow = style({
  maxWidth: "400px",
})

export const paginationRow = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: tokens.space[3],
})
