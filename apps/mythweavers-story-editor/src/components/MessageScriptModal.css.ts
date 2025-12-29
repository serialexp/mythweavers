import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const description = style({
  margin: `0 0 ${tokens.space['4']} 0`,
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
})

export const previewHeader = style({
  margin: `0 0 ${tokens.space['2']} 0`,
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
})

export const previewContent = style({
  margin: 0,
  fontFamily: tokens.font.family.mono,
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.primary,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
})

export const footer = style({
  display: 'flex',
  gap: tokens.space['2'],
  justifyContent: 'flex-end',
  padding: `${tokens.space['4']} ${tokens.space['6']}`,
  borderTop: `${tokens.borderWidth.thin} solid ${tokens.color.border.default}`,
})

// Modal content
export const modalContent = style({
  padding: tokens.space['6'],
  overflowY: 'auto',
  flex: 1,
})

export const tabPanelContent = style({
  paddingTop: tokens.space['4'],
})

// Plot Points Override Editor styles
export const plotPointsDescription = style({
  color: tokens.color.text.secondary,
  fontSize: tokens.font.size.sm,
})

export const plotPointsHint = style({
  color: tokens.color.accent.primary,
  fontWeight: tokens.font.weight.semibold,
})

export const plotPointsList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['2'],
})

export const plotPointRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['3'],
  padding: tokens.space['2'],
  backgroundColor: tokens.color.bg.raised,
  borderRadius: tokens.radius.default,
  borderLeft: `3px solid transparent`,
})

export const plotPointRowActive = style([
  plotPointRow,
  {
    borderLeftColor: tokens.color.accent.primary,
  },
])

export const plotPointKey = style({
  fontWeight: tokens.font.weight.semibold,
  minWidth: '120px',
  fontFamily: tokens.font.family.mono,
})

export const plotPointType = style({
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.muted,
  padding: `${tokens.space['0.5']} ${tokens.space['1.5']}`,
  backgroundColor: tokens.color.bg.elevated,
  borderRadius: tokens.radius.default,
})

export const plotPointValue = style({
  flex: 1,
  color: tokens.color.text.primary,
})

export const plotPointValueActive = style([
  plotPointValue,
  {
    color: tokens.color.accent.primary,
    fontWeight: tokens.font.weight.semibold,
  },
])

export const emptyState = style({
  color: tokens.color.text.muted,
  fontStyle: 'italic',
})

export const input = style({
  padding: tokens.space['2'],
  border: `${tokens.borderWidth.thin} solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.default,
  backgroundColor: tokens.color.bg.base,
  color: tokens.color.text.primary,
  fontSize: tokens.font.size.sm,
  flex: 1,
  ':focus': {
    outline: 'none',
    borderColor: tokens.color.border.focus,
  },
})

// Radio button styles for enum values
export const radioGroup = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space['2'],
  flex: 1,
})

export const radioLabel = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: tokens.space['1.5'],
  padding: `${tokens.space['1.5']} ${tokens.space['3']}`,
  backgroundColor: tokens.color.bg.base,
  border: `${tokens.borderWidth.thin} solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.default,
  cursor: 'pointer',
  fontSize: tokens.font.size.sm,
  transition: 'all 0.15s ease',
  ':hover': {
    borderColor: tokens.color.border.strong,
    backgroundColor: tokens.color.surface.hover,
  },
})

export const radioLabelSelected = style([
  radioLabel,
  {
    backgroundColor: tokens.color.accent.primary,
    borderColor: tokens.color.accent.primary,
    color: tokens.color.text.inverse,
    ':hover': {
      backgroundColor: tokens.color.accent.primaryHover,
      borderColor: tokens.color.accent.primaryHover,
    },
  },
])

export const radioInput = style({
  display: 'none',
})

// Boolean toggle styles
export const toggleContainer = style({
  display: 'flex',
  gap: tokens.space['2'],
  flex: 1,
})

export const toggleButton = style({
  padding: `${tokens.space['1.5']} ${tokens.space['3']}`,
  backgroundColor: tokens.color.bg.base,
  border: `${tokens.borderWidth.thin} solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.default,
  cursor: 'pointer',
  fontSize: tokens.font.size.sm,
  transition: 'all 0.15s ease',
  ':hover': {
    borderColor: tokens.color.border.strong,
    backgroundColor: tokens.color.surface.hover,
  },
})

export const toggleButtonSelected = style([
  toggleButton,
  {
    backgroundColor: tokens.color.accent.primary,
    borderColor: tokens.color.accent.primary,
    color: tokens.color.text.inverse,
    ':hover': {
      backgroundColor: tokens.color.accent.primaryHover,
      borderColor: tokens.color.accent.primaryHover,
    },
  },
])
