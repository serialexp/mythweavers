import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const container = style({
  height: '100%',
})

export const header = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: tokens.space['3'],
})

export const callCount = style({
  marginLeft: tokens.space['2'],
  color: tokens.color.text.secondary,
  fontSize: tokens.font.size.sm,
})

export const emptyState = style({
  padding: tokens.space['8'],
  textAlign: 'center',
  color: tokens.color.text.secondary,
  border: `1px dashed ${tokens.color.border.default}`,
  borderRadius: tokens.radius.lg,
})

export const entriesList = style({
  flex: 1,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['3'],
})

export const summary = style({
  cursor: 'pointer',
  padding: tokens.space['3'],
})

export const summaryContent = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['1'],
})

export const summaryHeader = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  fontWeight: tokens.font.weight.semibold,
})

export const summaryModel = style({
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
})

export const summaryMeta = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space['3'],
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.secondary,
})

export const sectionLabel = style({
  fontSize: tokens.font.size.sm,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: tokens.color.text.secondary,
  marginBottom: tokens.space['2'],
})

export const messageBox = style({
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
  padding: tokens.space['2'],
  background: tokens.color.surface.default,
})

export const messageHeader = style({
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.secondary,
  marginBottom: tokens.space['1'],
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
})

export const preformatted = style({
  margin: 0,
  fontFamily: tokens.font.family.mono,
  fontSize: tokens.font.size.sm,
  whiteSpace: 'pre-wrap',
})

export const outputBox = style({
  margin: 0,
  padding: tokens.space['2'],
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
  background: tokens.color.surface.default,
  fontFamily: tokens.font.family.mono,
  fontSize: tokens.font.size.sm,
  whiteSpace: 'pre-wrap',
})

export const statLabel = style({
  display: 'block',
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.secondary,
})

export const statValue = style({
  fontWeight: tokens.font.weight.semibold,
  fontSize: tokens.font.size.base,
})

export const cacheRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `${tokens.space['1']} 0`,
  borderBottom: `1px dashed ${tokens.color.border.subtle}`,
})

export const cacheTtl = style({
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.secondary,
})

export const cacheValue = style({
  fontSize: tokens.font.size.sm,
  fontWeight: tokens.font.weight.semibold,
})

export const errorTitle = style({
  fontWeight: tokens.font.weight.semibold,
  marginBottom: tokens.space['1'],
})
