import { keyframes, style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const container = style({
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  backgroundColor: tokens.color.bg.base,
  color: tokens.color.text.primary,
})

export const header = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `${tokens.space['2']} ${tokens.space['4']}`,
  backgroundColor: tokens.color.bg.raised,
  borderBottom: `1px solid ${tokens.color.border.default}`,
  flexShrink: 0,
})

export const headerLeft = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['3'],
})

export const headerRight = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],

  '@media': {
    '(max-width: 640px)': {
      display: 'none',
    },
  },
})

export const menuToggle = style({
  display: 'none',
  background: 'none',
  border: 'none',
  color: tokens.color.text.primary,
  fontSize: '1.4rem',
  cursor: 'pointer',
  padding: tokens.space['1'],
  lineHeight: 1,

  '@media': {
    '(max-width: 640px)': {
      display: 'block',
    },
  },
})

export const mobileMenu = style({
  display: 'none',

  '@media': {
    '(max-width: 640px)': {
      display: 'flex',
      flexDirection: 'column',
      gap: tokens.space['2'],
      padding: `${tokens.space['2']} ${tokens.space['4']}`,
      backgroundColor: tokens.color.bg.raised,
      borderBottom: `1px solid ${tokens.color.border.default}`,
      flexShrink: 0,
    },
  },
})

export const mobileMenuRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: tokens.space['2'],
})

export const mobileMenuActions = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space['2'],
})

export const title = style({
  fontSize: '1.25rem',
  fontWeight: 600,
  margin: 0,
  color: tokens.color.text.primary,
})

export const modelInfo = style({
  fontSize: '0.8rem',
  color: tokens.color.text.muted,
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
  backgroundColor: tokens.color.bg.base,
  borderRadius: tokens.radius.sm,
})

const pulseAnimation = keyframes({
  '0%, 100%': { opacity: 1 },
  '50%': { opacity: 0.4 },
})

export const directorIndicator = style({
  animation: `${pulseAnimation} 2s ease-in-out infinite`,
  cursor: 'default',
})

// cacheDots styles live in LlmCacheDots.css.ts

// Compaction block
export const compactionBlock = style({
  marginBottom: tokens.space['4'],
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
  overflow: 'hidden',
})

export const compactionHeader = style({
  padding: `${tokens.space['3']} ${tokens.space['4']}`,
  background: tokens.color.bg.raised,
  cursor: 'pointer',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
  userSelect: 'none',
  ':hover': {
    background: tokens.color.bg.elevated,
  },
})

export const compactionSummary = style({
  padding: `${tokens.space['3']} ${tokens.space['4']}`,
  borderTop: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  lineHeight: '1.6',
  color: tokens.color.text.secondary,
  fontStyle: 'italic',
  fontSize: tokens.font.size.sm,
  whiteSpace: 'pre-wrap',
})

export const compactionOriginal = style({
  padding: `${tokens.space['3']} ${tokens.space['4']}`,
  borderTop: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  maxHeight: '400px',
  overflowY: 'auto',
})

export const compactionOriginalLabel = style({
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.muted,
  marginBottom: tokens.space['2'],
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
})

export const compactionPending = style({
  fontSize: tokens.font.size.xs,
  color: 'var(--warning-color, #ffc107)',
})

// Story area
export const storyArea = style({
  flex: 1,
  overflowY: 'auto',
  padding: `${tokens.space['4']} ${tokens.space['6']}`,
  maxWidth: '800px',
  width: '100%',
  margin: '0 auto',
  boxSizing: 'border-box',
})

const fadeIn = keyframes({
  from: { opacity: 0.7 },
  to: { opacity: 1 },
})

export const turn = style({
  marginBottom: tokens.space['6'],
  animation: `${fadeIn} 0.2s ease-out`,
})

export const turnFooter = style({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: tokens.space['2'],
})

export const rewindButton = style({
  fontSize: '0.75rem',
  color: tokens.color.text.muted,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
  borderRadius: tokens.radius.sm,
  whiteSpace: 'nowrap',
  flexShrink: 0,

  ':hover': {
    color: tokens.color.text.secondary,
    backgroundColor: tokens.color.surface.hover,
  },
})

// Nonsense warning
export const nonsenseWarning = style({
  margin: `${tokens.space['4']} 0`,
  padding: tokens.space['4'],
  borderRadius: tokens.radius.md,
  border: `1px solid var(--warning-color, #ffc107)`,
  backgroundColor: 'color-mix(in srgb, var(--warning-color, #ffc107) 8%, transparent)',
})

