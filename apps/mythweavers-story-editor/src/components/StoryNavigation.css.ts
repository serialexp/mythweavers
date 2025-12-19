import { globalStyle, style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const actionButton = style({
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '0.25rem',
  color: tokens.color.text.secondary,
  display: 'flex',
  alignItems: 'center',
  borderRadius: '4px',
  transition: 'all 0.2s',

  ':hover': {
    color: tokens.color.text.primary,
    background: tokens.color.surface.hover,
  },
})

export const expandButton = style({
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 0,
  width: '20px',
  height: '20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: tokens.color.text.secondary,
  transition: 'color 0.2s',

  ':hover': {
    color: tokens.color.text.primary,
  },
})

export const dropdownMenu = style({
  background: tokens.color.bg.elevated,
  color: tokens.color.text.primary,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: '4px',
  boxShadow: tokens.shadow.lg,
  padding: '0.25rem',
})

export const dropdownButton = style({
  display: 'flex',
  alignItems: 'center',
  color: tokens.color.text.primary,
  gap: '0.5rem',
  width: '100%',
  padding: '0.5rem',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  textAlign: 'left',
  borderRadius: '4px',
  transition: 'background-color 0.2s',
  whiteSpace: 'nowrap',

  ':hover': {
    background: tokens.color.surface.hover,
  },
})

export const deleteButton = style({
  color: tokens.color.semantic.error,
})

export const nodeHeader = style({})

// Container for both indicators and actions
export const nodeControls = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
})

// Indicators are always visible
export const nodeIndicators = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
})

// Actions fade in on hover (desktop), always visible on mobile
export const nodeActions = style({
  display: 'flex',
  gap: '0.25rem',
  opacity: 0,
  transition: 'opacity 0.2s',

  // Always show on mobile - touch devices need visible targets
  '@media': {
    '(max-width: 768px)': {
      opacity: 1,
    },
  },
})

// Show actions on hover (desktop only, mobile already visible)
globalStyle(`${nodeHeader}:hover ${nodeActions}`, {
  opacity: 1,
})
