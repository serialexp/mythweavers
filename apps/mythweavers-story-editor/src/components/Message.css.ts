import { style, keyframes } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

// Spin animation for processing border gradient
const spinGradient = keyframes({
  '0%': { transform: 'translate(-50%, -50%) rotate(0deg)' },
  '100%': { transform: 'translate(-50%, -50%) rotate(360deg)' },
})

// Base message container
export const message = style({
  position: 'relative',
  backgroundColor: tokens.color.bg.raised,
  borderRadius: tokens.radius.lg,
  whiteSpace: 'pre-wrap',
  wordWrap: 'break-word',
  overflowWrap: 'break-word',
  transition: `all ${tokens.duration.normal} ${tokens.easing.default}`,
})

// Message role variants
export const messageAssistant = style({
  // Subdued brown border for story content - lets paragraph status borders stand out
  borderLeft: `3px solid ${tokens.color.border.strong}`,
  // Small top padding so rounded border corner is visible
  paddingTop: tokens.space['2'],
})

export const messageInstruction = style({
  // Gold border for instructions - distinct from paragraph draft state (orange)
  borderLeft: `3px solid ${tokens.color.accent.primary}`,
  backgroundColor: tokens.color.bg.elevated,
  // Instructions keep normal padding since they don't have paragraph state borders
  padding: tokens.space['4'],
})

export const messageQuery = style({
  borderLeft: '3px solid #9333ea',
  backgroundColor: 'rgba(147, 51, 234, 0.08)',
  padding: tokens.space['4'],
})

// Message state variants with spinning gradient border
// Use max(width%, height-estimate) to ensure the spinning square covers tall messages
// vmax ensures it's at least as large as the larger viewport dimension
export const messageSummarizing = style({
  overflow: 'hidden',
  isolation: 'isolate',

  // Spinning gradient layer
  '::before': {
    content: '""',
    position: 'absolute',
    aspectRatio: '1',
    // Use 300% width + vmax to handle both wide and tall messages
    width: 'max(300%, 150vmax)',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    background: `conic-gradient(
      from 0deg,
      ${tokens.color.semantic.info},
      ${tokens.color.border.default},
      ${tokens.color.accent.primary},
      ${tokens.color.border.default},
      ${tokens.color.semantic.info}
    )`,
    animation: `${spinGradient} 8s linear infinite`,
    zIndex: -2,
  },

  // Inner background that covers the gradient except at edges
  '::after': {
    content: '""',
    position: 'absolute',
    inset: '2px',
    borderRadius: `calc(${tokens.radius.lg} - 2px)`,
    backgroundColor: tokens.color.bg.raised,
    zIndex: -1,
  },
})

export const messageAnalyzing = style({
  overflow: 'hidden',
  isolation: 'isolate',

  // Spinning gradient layer
  '::before': {
    content: '""',
    position: 'absolute',
    aspectRatio: '1',
    // Use 300% width + vmax to handle both wide and tall messages
    width: 'max(300%, 150vmax)',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    background: `conic-gradient(
      from 0deg,
      ${tokens.color.semantic.success},
      ${tokens.color.border.default},
      ${tokens.color.accent.primary},
      ${tokens.color.border.default},
      ${tokens.color.semantic.success}
    )`,
    animation: `${spinGradient} 8s linear infinite`,
    zIndex: -2,
  },

  // Inner background that covers the gradient except at edges
  '::after': {
    content: '""',
    position: 'absolute',
    inset: '2px',
    borderRadius: `calc(${tokens.radius.lg} - 2px)`,
    backgroundColor: tokens.color.bg.raised,
    zIndex: -1,
  },
})

export const messageEvent = style({
  borderLeft: `3px solid ${tokens.color.semantic.success}`,
  backgroundColor: 'rgba(34, 197, 94, 0.08)',
  padding: tokens.space['4'],
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
  // Negative margin to overlay paragraph state borders with message border
  marginLeft: '-3px',
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
  padding: tokens.space['4'],
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
  display: 'block',
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
