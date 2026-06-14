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
    '(max-width: 1024px)': {
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
    '(max-width: 1024px)': {
      display: 'block',
    },
  },
})

export const mobileMenu = style({
  display: 'none',

  '@media': {
    '(max-width: 1024px)': {
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

/**
 * Pass 2 (world step) turns sit visually joined to the preceding resolution
 * turn — tighter top margin, subtle left accent, faint background tint.
 */
export const worldStepTurn = style({
  marginTop: `calc(${tokens.space['6']} * -0.5)`,
  marginBottom: tokens.space['6'],
  paddingLeft: tokens.space['3'],
  borderLeft: `2px solid ${tokens.color.border.default}`,
  animation: `${fadeIn} 0.2s ease-out`,
})

export const worldStepChip = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: tokens.space['2'],
  fontSize: '0.7rem',
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: tokens.color.text.muted,
  marginBottom: tokens.space['2'],
})

export const worldStepChipAuto = style({
  opacity: 0.55,
})

/**
 * Collapsed disclosure shown under a turn's narrative when the two-model
 * (director → writer) flow produced a brief for that turn. Lets the
 * author audit the plan against the prose when the prose drifts.
 *
 * Built on a native <details> element — no JS state, accessible by
 * default. Closed by default so the brief never competes visually with
 * the narrative itself.
 */
export const directorBrief = style({
  marginTop: tokens.space['2'],
  marginBottom: tokens.space['2'],
  fontSize: '0.85rem',
  color: tokens.color.text.muted,
  borderLeft: `2px solid ${tokens.color.border.default}`,
  paddingLeft: tokens.space['3'],

  selectors: {
    '&[open]': {
      paddingBottom: tokens.space['2'],
    },
  },
})

export const directorBriefSummary = style({
  cursor: 'pointer',
  userSelect: 'none',
  fontSize: '0.75rem',
  fontWeight: 600,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  color: tokens.color.text.muted,
  paddingTop: tokens.space['1'],
  paddingBottom: tokens.space['1'],

  selectors: {
    '&:hover': {
      color: tokens.color.text.primary,
    },
  },
})

export const directorBriefBody = style({
  margin: 0,
  marginTop: tokens.space['2'],
  whiteSpace: 'pre-wrap',
  fontFamily: 'inherit',
  fontSize: '0.85rem',
  lineHeight: 1.5,
  color: tokens.color.text.muted,
})

/**
 * Tiny inline indicator shown on each turn that had a steering roll.
 * Lets the writer eyeball whether the rolled bucket lined up with the
 * narrative the model produced. Hidden from players in the reader, only
 * visible in the editor's adventure mode.
 */
export const steeringChip = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: tokens.space['1'],
  fontSize: '0.65rem',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
  borderRadius: tokens.radius.sm,
  marginBottom: tokens.space['2'],
  border: `1px solid ${tokens.color.border.default}`,
  backgroundColor: tokens.color.surface.default,
  color: tokens.color.text.muted,
})

export const steeringChipWell = style({
  borderColor: '#3a8a3a',
  color: '#3a8a3a',
})

export const steeringChipSteady = style({
  borderColor: tokens.color.border.default,
  color: tokens.color.text.muted,
})

export const steeringChipWorse = style({
  borderColor: '#b87333',
  color: '#b87333',
})

export const steeringChipHell = style({
  borderColor: '#a83232',
  color: '#a83232',
})

/**
 * Chip that displays the deuteragonist's intended action for a turn.
 * Uses a purple/violet accent to distinguish from the blue player-action
 * block and the green/orange/red steering chips.
 */
export const partnerActionChip = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: tokens.space['1'],
  fontSize: '0.65rem',
  fontWeight: 600,
  letterSpacing: '0.04em',
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
  borderRadius: tokens.radius.sm,
  marginBottom: tokens.space['2'],
  border: `1px solid #8b5cf6`,
  backgroundColor: 'color-mix(in srgb, #8b5cf6 6%, transparent)',
  color: '#8b5cf6',
})

export const partnerActionLabel = style({
  fontWeight: 700,
  marginRight: tokens.space['1'],
})

export const partySplitLabel = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['1'],
  fontSize: '0.8rem',
  color: tokens.color.text.muted,
  cursor: 'pointer',
  marginTop: tokens.space['2'],
  userSelect: 'none',
})

/* ── Split-party tabbed narrative ── */

export const splitNarrative = style({
  marginTop: tokens.space['2'],
})

export const splitTabs = style({
  display: 'flex',
  gap: 0,
  borderBottom: `1px solid ${tokens.color.border.default}`,
  marginBottom: tokens.space['3'],
})