export const nonsenseWarningHeader = style({
  fontWeight: tokens.font.weight.semibold,
  marginBottom: tokens.space['2'],
  color: 'var(--warning-color, #ffc107)',
})

export const nonsenseWarningContent = style({
  fontSize: tokens.font.size.sm,
  lineHeight: '1.6',
  whiteSpace: 'pre-wrap',
  color: tokens.color.text.secondary,
  marginBottom: tokens.space['3'],
})

export const nonsenseWarningActions = style({
  display: 'flex',
  gap: tokens.space['2'],
})

export const deathScreen = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: tokens.space['3'],
  padding: `${tokens.space['8']} ${tokens.space['4']}`,
  textAlign: 'center',
  animation: `${fadeIn} 0.5s ease-out`,
})

export const deathIcon = style({
  fontSize: '3rem',
  lineHeight: 1,
})

export const deathActions = style({
  display: 'flex',
  gap: tokens.space['3'],
  marginTop: tokens.space['2'],
})

export const playerAction = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: tokens.space['2'],
  marginBottom: tokens.space['3'],
  padding: `${tokens.space['2']} ${tokens.space['3']}`,
  backgroundColor: tokens.color.bg.base,
  borderRadius: tokens.radius.md,
  borderLeft: `3px solid ${tokens.color.accent.primary}`,
  fontStyle: 'italic',
  color: tokens.color.text.secondary,
  fontSize: '0.95rem',
})

export const playerActionLabel = style({
  color: tokens.color.accent.primary,
  fontWeight: 600,
  fontStyle: 'normal',
  whiteSpace: 'nowrap',
})

export const editActionButton = style({
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: `0 ${tokens.space['1']}`,
  fontSize: tokens.font.size.xs,
  opacity: 0,
  transition: `opacity ${tokens.duration.fast} ${tokens.easing.default}`,
  marginLeft: 'auto',
  flexShrink: 0,
  selectors: {
    [`${playerAction}:hover &`]: {
      opacity: 0.7,
    },
    '&:hover': {
      opacity: '1 !important' as string,
    },
  },
})

export const playerActionEdit = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['2'],
  marginBottom: tokens.space['3'],
  padding: `${tokens.space['2']} ${tokens.space['3']}`,
  backgroundColor: tokens.color.bg.base,
  borderRadius: tokens.radius.md,
  borderLeft: `3px solid ${tokens.color.accent.primary}`,
})

export const playerActionTextarea = style({
  width: '100%',
  padding: tokens.space['2'],
  backgroundColor: tokens.color.bg.raised,
  color: tokens.color.text.primary,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  fontFamily: 'inherit',
  fontSize: 'inherit',
  resize: 'vertical',
  boxSizing: 'border-box',
  ':focus': {
    outline: 'none',
    borderColor: tokens.color.accent.primary,
  },
})

export const playerActionEditButtons = style({
  display: 'flex',
  gap: tokens.space['2'],
  justifyContent: 'flex-end',
})

export const narrative = style({})

export const narrativeParagraph = style({
  margin: `0 0 ${tokens.space['3']} 0`,
  lineHeight: 1.75,
  fontSize: '1.05rem',
  color: tokens.color.text.primary,

  selectors: {
    '&:last-child': {
      marginBottom: 0,
    },
  },
})

export const worldTrajectory = style({
  marginTop: tokens.space['3'],
  padding: `${tokens.space['2']} ${tokens.space['3']}`,
  backgroundColor: tokens.color.bg.raised,
  borderRadius: tokens.radius.sm,
  borderLeft: `3px solid ${tokens.color.semantic.warning}`,
  fontSize: '0.85rem',
  color: tokens.color.text.muted,
  cursor: 'pointer',
  userSelect: 'none',
  transition: `background-color ${tokens.duration.fast} ${tokens.easing.default}`,

  ':hover': {
    backgroundColor: tokens.color.surface.hover,
  },
})

export const worldTrajectoryLabel = style({
  fontWeight: 600,
  color: tokens.color.semantic.warning,
  fontSize: '0.8rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: tokens.space['1'],
})

export const worldTrajectoryContent = style({
  lineHeight: 1.5,
  color: tokens.color.text.secondary,
  whiteSpace: 'pre-wrap',
})

// Streaming
const pulse = keyframes({
  '0%, 100%': { opacity: 0.3 },
  '50%': { opacity: 1 },
})

