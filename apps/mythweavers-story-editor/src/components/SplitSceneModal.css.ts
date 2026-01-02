import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const modalContent = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['4'],
  maxHeight: '80vh',
  overflowY: 'auto',
})

export const sourceInfo = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: tokens.space['3'],
  padding: `${tokens.space['3']} ${tokens.space['4']}`,
  fontSize: tokens.font.size.sm,
  backgroundColor: tokens.color.bg.raised,
  borderRadius: tokens.radius.default,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
})

export const sourceInfoLabel = style({
  color: tokens.color.text.muted,
  flexShrink: 0,
})

export const sourceInfoValue = style({
  color: tokens.color.text.primary,
  fontWeight: tokens.font.weight.medium,
})

export const warningBox = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  padding: `${tokens.space['2']} ${tokens.space['3']}`,
  fontSize: tokens.font.size.sm,
  color: tokens.color.accent.primary,
  backgroundColor: tokens.color.bg.raised,
  borderRadius: tokens.radius.default,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
})

export const errorBox = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  padding: `${tokens.space['2']} ${tokens.space['3']}`,
  fontSize: tokens.font.size.sm,
  color: '#ef4444',
  backgroundColor: 'rgba(239, 68, 68, 0.1)',
  borderRadius: tokens.radius.default,
  border: `${tokens.borderWidth.default} solid rgba(239, 68, 68, 0.3)`,
})

export const loadingContainer = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: tokens.space['8'],
  gap: tokens.space['3'],
  color: tokens.color.text.secondary,
})

export const loadingStatus = style({
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.muted,
  textAlign: 'center',
})

export const tokenEstimate = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.muted,
  backgroundColor: tokens.color.bg.raised,
  borderRadius: tokens.radius.default,
})

export const actions = style({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: tokens.space['2'],
  paddingTop: tokens.space['2'],
  borderTop: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
})

export const proposedStructure = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['3'],
})

export const structureLabel = style({
  fontSize: tokens.font.size.sm,
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.primary,
  marginBottom: tokens.space['1'],
})

export const chapterNode = style({
  padding: tokens.space['3'],
  backgroundColor: tokens.color.bg.raised,
  borderRadius: tokens.radius.default,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
})

export const chapterTitle = style({
  fontSize: tokens.font.size.base,
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.primary,
  marginBottom: tokens.space['2'],
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
})

export const chapterIcon = style({
  color: tokens.color.text.muted,
  fontSize: '1rem',
})

export const scenesContainer = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['2'],
  marginLeft: tokens.space['4'],
})

export const sceneNode = style({
  padding: tokens.space['2'],
  backgroundColor: tokens.color.bg.base,
  borderRadius: tokens.radius.default,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
})

export const sceneTitle = style({
  fontSize: tokens.font.size.sm,
  fontWeight: tokens.font.weight.medium,
  color: tokens.color.text.primary,
  marginBottom: tokens.space['1'],
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
})

export const sceneIcon = style({
  color: tokens.color.text.muted,
  fontSize: '0.875rem',
})

export const messageAssignments = style({
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.muted,
  paddingLeft: tokens.space['4'],
})

export const messageAssignment = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['1'],
  padding: `${tokens.space['0.5']} 0`,
})

export const splitIndicator = style({
  color: tokens.color.accent.primary,
  fontWeight: tokens.font.weight.medium,
})

export const fullIndicator = style({
  color: tokens.color.text.secondary,
})
