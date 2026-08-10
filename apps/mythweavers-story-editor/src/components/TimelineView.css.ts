import { tokens } from '@mythweavers/ui/tokens'
import { style, styleVariants } from '@vanilla-extract/css'

export const root = style({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
  background: tokens.color.bg.base,
})

// --- Toolbar -----------------------------------------------------------------

export const toolbar = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['3'],
  padding: `${tokens.space['2']} ${tokens.space['3']}`,
  borderBottom: `1px solid ${tokens.color.border.default}`,
  background: tokens.color.bg.raised,
  flexShrink: 0,
  flexWrap: 'wrap',
})

export const toolbarGroup = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['1'],
})

export const toolbarSpacer = style({
  flex: 1,
})

/**
 * Long-press-to-pick-up has no visible affordance, so touch users are told once
 * in the toolbar. Hidden on pointer-fine devices, where dragging is direct.
 */
export const touchHint = style({
  display: 'none',
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.muted,
  '@media': {
    '(pointer: coarse)': {
      display: 'inline',
    },
  },
})

export const toolbarLabel = style({
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.muted,
  whiteSpace: 'nowrap',
})

export const readout = style({
  fontSize: tokens.font.size.xs,
  fontVariantNumeric: 'tabular-nums',
  color: tokens.color.text.secondary,
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
  background: tokens.color.bg.base,
  borderRadius: tokens.radius.default,
  whiteSpace: 'nowrap',
})

export const readoutActive = style({
  color: tokens.color.text.inverse,
  background: tokens.color.accent.primary,
})

// --- Scroll surface ----------------------------------------------------------

/**
 * The pointer surface. `touch-action: pan-y` lets the lane list scroll
 * vertically on touch while we claim horizontal gestures for pan/drag;
 * `user-select: none` stops marquee drags painting the whole panel blue.
 */
export const surface = style({
  position: 'relative',
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  overflowX: 'hidden',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  // Without this iOS pops its copy/share callout on the long press that picks a
  // scene up, on top of the gesture.
  WebkitTouchCallout: 'none',
  touchAction: 'pan-y',
  cursor: 'default',
})

export const surfacePanning = style({
  cursor: 'grabbing',
})

// --- Ruler -------------------------------------------------------------------

export const ruler = style({
  position: 'sticky',
  top: 0,
  zIndex: 3,
  height: '38px',
  background: tokens.color.bg.raised,
  borderBottom: `1px solid ${tokens.color.border.default}`,
  overflow: 'hidden',
})

export const rulerInner = style({
  position: 'relative',
  height: '100%',
  marginLeft: 'var(--timeline-gutter)',
})

export const rulerTick = style({
  position: 'absolute',
  top: 0,
  bottom: 0,
  borderLeft: `1px solid ${tokens.color.border.subtle}`,
  paddingLeft: tokens.space['1'],
  fontSize: '0.65rem',
  lineHeight: '38px',
  color: tokens.color.text.muted,
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
})

/** Vertical gridlines continuing the ruler ticks down through the lanes. */
export const gridline = style({
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: '1px',
  background: tokens.color.border.subtle,
  opacity: 0.4,
  pointerEvents: 'none',
})

/** Legacy chapter times, shown for orientation only -- never draggable. */
export const chapterMark = style({
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: '2px',
  background: tokens.color.accent.secondary,
  opacity: 0.5,
  pointerEvents: 'none',
})

// --- Lanes -------------------------------------------------------------------

export const lanes = style({
  position: 'relative',
})

export const lane = style({
  position: 'relative',
  display: 'flex',
  alignItems: 'stretch',
  borderBottom: `1px solid ${tokens.color.border.subtle}`,
  minHeight: '56px',
  '@media': {
    '(pointer: coarse)': {
      // Room for the taller chips and their expanded hit areas.
      minHeight: '68px',
    },
  },
})

export const laneAlt = style({
  background: tokens.color.bg.raised,
})

export const laneLabel = style({
  position: 'sticky',
  left: 0,
  zIndex: 2,
  width: 'var(--timeline-gutter)',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  padding: `0 ${tokens.space['2']}`,
  background: tokens.color.bg.elevated,
  borderRight: `1px solid ${tokens.color.border.default}`,
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.secondary,
  overflow: 'hidden',
})

export const laneLabelText = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
})

export const laneSwatch = style({
  width: '8px',
  height: '8px',
  borderRadius: tokens.radius.full,
  flexShrink: 0,
})

/**
 * Swatch colour for the "no viewpoint" lane. Character lanes derive a hue from
 * their id instead, so this is the one lane colour that can come from a token.
 */