export const streamingIndicator = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  padding: tokens.space['3'],
  color: tokens.color.text.muted,
  fontStyle: 'italic',
})

export const streamingDot = style({
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  backgroundColor: tokens.color.accent.primary,
  animation: `${pulse} 1.2s ease-in-out infinite`,
})

export const streamingContent = style({
  marginBottom: tokens.space['3'],
})

export const streamingParagraph = style({
  margin: `0 0 ${tokens.space['3']} 0`,
  lineHeight: 1.75,
  fontSize: '1.05rem',
  color: tokens.color.text.primary,
})

// Scroll indicator
export const scrollToBottom = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: tokens.space['1'],
  width: '100%',
  padding: `${tokens.space['1']} 0`,
  background: tokens.color.bg.raised,
  borderTop: `1px solid ${tokens.color.border.default}`,
  color: tokens.color.accent.primary,
  fontSize: '0.8rem',
  fontWeight: 500,
  border: 'none',
  cursor: 'pointer',
  flexShrink: 0,
  transition: `background ${tokens.duration.fast} ${tokens.easing.default}`,

  ':hover': {
    backgroundColor: tokens.color.surface.hover,
  },
})

// Input area
export const inputArea = style({
  flexShrink: 0,
  padding: `${tokens.space['3']} ${tokens.space['4']}`,
  backgroundColor: tokens.color.bg.raised,
  borderTop: `1px solid ${tokens.color.border.default}`,
})

export const inputWrapper = style({
  display: 'flex',
  gap: tokens.space['2'],
  maxWidth: '800px',
  margin: '0 auto',
})

export const input = style({
  flex: 1,
  padding: `${tokens.space['2']} ${tokens.space['3']}`,
  backgroundColor: tokens.color.bg.base,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
  color: tokens.color.text.primary,
  fontFamily: 'inherit',
  fontSize: '1rem',
  resize: 'none',
  minHeight: '44px',
  maxHeight: '120px',
  transition: `border-color ${tokens.duration.fast} ${tokens.easing.default}`,

  ':focus': {
    outline: 'none',
    borderColor: tokens.color.border.focus,
  },

  '::placeholder': {
    color: tokens.color.text.muted,
  },

  ':disabled': {
    opacity: 0.5,
  },
})

// Setup screen
export const setupContainer = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 1,
  padding: tokens.space['6'],
  overflowY: 'auto',
})

export const setupCard = style({
  backgroundColor: tokens.color.bg.raised,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.lg,
  padding: tokens.space['6'],
  maxWidth: '600px',
  width: '100%',
  boxShadow: tokens.shadow.lg,
})

export const setupTitle = style({
  fontSize: '1.5rem',
  fontWeight: 700,
  margin: `0 0 ${tokens.space['1']} 0`,
  color: tokens.color.text.primary,
})

export const setupSubtitle = style({
  color: tokens.color.text.muted,
  margin: `0 0 ${tokens.space['4']} 0`,
  fontSize: '0.95rem',
  lineHeight: 1.5,
})

export const formGroup = style({
  marginBottom: tokens.space['3'],
})

export const formLabel = style({
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: tokens.color.text.secondary,
  marginBottom: tokens.space['1'],
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
})

export const formInput = style({
  width: '100%',
  padding: `${tokens.space['2']} ${tokens.space['3']}`,
  backgroundColor: tokens.color.bg.base,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
  color: tokens.color.text.primary,
  fontFamily: 'inherit',
  fontSize: '0.95rem',
  boxSizing: 'border-box',

  ':focus': {
    outline: 'none',
    borderColor: tokens.color.border.focus,
  },

  '::placeholder': {
    color: tokens.color.text.muted,
  },
})

export const formTextarea = style({
  width: '100%',
  padding: `${tokens.space['2']} ${tokens.space['3']}`,
  backgroundColor: tokens.color.bg.base,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
  color: tokens.color.text.primary,
  fontFamily: 'inherit',
  fontSize: '0.95rem',
  boxSizing: 'border-box',
  minHeight: '100px',
  resize: 'vertical',

  ':focus': {
    outline: 'none',
    borderColor: tokens.color.border.focus,
  },

  '::placeholder': {
    color: tokens.color.text.muted,
  },
})

export const errorRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: tokens.space['3'],
  padding: tokens.space['3'],
})

export const errorText = style({
  color: tokens.color.semantic.error,
  fontSize: '0.9rem',
})

