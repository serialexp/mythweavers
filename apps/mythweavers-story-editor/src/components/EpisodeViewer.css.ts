import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const dockedContent = style({
  background: tokens.color.bg.base,
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  borderLeft: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
})

export const header = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: tokens.space['5'],
  borderBottom: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
})

export const headerTitle = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  margin: 0,
  color: tokens.color.text.primary,
  fontSize: tokens.font.size['2xl'],
})

export const episodeSelector = style({
  padding: tokens.space['5'],
  borderBottom: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: tokens.space['4'],
})

export const episodeSelectorLabel = style({
  color: tokens.color.text.secondary,
  fontWeight: tokens.font.weight.medium,
})

export const scrollButtons = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space['2'],
  width: '100%',
})

export const selectionBar = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['4'],
  padding: `${tokens.space['4']} ${tokens.space['5']}`,
  background: tokens.color.bg.raised,
  borderBottom: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
})

export const selectionCount = style({
  color: tokens.color.text.secondary,
  fontSize: tokens.font.size.sm,
  fontWeight: tokens.font.weight.medium,
})

export const contentArea = style({
  flex: 1,
  overflowY: 'auto',
  padding: tokens.space['5'],
})

export const timeline = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['8'],
})

export const segmentItem = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['3'],
  padding: tokens.space['4'],
  background: tokens.color.bg.raised,
  borderRadius: tokens.radius.lg,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  marginBottom: tokens.space['4'],
  transition: `all ${tokens.duration.normal} ${tokens.easing.default}`,
})

export const segmentItemSelected = style({
  background: tokens.color.surface.selected,
  borderLeft: `3px solid ${tokens.color.accent.primary}`,
  paddingLeft: tokens.space['5'],
})

export const segmentHeader = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  width: '100%',
})

export const segmentCheckbox = style({
  width: '18px',
  height: '18px',
  cursor: 'pointer',
  accentColor: tokens.color.accent.primary,
  flexShrink: 0,
})

export const segmentTimestamp = style({
  fontWeight: tokens.font.weight.bold,
  color: tokens.color.text.secondary,
  fontSize: tokens.font.size.sm,
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['1'],
})

export const frameInfo = style({
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.muted,
  marginTop: tokens.space['1'],
})

export const frameInfoFaded = style({
  opacity: 0.7,
})

export const frameContainer = style({
  position: 'relative',
  background: '#000',
  borderRadius: tokens.radius.md,
  overflow: 'hidden',
})

export const frameImage = style({
  width: '100%',
  height: 'auto',
  display: 'block',
})

export const segmentVideo = style({
  width: '100%',
  height: 'auto',
  display: 'block',
  background: '#000',
})

export const videoErrorIndicator = style({
  position: 'absolute',
  top: tokens.space['2'],
  right: tokens.space['2'],
  width: '24px',
  height: '24px',
  background: 'rgba(0, 0, 0, 0.7)',
  color: tokens.color.semantic.warning,
  borderRadius: tokens.radius.full,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: tokens.font.size.sm,
  cursor: 'help',
  zIndex: 10,
})

export const frameIndicators = style({
  display: 'flex',
  justifyContent: 'center',
  gap: tokens.space['1'],
  marginTop: tokens.space['2'],
})

export const frameIndicator = style({
  width: '8px',
  height: '8px',
  borderRadius: tokens.radius.full,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  background: tokens.color.bg.base,
  cursor: 'pointer',
  transition: `background-color ${tokens.duration.slow} ${tokens.easing.default}`,
})

export const frameIndicatorActive = style({
  background: tokens.color.accent.primary,
})

export const transcriptContainer = style({
  padding: `${tokens.space['1']} 0`,
})

export const speaker = style({
  fontWeight: tokens.font.weight.bold,
  color: tokens.color.accent.primary,
  marginRight: tokens.space['2'],
})

export const text = style({
  color: tokens.color.text.primary,
})

export const loadingContainer = style({
  alignItems: 'center',
  padding: tokens.space['10'],
})

export const loadingText = style({
  color: tokens.color.text.secondary,
})
