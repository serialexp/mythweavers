import { tokens } from '@mythweavers/ui/tokens'
import { style } from '@vanilla-extract/css'

export const root = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['3'],
  minHeight: 0,
})

export const toolbar = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: tokens.space['3'],
  flexWrap: 'wrap',
})

export const toggleGroup = style({
  display: 'inline-flex',
  borderRadius: tokens.radius.default,
  overflow: 'hidden',
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
})

export const toggleButton = style({
  padding: `${tokens.space['1']} ${tokens.space['3']}`,
  fontSize: tokens.font.size.sm,
  background: tokens.color.bg.base,
  color: tokens.color.text.secondary,
  border: 'none',
  cursor: 'pointer',
  selectors: {
    '&:not(:last-child)': {
      borderRight: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
    },
    '&:hover': {
      background: tokens.color.bg.raised,
    },
  },
})

export const toggleButtonActive = style({
  background: tokens.color.accent.primary,
  color: tokens.color.text.inverse,
  selectors: {
    '&:hover': {
      background: tokens.color.accent.primary,
    },
  },
})

export const grid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
  // Force a fixed row height. Without this, `align-items: stretch` (the grid
  // default) plus content-based row sizing makes broken-image rows collapse
  // to ~0px when an <img> fails to load — `aspect-ratio` on the tile alone
  // isn't reliable enough to prevent this once the grid is scrollable. Fixed
  // rows mean every tile is a predictable square regardless of image state.
  gridAutoRows: '110px',
  gap: tokens.space['2'],
  // Bumped from 320px now that the picker doubles as a file manager. Still
  // capped so it doesn't push the rest of a host modal off-screen.
  maxHeight: '480px',
  overflowY: 'auto',
  padding: tokens.space['1'],
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.default,
  background: tokens.color.bg.raised,
})

// Outer tile container. Wraps the select button + the delete overlay so we
// don't end up nesting interactive elements.
//
// Height comes from `grid-auto-rows` on the parent grid (110px). We don't use
// `aspect-ratio` here because it's unreliable when the grid is scrollable and
// some images fail to load — fixed row heights are a much sturdier baseline.
export const tile = style({
  position: 'relative',
  width: '100%',
  height: '100%',
  borderRadius: tokens.radius.default,
  overflow: 'hidden',
  border: `${tokens.borderWidth.default} solid transparent`,
  // Visible background so a broken/loading <img> still occupies the tile
  // shape instead of rendering as a near-invisible square.
  background: tokens.color.bg.raised,
  selectors: {
    '&:hover': {
      borderColor: tokens.color.border.strong,
    },
  },
})

// Primary tile content — the click target for selecting a file. Fills the
// entire tile so clicking anywhere outside the delete overlay picks the file.
//
// Uses inset positioning so the button always covers the full tile area, even
// when its inner content (e.g. a broken <img>) reports zero intrinsic size.
// `display: block` + `width/height: 100%` alone is fragile in that case under
// some browsers' button-rendering rules — absolute-stretching is bulletproof.
export const tileSelectButton = style({
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%',
  padding: 0,
  margin: 0,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  color: 'inherit',
  // Make sure the button is below the floating delete overlay in the stacking
  // order so the × button always wins for clicks on overlap.
  zIndex: 1,
})

// Floating delete affordance in the top-right of the tile. Uses an absolute
// position rather than living inside the select button so the two affordances
// don't conflict and so the markup stays valid (no nested <button>s).
//
// Always visible at a moderate opacity so the affordance is discoverable on
// touch devices and during bulk file management — full opacity on hover.
// `zIndex` is set above the select button (which is also positioned) so the
// × always wins for clicks in the overlap region.
export const tileDeleteButton = style({
  position: 'absolute',
  top: tokens.space['1'],
  right: tokens.space['1'],
  zIndex: 2,
  width: '24px',
  height: '24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '50%',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  background: 'rgba(0, 0, 0, 0.55)',
  color: '#fff',
  opacity: 0.75,
  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.35)',
  transition: 'opacity 120ms ease, background 120ms ease, transform 120ms ease',
  selectors: {
    '&:hover': {
      background: '#ef4444',
      opacity: 1,
      transform: 'scale(1.08)',
    },
    '&:focus-visible': {
      opacity: 1,
      outline: `2px solid ${tokens.color.accent.primary}`,
      outlineOffset: '2px',
    },
    '&:disabled': {
      cursor: 'not-allowed',
      opacity: 0.4,
    },
  },
})

export const tileSelected = style({
  borderColor: tokens.color.accent.primary,
  outline: `2px solid ${tokens.color.accent.primary}`,
  outlineOffset: '-2px',
})

export const tileImage = style({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
})

// Body for non-image tiles (e.g. audio): icon centred over a small filename
// label so the user can distinguish tracks at a glance.
export const fileTileBody = style({
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: tokens.space['2'],
  padding: tokens.space['2'],
  color: tokens.color.text.secondary,
})

export const fileTileLabel = style({
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.muted,
  textAlign: 'center',
  // Two-line clamp so long filenames don't blow out the tile height.
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  wordBreak: 'break-all',
  lineHeight: 1.2,
})

export const status = style({
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.muted,
  textAlign: 'center',
  padding: tokens.space['3'],
})

export const empty = style({
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.muted,
  textAlign: 'center',
  padding: tokens.space['4'],
})

export const loadMoreRow = style({
  display: 'flex',
  justifyContent: 'center',
  paddingTop: tokens.space['2'],
})

export const errorBox = style({
  fontSize: tokens.font.size.sm,
  color: '#ef4444',
  background: 'rgba(239, 68, 68, 0.1)',
  padding: `${tokens.space['2']} ${tokens.space['3']}`,
  borderRadius: tokens.radius.default,
  border: `${tokens.borderWidth.default} solid rgba(239, 68, 68, 0.3)`,
})

export const uploadRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
})

export const hiddenInput = style({
  display: 'none',
})

export const help = style({
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.muted,
})