export const emptyState = style({
  textAlign: 'center',
  padding: tokens.space['6'],
  color: tokens.color.text.muted,
})

export const emptyStateIcon = style({
  fontSize: '3rem',
  marginBottom: tokens.space['3'],
})

export const emptyStateText = style({
  fontSize: '1.1rem',
  lineHeight: 1.5,
})

// Setting generator
export const settingGenerator = style({
  marginBottom: tokens.space['3'],
})

export const generateRow = style({
  display: 'flex',
  gap: tokens.space['2'],
  alignItems: 'center',
})

export const knobsToggle = style({
  fontSize: '0.8rem',
  color: tokens.color.text.muted,
  cursor: 'pointer',
  userSelect: 'none',
  background: 'none',
  border: 'none',
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
  borderRadius: tokens.radius.sm,
  transition: `color ${tokens.duration.fast} ${tokens.easing.default}`,

  ':hover': {
    color: tokens.color.text.secondary,
  },
})

export const knobsPanel = style({
  marginTop: tokens.space['2'],
  padding: tokens.space['3'],
  backgroundColor: tokens.color.bg.base,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['2'],
})

export const knobRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
})

export const knobLabel = style({
  fontSize: '0.75rem',
  fontWeight: 600,
  color: tokens.color.text.secondary,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  width: '80px',
  flexShrink: 0,
})

export const knobSelect = style({
  flex: 1,
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
  backgroundColor: tokens.color.bg.base,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  color: tokens.color.text.primary,
  fontSize: '0.85rem',
  cursor: 'pointer',

  ':focus': {
    outline: 'none',
    borderColor: tokens.color.border.focus,
  },

  ':disabled': {
    opacity: 0.5,
  },
})

export const lockButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  padding: 0,
  background: 'none',
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  cursor: 'pointer',
  fontSize: '0.85rem',
  flexShrink: 0,
  transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,

  ':hover': {
    backgroundColor: tokens.color.surface.hover,
  },
})

export const lockButtonLocked = style({
  borderColor: tokens.color.accent.primary,
  color: tokens.color.accent.primary,
})

// Directive
export const directiveToggle = style({
  fontSize: '0.8rem',
  color: tokens.color.text.muted,
  cursor: 'pointer',
  userSelect: 'none',
  background: 'none',
  border: 'none',
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
  borderRadius: tokens.radius.sm,
  transition: `color ${tokens.duration.fast} ${tokens.easing.default}`,

  ':hover': {
    color: tokens.color.text.secondary,
  },
})

export const directivePanel = style({
  padding: tokens.space['3'],
  backgroundColor: tokens.color.bg.base,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
  marginTop: tokens.space['2'],
})

export const directiveTextarea = style({
  width: '100%',
  padding: `${tokens.space['2']} ${tokens.space['3']}`,
  backgroundColor: tokens.color.bg.base,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
  color: tokens.color.text.primary,
  fontFamily: 'inherit',
  fontSize: '0.85rem',
  boxSizing: 'border-box',
  minHeight: '80px',
  resize: 'vertical',
  lineHeight: 1.5,

  ':focus': {
    outline: 'none',
    borderColor: tokens.color.border.focus,
  },

  '::placeholder': {
    color: tokens.color.text.muted,
  },
})

export const directiveHint = style({
  fontSize: '0.75rem',
  color: tokens.color.text.muted,
  marginTop: tokens.space['1'],
  lineHeight: 1.4,
})

export const directorNotesContent = style({
  fontSize: '0.85rem',
  lineHeight: 1.6,
  color: tokens.color.text.secondary,
  whiteSpace: 'pre-wrap',
  padding: `${tokens.space['2']} ${tokens.space['3']}`,
  backgroundColor: tokens.color.bg.base,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
  maxHeight: '300px',
  overflowY: 'auto',
  width: '100%',
  fontFamily: 'inherit',
  resize: 'vertical',
  boxSizing: 'border-box',
  ':focus': {
    outline: 'none',
    borderColor: tokens.color.border.focus,
  },
})

export const headerDirectivePanel = style({
  padding: `${tokens.space['2']} ${tokens.space['4']}`,
  backgroundColor: tokens.color.bg.raised,
  borderBottom: `1px solid ${tokens.color.border.default}`,
  flexShrink: 0,
  maxWidth: '800px',
  width: '100%',
  margin: '0 auto',
  boxSizing: 'border-box',
})