export const splitTab = style({
  padding: `${tokens.space['1']} ${tokens.space['3']}`,
  fontSize: '0.8rem',
  fontWeight: 500,
  color: tokens.color.text.muted,
  background: 'none',
  border: 'none',
  borderBottom: '2px solid transparent',
  cursor: 'pointer',
  transition: 'color 0.15s, border-color 0.15s',
  ':hover': {
    color: tokens.color.text.primary,
  },
})

export const splitTabActive = style({
  padding: `${tokens.space['1']} ${tokens.space['3']}`,
  fontSize: '0.8rem',
  fontWeight: 600,
  color: tokens.color.text.primary,
  background: 'none',
  border: 'none',
  borderBottom: `2px solid ${tokens.color.accent.primary}`,
  cursor: 'pointer',
})

export const splitTabContent = style({
  // Same spacing as a normal narrative block
})

/* Deuteragonist streaming label — shown above the streaming content when
   the deuteragonist's solo narrative is being generated. */
export const deuteragonistStreamLabel = style({
  fontSize: '0.75rem',
  fontWeight: 600,
  color: '#8b5cf6',
  letterSpacing: '0.04em',
  marginBottom: tokens.space['2'],
})

/** Small checkbox label in the input area — toggles whether the partner
 *  acts this turn. Only visible when a deuteragonist is configured. */
export const deuteragonistActiveLabel = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['1'],
  fontSize: '0.7rem',
  color: tokens.color.text.muted,
  cursor: 'pointer',
  userSelect: 'none',
  whiteSpace: 'nowrap',
  padding: `${tokens.space['1']} 0`,
  maxWidth: '800px',
  margin: '0 auto',
  width: '100%',
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

/**
 * Inline streaming cursor: a thin pulsing glyph appended after the last
 * word of the streaming text. Inline-block + zero structural height so it
 * doesn't change the surrounding paragraph's box — the streaming block
 * and the committed-turn block end up the same height, and the swap on
 * finalize is visually seamless.
 */
export const streamingCursor = style({
  display: 'inline-block',
  marginLeft: '2px',
  color: tokens.color.accent.primary,
  animation: `${pulse} 1.2s ease-in-out infinite`,
  // Match surrounding text's vertical metrics so layout doesn't shift.
  verticalAlign: 'baseline',
  // Tighter than a full character — just a marker.
  fontWeight: 600,
  userSelect: 'none',
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

export const storyPanelSection = style({
  paddingTop: tokens.space['3'],
  selectors: {
    '&:first-child': {
      paddingTop: 0,
    },
    '& + &': {
      marginTop: tokens.space['3'],
      borderTop: `1px solid ${tokens.color.border.default}`,
    },
  },
})

// A dependent sub-setting: indented and marked with a left accent rule so it
// reads as nested under the setting it hangs off (e.g. storyline-gate under
// living world).
export const storyPanelSubSection = style({
  marginLeft: tokens.space['4'],
  paddingLeft: tokens.space['3'],
  borderLeft: `2px solid ${tokens.color.border.default}`,
})

export const storyPanelSectionHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: tokens.space['1'],
})

// --- World panel (characters / plot points / agenda) ---

export const worldPanelEmpty = style({
  fontSize: '0.8rem',
  color: tokens.color.text.muted,
  fontStyle: 'italic',
  padding: `${tokens.space['2']} 0`,
})

export const worldPanelList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['2'],
  marginTop: tokens.space['2'],
})

export const worldPanelCard = style({
  backgroundColor: tokens.color.bg.base,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
  padding: tokens.space['2'],
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['1'],
})

export const worldPanelCardArchived = style({
  opacity: 0.55,
})

export const worldPanelCardHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: tokens.space['2'],
})

export const worldPanelCardTitle = style({
  flex: 1,
  fontSize: '0.9rem',
  fontWeight: 600,
  color: tokens.color.text.primary,
  border: '1px solid transparent',
  backgroundColor: 'transparent',
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
  borderRadius: tokens.radius.sm,
  fontFamily: 'inherit',
  ':focus': {
    outline: 'none',
    borderColor: tokens.color.border.focus,
    backgroundColor: tokens.color.bg.raised,
  },
})

export const worldPanelCardActions = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['1'],
})

export const worldPanelField = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['1'],
})

export const worldPanelFieldLabel = style({
  fontSize: '0.7rem',
  fontWeight: 600,
  color: tokens.color.text.muted,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
})

