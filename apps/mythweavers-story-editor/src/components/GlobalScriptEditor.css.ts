import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const sectionTitle = style({
  margin: 0,
  fontSize: '1.1rem',
  color: tokens.color.text.primary,
})

export const description = style({
  margin: 0,
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
})

export const headerRow = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: tokens.space['2'],
})

// Plot Points Editor styles
export const plotPointsDescription = style({
  color: tokens.color.text.secondary,
  fontSize: tokens.font.size.sm,
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
})

export const plotPointKey = style({
  fontWeight: tokens.font.weight.semibold,
  minWidth: '150px',
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
})

export const addPlotPointContainer = style({
  display: 'flex',
  gap: tokens.space['2'],
  alignItems: 'flex-end',
  padding: tokens.space['3'],
  backgroundColor: tokens.color.bg.elevated,
  borderRadius: tokens.radius.default,
})

export const formField = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['1'],
  flex: 1,
})

export const formFieldSmall = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['1'],
})

export const formLabel = style({
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.muted,
})

export const input = style({
  padding: tokens.space['2'],
  border: `${tokens.borderWidth.thin} solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.default,
  backgroundColor: tokens.color.bg.base,
  color: tokens.color.text.primary,
  fontSize: tokens.font.size.sm,
  ':focus': {
    outline: 'none',
    borderColor: tokens.color.border.focus,
  },
})

export const select = style([
  input,
  {
    cursor: 'pointer',
  },
])

export const modalPadding = style({
  padding: tokens.space['4'],
})

export const tabPanelContent = style({
  paddingTop: tokens.space['4'],
})

export const buttonRow = style({
  display: 'flex',
  gap: tokens.space['2'],
})

export const buttonRowEnd = style({
  display: 'flex',
  gap: tokens.space['2'],
  justifyContent: 'flex-end',
})

export const codePreviewContainer = style({
  borderRadius: tokens.radius.default,
  overflow: 'hidden',
  maxHeight: '200px',
  overflowY: 'auto',
})

// Enum options styles
export const enumOptionsContainer = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['2'],
  flex: 1,
})

export const enumOptionsRow = style({
  display: 'flex',
  gap: tokens.space['2'],
  alignItems: 'center',
})

export const enumOptionsList = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space['1'],
})

export const enumOptionTag = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: tokens.space['1'],
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
  backgroundColor: tokens.color.surface.default,
  borderRadius: tokens.radius.default,
  fontSize: tokens.font.size.sm,
})

export const enumOptionRemove = style({
  cursor: 'pointer',
  color: tokens.color.text.muted,
  ':hover': {
    color: tokens.color.semantic.error,
  },
})

export const plotPointOptions = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space['1'],
  marginTop: tokens.space['1'],
})
