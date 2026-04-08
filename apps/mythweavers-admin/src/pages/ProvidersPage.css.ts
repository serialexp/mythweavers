import { style } from "@vanilla-extract/css"
import { tokens } from "@mythweavers/ui/tokens"

export const providerRow = style({
  display: "flex",
  alignItems: "center",
  gap: tokens.space[3],
  width: "100%",
  textAlign: "left",
})

export const providerInfo = style({
  flex: 1,
  minWidth: 0,
})

export const providerSlug = style({
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.muted,
})

export const providerEndpoint = style({
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.secondary,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
})

export const envHint = style({
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.muted,
  fontFamily: tokens.font.family.mono,
})

export const indicators = style({
  display: "flex",
  alignItems: "center",
  gap: tokens.space[2],
  flexShrink: 0,
})
