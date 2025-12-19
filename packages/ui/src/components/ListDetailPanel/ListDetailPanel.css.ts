import { style } from '@vanilla-extract/css'
import { tokens } from '../../theme/tokens.css'

export const container = style({
  display: 'flex',
  height: '100%',
  overflow: 'hidden',
  background: tokens.color.bg.base,
})

// Desktop: fixed width sidebar, always visible
// Mobile: full width, hides when detail is shown
export const listColumn = style({
  width: '280px',
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  borderRight: `1px solid ${tokens.color.border.default}`,
  overflow: 'hidden',
  background: tokens.color.bg.elevated,

  '@media': {
    '(max-width: 768px)': {
      width: '100%',
      borderRight: 'none',
    },
  },
})

// On mobile, hide the list when an item is selected
export const listColumnHidden = style({
  '@media': {
    '(max-width: 768px)': {
      display: 'none',
    },
  },
})

export const listHeader = style({
  flexShrink: 0,
})

export const listContent = style({
  flex: 1,
  overflowY: 'auto',
  padding: tokens.space['2'],
})

export const listItem = style({
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: tokens.space['2'],
  padding: `${tokens.space['2']} ${tokens.space['3']}`,
  background: 'transparent',
  border: 'none',
  borderRadius: tokens.radius.default,
  cursor: 'pointer',
  transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,
  textAlign: 'left',
  marginBottom: tokens.space['1'],
  color: tokens.color.text.primary,

  ':hover': {
    background: tokens.color.surface.hover,
  },
})

export const listItemSelected = style({
  background: tokens.color.surface.active,
  borderLeft: `3px solid ${tokens.color.accent.primary}`,
})

// Desktop: always visible, takes remaining space
// Mobile: hidden by default, shown when item selected
export const detailColumn = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  overflow: 'hidden',
  background: tokens.color.bg.base,

  '@media': {
    '(max-width: 768px)': {
      display: 'none',
    },
  },
})

// On mobile, show the detail column when visible
export const detailColumnVisible = style({
  '@media': {
    '(max-width: 768px)': {
      display: 'flex',
    },
  },
})

// Back button - only show on mobile
export const backButton = style({
  display: 'none',

  '@media': {
    '(max-width: 768px)': {
      display: 'flex',
    },
  },
})

export const detailHeader = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['3'],
  padding: tokens.space['3'],
  borderBottom: `1px solid ${tokens.color.border.default}`,
  background: tokens.color.bg.elevated,
  flexShrink: 0,
})

export const detailTitle = style({
  flex: 1,
  fontSize: tokens.font.size.base,
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.primary,
  margin: 0,
})

export const detailContent = style({
  flex: 1,
  overflowY: 'auto',
  padding: tokens.space['4'],
})

// Empty state shown in detail column when nothing is selected (desktop only)
export const emptyState = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  color: tokens.color.text.muted,
  padding: tokens.space['8'],
  textAlign: 'center',
})
