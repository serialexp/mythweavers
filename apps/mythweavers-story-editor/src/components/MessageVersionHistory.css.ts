import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const titleRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
})

export const loadingContainer = style({
  padding: tokens.space['8'],
  textAlign: 'center',
  color: tokens.color.text.secondary,
})

export const loadingText = style({
  marginTop: tokens.space['2'],
})

export const container = style({
  display: 'flex',
  height: '60vh',
  overflow: 'hidden',
})

export const sidebar = style({
  width: '300px',
  borderRight: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  overflowY: 'auto',
  background: tokens.color.bg.raised,
})

export const sidebarHeader = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: tokens.space['4'],
  borderBottom: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  position: 'sticky',
  top: 0,
  background: tokens.color.bg.raised,
})

export const sidebarTitle = style({
  margin: 0,
  fontSize: tokens.font.size.base,
})

export const revisionCount = style({
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
})

export const emptyMessage = style({
  padding: tokens.space['4'],
  textAlign: 'center',
  color: tokens.color.text.secondary,
  fontSize: tokens.font.size.sm,
})

export const versionItem = style({
  padding: `${tokens.space['3']} ${tokens.space['4']}`,
  borderBottom: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  cursor: 'pointer',
  borderLeft: `3px solid transparent`,
  ':hover': {
    background: tokens.color.surface.hover,
  },
})

export const versionItemSelected = style({
  background: tokens.color.surface.selected,
  borderLeftColor: tokens.color.accent.primary,
})

export const versionItemHeader = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  marginBottom: tokens.space['1'],
})

export const versionIcon = style({
  display: 'flex',
  alignItems: 'center',
  color: tokens.color.text.secondary,
})

export const versionNumber = style({
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.primary,
})

export const versionDate = style({
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
})

export const contentArea = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
})

export const contentHeader = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: tokens.space['4'],
  borderBottom: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
})

export const contentTitle = style({
  margin: 0,
  fontSize: tokens.font.size.base,
})

export const contentBody = style({
  flex: 1,
  overflowY: 'auto',
  padding: tokens.space['4'],
})

export const instructionBox = style({
  padding: tokens.space['3'],
  background: tokens.color.bg.raised,
  borderRadius: tokens.radius.default,
  marginBottom: tokens.space['4'],
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
})

export const instructionLabel = style({
  color: tokens.color.text.primary,
})

export const contentText = style({
  whiteSpace: 'pre-wrap',
  wordWrap: 'break-word',
  lineHeight: tokens.font.lineHeight.relaxed,
  color: tokens.color.text.primary,
})

export const currentVersionNotice = style({
  padding: tokens.space['4'],
  background: tokens.color.surface.selected,
  borderRadius: tokens.radius.default,
  color: tokens.color.text.primary,
  marginBottom: tokens.space['4'],
})
