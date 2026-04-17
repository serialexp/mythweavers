import { style } from "@vanilla-extract/css"
import { tokens } from "@mythweavers/ui/tokens"

export const balanceGrid = style({
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: tokens.space[4],
})

export const actionCard = style({
  flex: "1 1 300px",
  minWidth: "280px",
})

export const formGrid = style({
  display: "flex",
  flexDirection: "column",
  gap: tokens.space[3],
})

export const formLabel = style({
  display: "flex",
  flexDirection: "column",
  gap: tokens.space[1],
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
})

export const formInput = style({
  padding: `${tokens.space[2]} ${tokens.space[3]}`,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
  fontSize: tokens.font.size.sm,
  backgroundColor: tokens.color.surface.default,
  color: tokens.color.text.primary,
  outline: "none",
  selectors: {
    "&:focus": {
      borderColor: tokens.color.accent.primary,
    },
  },
})

export const transactionTable = style({
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
  overflow: "hidden",
})

export const tableHeaderRow = style({
  display: "grid",
  gridTemplateColumns: "120px 80px 100px 1fr",
  backgroundColor: tokens.color.surface.hover,
  borderBottom: `1px solid ${tokens.color.border.default}`,
})

export const tableHeaderCell = style({
  padding: `${tokens.space[2]} ${tokens.space[3]}`,
  fontSize: tokens.font.size.xs,
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.secondary,
  textTransform: "uppercase" as const,
  letterSpacing: tokens.font.letterSpacing.wide,
})

export const tableRow = style({
  display: "grid",
  gridTemplateColumns: "120px 80px 100px 1fr",
  fontSize: tokens.font.size.sm,
  borderBottom: `1px solid ${tokens.color.border.default}`,
  selectors: {
    "&:last-child": {
      borderBottom: "none",
    },
  },
})

export const tableCell = style({
  padding: `${tokens.space[2]} ${tokens.space[3]}`,
  display: "flex",
  alignItems: "center",
})

export const amountPositive = style({
  color: tokens.color.semantic.success,
  fontWeight: tokens.font.weight.medium,
})

export const amountNegative = style({
  color: tokens.color.semantic.error,
  fontWeight: tokens.font.weight.medium,
})

export const notesCell = style({
  color: tokens.color.text.muted,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
})
