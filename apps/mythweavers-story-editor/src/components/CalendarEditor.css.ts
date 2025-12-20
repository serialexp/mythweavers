import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

// Subdivision styles
export const subdivisionItem = style({
  display: 'flex',
  gap: '0.75rem',
  alignItems: 'flex-start',
  padding: '1rem',
  background: tokens.color.bg.elevated,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
})

export const subdivisionFields = style({
  flex: '1',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: '0.75rem',
})

export const fieldFull = style({
  gridColumn: '1 / -1',
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['2'],
})

export const toggle = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
})

export const toggleLabel = style({
  fontSize: tokens.font.size.xs,
  fontWeight: tokens.font.weight.medium,
  color: tokens.color.text.secondary,
})

export const customGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
  gap: tokens.space['2'],
})

export const customGridWide = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
  gap: tokens.space['2'],
})

export const customField = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['1'],
})

export const customLabel = style({
  fontSize: tokens.font.size.xs,
  fontWeight: tokens.font.weight.medium,
  color: tokens.color.text.secondary,
  textAlign: 'center',
})

export const hint = style({
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.muted,
  marginTop: '-0.25rem',
})

export const nestedList = style({
  marginLeft: '1.5rem',
  paddingLeft: '1rem',
  borderLeft: `2px solid ${tokens.color.border.default}`,
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
})

// Section headings
export const sectionTitle = style({
  margin: 0,
  fontSize: '1.125rem',
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.primary,
})

export const cardTitle = style({
  margin: 0,
  fontSize: '1rem',
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.primary,
})

export const requiredMark = style({
  color: tokens.color.semantic.error,
})

// Actions
export const actionRow = style({
  justifyContent: 'flex-end',
  paddingTop: '1rem',
  borderTop: `1px solid ${tokens.color.border.default}`,
})