export const worldPanelFieldInput = style({
  width: '100%',
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
  backgroundColor: tokens.color.bg.raised,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  color: tokens.color.text.primary,
  fontFamily: 'inherit',
  fontSize: '0.85rem',
  boxSizing: 'border-box',
  ':focus': {
    outline: 'none',
    borderColor: tokens.color.border.focus,
  },
  '::placeholder': {
    color: tokens.color.text.muted,
  },
})

export const worldPanelFieldTextarea = style({
  width: '100%',
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
  backgroundColor: tokens.color.bg.raised,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  color: tokens.color.text.primary,
  fontFamily: 'inherit',
  fontSize: '0.85rem',
  boxSizing: 'border-box',
  minHeight: '52px',
  resize: 'vertical',
  lineHeight: 1.45,
  ':focus': {
    outline: 'none',
    borderColor: tokens.color.border.focus,
  },
  '::placeholder': {
    color: tokens.color.text.muted,
  },
})

export const worldPanelFieldSelect = style({
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
  backgroundColor: tokens.color.bg.raised,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  color: tokens.color.text.primary,
  fontFamily: 'inherit',
  fontSize: '0.85rem',
  ':focus': {
    outline: 'none',
    borderColor: tokens.color.border.focus,
  },
})

export const worldPanelInlineGrid = style({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: tokens.space['2'],
})

export const worldPanelActivityList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['1'],
  marginTop: tokens.space['2'],
  maxHeight: '180px',
  overflowY: 'auto',
  padding: tokens.space['1'],
  backgroundColor: tokens.color.bg.base,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
})

export const worldPanelActivityEntry = style({
  fontSize: '0.75rem',
  color: tokens.color.text.secondary,
  lineHeight: 1.4,
  display: 'flex',
  gap: tokens.space['2'],
  alignItems: 'baseline',
  flexWrap: 'wrap',
})

export const worldPanelActivityTime = style({
  flexShrink: 0,
  color: tokens.color.text.muted,
  fontVariantNumeric: 'tabular-nums',
})

export const worldPanelActivityTool = style({
  flexShrink: 0,
  fontFamily: 'monospace',
  fontSize: '0.7rem',
  color: tokens.color.text.muted,
})

export const worldPanelActivitySummary = style({
  flex: 1,
  color: tokens.color.text.primary,
  minWidth: 0,
  wordBreak: 'break-word',
})

export const worldPanelActivityStatus = style({
  flexShrink: 0,
  fontSize: '0.65rem',
  fontFamily: 'monospace',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  padding: `0 ${tokens.space['1']}`,
  borderRadius: tokens.radius.sm,
  border: '1px solid currentColor',
  opacity: 0.85,
})

export const worldPanelActivityStatusApplied = style({
  color: tokens.color.semantic.success,
})

export const worldPanelActivityStatusNoop = style({
  color: tokens.color.text.muted,
})

export const worldPanelActivityStatusFailed = style({
  color: tokens.color.semantic.error,
})

export const worldPanelActivityDetails = style({
  flexBasis: '100%',
  marginTop: tokens.space['1'],
  fontSize: '0.7rem',
  color: tokens.color.text.muted,
})

export const worldPanelActivityDetailsSummary = style({
  cursor: 'pointer',
  userSelect: 'none',
  fontFamily: 'monospace',
  ':hover': {
    color: tokens.color.text.secondary,
  },
})

export const worldPanelActivityArgs = style({
  marginTop: tokens.space['1'],
  padding: tokens.space['1'],
  backgroundColor: tokens.color.bg.raised,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  fontFamily: 'monospace',
  fontSize: '0.7rem',
  color: tokens.color.text.secondary,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  overflow: 'auto',
  maxHeight: '160px',
})

export const worldPanelActivityError = style({
  marginTop: tokens.space['1'],
  fontSize: '0.7rem',
  color: tokens.color.semantic.error,
  fontFamily: 'monospace',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
})

export const worldPanelActivityHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: tokens.space['2'],
})

export const worldPanelAnalyzingBadge = style({
  fontSize: '0.7rem',
  color: tokens.color.text.muted,
  fontStyle: 'italic',
})

export const worldPanelLockBanner = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  padding: `${tokens.space['2']} ${tokens.space['3']}`,
  marginBottom: tokens.space['2'],
  backgroundColor: tokens.color.bg.raised,
  border: `1px solid ${tokens.color.border.default}`,
  borderLeft: `3px solid ${tokens.color.semantic.warning}`,
  borderRadius: tokens.radius.md,
  fontSize: '0.8rem',
  color: tokens.color.text.secondary,
  lineHeight: 1.4,
})
