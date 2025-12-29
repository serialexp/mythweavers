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

export const formatPreview = style({
  marginTop: tokens.space['2'],
  padding: tokens.space['2'],
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
  background: tokens.color.bg.base,
  borderRadius: tokens.radius.sm,
  border: `1px solid ${tokens.color.border.subtle}`,
})

export const nestedList = style({
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

// Holiday styles
export const holidayItem = style({
  display: 'flex',
  gap: '0.75rem',
  alignItems: 'center',
  padding: '0.75rem',
  background: tokens.color.bg.elevated,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
})

export const holidayName = style({
  flex: 1,
  fontWeight: tokens.font.weight.medium,
})

export const holidayRule = style({
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
})

export const holidayForm = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: '0.75rem',
  padding: '1rem',
  background: tokens.color.bg.elevated,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
})

export const weekdayGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: tokens.space['1'],
})

export const weekdayInput = style({
  textAlign: 'center',
})

// Step builder styles for computed holidays
export const stepItem = style({
  display: 'flex',
  gap: tokens.space['2'],
  alignItems: 'center',
  padding: tokens.space['2'],
  background: tokens.color.bg.base,
  border: `1px solid ${tokens.color.border.subtle}`,
  borderRadius: tokens.radius.sm,
})

export const stepNumber = style({
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.muted,
  minWidth: '1.5rem',
})