export const neutralLaneColor = tokens.color.border.strong

export const laneCount = style({
  marginLeft: 'auto',
  fontSize: '0.65rem',
  fontVariantNumeric: 'tabular-nums',
  color: tokens.color.text.muted,
  flexShrink: 0,
})

export const laneTrack = style({
  position: 'relative',
  flex: 1,
  minWidth: 0,
})

// --- Scene chips -------------------------------------------------------------

const chipBase = style({
  position: 'absolute',
  top: '50%',
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['1'],
  height: '24px',
  padding: `0 ${tokens.space['2']}`,
  borderRadius: tokens.radius.full,
  fontSize: tokens.font.size.xs,
  lineHeight: 1,
  whiteSpace: 'nowrap',
  cursor: 'grab',
  border: `1px solid ${tokens.color.border.strong}`,
  background: tokens.color.bg.elevated,
  color: tokens.color.text.primary,
  transform: 'translateY(-50%)',
  boxShadow: tokens.shadow.sm,
  /**
   * A 24px chip is well under the 44px minimum touch target, and growing the
   * visible chip that much would wreck the density the timeline depends on.
   * An invisible expander gives the finger room without changing the picture.
   * Events on a pseudo-element target the host, so `closest('[data-scene-id]')`
   * still resolves.
   */
  '::before': {
    content: '""',
    position: 'absolute',
    inset: '-10px -8px',
  },
  '@media': {
    '(pointer: coarse)': {
      height: '32px',
    },
  },
})

export const chip = styleVariants({
  exact: [chipBase, {}],
  interpolated: [
    chipBase,
    {
      borderStyle: 'dashed',
      opacity: 0.45,
      background: tokens.color.bg.raised,
    },
  ],
  extrapolated: [
    chipBase,
    {
      borderStyle: 'dotted',
      opacity: 0.35,
      background: tokens.color.bg.raised,
    },
  ],
  unknown: [
    chipBase,
    {
      borderStyle: 'dotted',
      borderColor: tokens.color.semantic.warning,
      opacity: 0.35,
      background: tokens.color.bg.raised,
    },
  ],
})

export const chipSelected = style({
  borderColor: tokens.color.accent.primary,
  background: tokens.color.accent.primary,
  color: tokens.color.text.inverse,
  opacity: 1,
  zIndex: 2,
})

/**
 * The moment a long press takes, before any movement. Deliberately louder than
 * `chipDragging`: this is the only signal that the finger is now holding the
 * chip rather than about to pan the view.
 */
export const chipLifted = style({
  transform: 'translateY(-50%) scale(1.18)',
  boxShadow: tokens.shadow.lg,
  zIndex: 4,
})

export const chipDragging = style({
  cursor: 'grabbing',
  boxShadow: tokens.shadow.lg,
  zIndex: 4,
})

/**
 * Below a width threshold labels are unreadable and chips overlap into a smear,
 * so dense regions collapse to dots.
 */
export const chipDot = style({
  width: '10px',
  height: '10px',
  minWidth: '10px',
  padding: 0,
  borderRadius: tokens.radius.full,
  // No `overflow: hidden` here on purpose: the label is gated out of the DOM by
  // `showLabel()` rather than clipped, and hiding overflow would crop the hit
  // expander -- on precisely the chips that need it most.
  '@media': {
    '(pointer: coarse)': {
      width: '20px',
      height: '20px',
      minWidth: '20px',
      // 20px + 12px either side clears the 44px guideline.
      '::before': { inset: '-12px' },
    },
  },
})

export const chipLabel = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: '160px',
})

// --- Marquee -----------------------------------------------------------------

export const marquee = style({
  position: 'absolute',
  border: `1px solid ${tokens.color.accent.primary}`,
  background: 'rgba(59, 130, 246, 0.12)',
  pointerEvents: 'none',
  zIndex: 5,
})

// --- Empty / status ----------------------------------------------------------

export const emptyState = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: tokens.space['2'],
  padding: tokens.space['8'],
  textAlign: 'center',
  color: tokens.color.text.secondary,
})

export const emptyTitle = style({
  fontSize: tokens.font.size.lg,
  color: tokens.color.text.primary,
})

export const hint = style({
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.muted,
  maxWidth: '460px',
})

export const warning = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  padding: `${tokens.space['2']} ${tokens.space['3']}`,
  fontSize: tokens.font.size.xs,
  color: tokens.color.semantic.warning,
  background: tokens.color.semantic.warningSubtle,
  borderBottom: `1px solid ${tokens.color.border.default}`,
  flexShrink: 0,
})
