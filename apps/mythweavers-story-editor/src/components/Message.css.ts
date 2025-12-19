import { style, keyframes } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

// Pulse animation for processing states
const pulse = keyframes({
  '0%, 100%': { opacity: 0.7 },
  '50%': { opacity: 0.4 },
})

// Base message container
export const message = style({
  position: 'relative',
  padding: tokens.space['4'],
  backgroundColor: tokens.color.bg.raised,
  borderRadius: tokens.radius.lg,
  whiteSpace: 'pre-wrap',
  wordWrap: 'break-word',
  overflowWrap: 'break-word',
  transition: `all ${tokens.duration.normal} ${tokens.easing.default}`,
})

// Message role variants
export const messageAssistant = style({
  borderLeft: `3px solid ${tokens.color.accent.primary}`,
})

export const messageInstruction = style({
  borderLeft: `3px solid ${tokens.color.semantic.warning}`,
  backgroundColor: tokens.color.bg.elevated,
})

export const messageQuery = style({
  borderLeft: '3px solid #9333ea',
  backgroundColor: 'rgba(147, 51, 234, 0.08)',
})

// Message state variants
export const messageSummarizing = style({
  borderLeftColor: tokens.color.semantic.info,
  animation: `${pulse} 1.5s ease-in-out infinite`,
})

export const messageAnalyzing = style({
  borderLeftColor: tokens.color.semantic.success,
  animation: `${pulse} 1.5s ease-in-out infinite`,
})

export const messageEvent = style({
  borderLeft: `3px solid ${tokens.color.semantic.success}`,
  backgroundColor: 'rgba(34, 197, 94, 0.08)',
})

export const messageCut = style({
  opacity: 0.5,
  border: `2px dashed ${tokens.color.semantic.warning}`,
  backgroundColor: 'rgba(245, 158, 11, 0.1)',
})

export const messageInactive = style({
  opacity: 0.4,
  filter: 'grayscale(0.3)',
})

// Content area
export const content = style({
  whiteSpace: 'pre-wrap',
  wordWrap: 'break-word',
  overflowWrap: 'break-word',
  lineHeight: tokens.font.lineHeight.normal,
  color: tokens.color.text.primary,
})

export const contentEditable = style({
  minHeight: '100px',
  padding: tokens.space['3'],
  backgroundColor: tokens.color.bg.base,
  borderRadius: tokens.radius.default,
  border: `1px solid ${tokens.color.accent.primary}`,
  outline: 'none',
})

// Actions bar
export const actions = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: tokens.space['2'],
  paddingTop: tokens.space['2'],
  borderTop: `1px solid ${tokens.color.border.default}`,
})

export const actionButtons = style({
  display: 'flex',
  gap: tokens.space['1'],
  alignItems: 'center',
})

// Timestamp and info
export const timestamp = style({
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.muted,
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['3'],
  flexWrap: 'wrap',
})

export const tokenInfo = style({
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.muted,
})

export const cacheHit = style({
  color: tokens.color.semantic.success,
  fontWeight: tokens.font.weight.medium,
})

// Summary section
export const summary = style({
  backgroundColor: tokens.color.bg.base,
  padding: tokens.space['3'],
  borderRadius: tokens.radius.md,
  border: `1px solid ${tokens.color.border.default}`,
})

export const summaryHeader = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: tokens.space['2'],
})

export const summaryTitle = style({
  fontSize: tokens.font.size.sm,
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.secondary,
})

export const summaryTabs = style({
  display: 'flex',
  gap: tokens.space['1'],
})

export const summaryTab = style({
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
  fontSize: tokens.font.size.xs,
  background: tokens.color.bg.raised,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.default,
  cursor: 'pointer',
  color: tokens.color.text.muted,
  transition: `all ${tokens.duration.normal} ${tokens.easing.default}`,
})

export const summaryTabActive = style({
  background: tokens.color.accent.primary,
  color: tokens.color.text.inverse,
  borderColor: tokens.color.accent.primary,
})

export const summaryContent = style({
  fontSize: tokens.font.size.base,
  color: tokens.color.text.secondary,
  lineHeight: tokens.font.lineHeight.normal,
})

export const summaryToggle = style({
  marginTop: tokens.space['2'],
})

// Event icon
export const eventIcon = style({
  fontSize: tokens.font.size.lg,
})

// Think section
export const thinkSection = style({
  marginTop: tokens.space['4'],
  padding: tokens.space['3'],
  backgroundColor: 'rgba(250, 204, 21, 0.1)',
  borderRadius: tokens.radius.md,
  border: '1px solid rgba(250, 204, 21, 0.3)',
})

export const thinkTitle = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.semantic.warning,
  marginBottom: tokens.space['2'],
})

export const thinkToggle = style({
  marginTop: tokens.space['2'],
  color: tokens.color.semantic.warning,
})

// Script mode section
export const scriptModeSection = style({
  marginTop: tokens.space['4'],
  padding: tokens.space['4'],
  backgroundColor: tokens.color.bg.base,
  borderRadius: tokens.radius.md,
  border: `1px solid ${tokens.color.border.default}`,
})

export const scriptCode = style({
  fontFamily: tokens.font.family.mono,
  fontSize: tokens.font.size.sm,
  whiteSpace: 'pre-wrap',
  wordWrap: 'break-word',
  color: tokens.color.text.secondary,
})

// Paste controls
export const pasteContainer = style({
  display: 'flex',
  justifyContent: 'center',
  padding: tokens.space['2'],
})

export const pasteButton = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  padding: `${tokens.space['2']} ${tokens.space['4']}`,
  fontSize: tokens.font.size.sm,
  background: tokens.color.bg.raised,
  border: `2px dashed ${tokens.color.accent.primary}`,
  borderRadius: tokens.radius.lg,
  cursor: 'pointer',
  color: tokens.color.accent.primary,
  transition: `all ${tokens.duration.normal} ${tokens.easing.default}`,
})

// Draft saved indicator
export const draftSaved = style({
  color: tokens.color.semantic.warning,
  marginLeft: tokens.space['2'],
  fontWeight: tokens.font.weight.bold,
})

// Order highlight
export const orderHighlight = style({
  color: tokens.color.accent.primary,
  fontWeight: tokens.font.weight.bold,
})
