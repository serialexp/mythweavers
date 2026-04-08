import { style } from "@vanilla-extract/css"
import { tokens } from "@mythweavers/ui/tokens"

export const modelRow = style({
  display: "flex",
  alignItems: "center",
  gap: tokens.space[3],
  width: "100%",
  textAlign: "left",
})

export const modelInfo = style({
  flex: 1,
  minWidth: 0,
})

export const modelMeta = style({
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.muted,
  display: "flex",
  gap: tokens.space[3],
  flexWrap: "wrap",
})

export const pricingGrid = style({
  display: "grid",
  gridTemplateColumns: "auto 1fr 1fr",
  gap: `${tokens.space[1]} ${tokens.space[4]}`,
  fontSize: tokens.font.size.sm,
})

export const pricingHeader = style({
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.secondary,
  fontSize: tokens.font.size.xs,
  textTransform: "uppercase" as const,
  letterSpacing: tokens.font.letterSpacing.wide,
})

export const pricingLabel = style({
  color: tokens.color.text.secondary,
})

export const discoverRow = style({
  display: "flex",
  alignItems: "center",
  gap: tokens.space[3],
  padding: `${tokens.space[2]} ${tokens.space[3]}`,
  borderRadius: tokens.radius.md,
  selectors: {
    "&:hover": {
      backgroundColor: tokens.color.surface.hover,
    },
  },
})
