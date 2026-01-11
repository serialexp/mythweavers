import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const modalContent = style({
  padding: tokens.space['6'],
  overflowY: 'auto',
  flex: 1,
})

export const tabPanelContent = style({
  paddingTop: tokens.space['4'],
})

export const description = style({
  margin: `0 0 ${tokens.space['4']} 0`,
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
})

export const helpSection = style({
  marginBottom: tokens.space['4'],
  padding: tokens.space['3'],
  backgroundColor: tokens.color.bg.raised,
  borderRadius: tokens.radius.default,
  border: `${tokens.borderWidth.thin} solid ${tokens.color.border.default}`,
})

export const helpTitle = style({
  margin: `0 0 ${tokens.space['2']} 0`,
  fontSize: tokens.font.size.sm,
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.primary,
})

export const helpGrid = style({
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gap: `${tokens.space['1']} ${tokens.space['3']}`,
  alignItems: 'center',
})

export const helpCode = style({
  fontFamily: tokens.font.family.mono,
  fontSize: tokens.font.size.xs,
  color: tokens.color.accent.primary,
  backgroundColor: tokens.color.bg.elevated,
  padding: `${tokens.space['0.5']} ${tokens.space['1.5']}`,
  borderRadius: tokens.radius.default,
})

export const helpDesc = style({
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.muted,
})

export const helpCard = style({
  marginTop: tokens.space['2'],
})

export const buttonRow = style({
  display: 'flex',
  gap: tokens.space['2'],
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
  maxHeight: '200px',
  overflowY: 'auto',
})

export const footer = style({
  display: 'flex',
  gap: tokens.space['2'],
  justifyContent: 'flex-end',
  padding: `${tokens.space['4']} ${tokens.space['6']}`,
  borderTop: `${tokens.borderWidth.thin} solid ${tokens.color.border.default}`,
})

// Inventory Actions Editor styles
export const actionsList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['2'],
})

export const actionRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  padding: tokens.space['2'],
  backgroundColor: tokens.color.bg.raised,
  borderRadius: tokens.radius.default,
  border: `${tokens.borderWidth.thin} solid ${tokens.color.border.default}`,
})

export const actionTypeAdd = style({
  fontWeight: tokens.font.weight.bold,
  color: tokens.color.semantic.success,
  fontSize: tokens.font.size.lg,
  width: '20px',
  textAlign: 'center',
})

export const actionTypeRemove = style({
  fontWeight: tokens.font.weight.bold,
  color: tokens.color.semantic.error,
  fontSize: tokens.font.size.lg,
  width: '20px',
  textAlign: 'center',
})

export const actionAmount = style({
  fontFamily: tokens.font.family.mono,
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
  minWidth: '40px',
})

export const actionItem = style({
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.primary,
  flex: 1,
})

export const actionArrow = style({
  color: tokens.color.text.muted,
})

export const actionCharacter = style({
  color: tokens.color.accent.primary,
  fontStyle: 'italic',
})

export const addActionForm = style({
  padding: tokens.space['4'],
  backgroundColor: tokens.color.bg.raised,
  borderRadius: tokens.radius.default,
  border: `${tokens.borderWidth.thin} solid ${tokens.color.border.default}`,
})

export const formTitle = style({
  margin: `0 0 ${tokens.space['3']} 0`,
  fontSize: tokens.font.size.sm,
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.primary,
})

export const formRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  marginBottom: tokens.space['2'],
})

export const formLabel = style({
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
  minWidth: '80px',
})

export const input = style({
  flex: 1,
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

export const inputSmall = style({
  width: '80px',
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

export const toggleContainer = style({
  display: 'flex',
  gap: tokens.space['2'],
})

export const toggleButton = style({
  padding: `${tokens.space['1.5']} ${tokens.space['3']}`,
  backgroundColor: tokens.color.bg.base,
  border: `${tokens.borderWidth.thin} solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.default,
  cursor: 'pointer',
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.primary,
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
