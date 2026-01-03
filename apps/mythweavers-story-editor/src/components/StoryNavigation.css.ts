import { globalStyle, keyframes, style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

// Layout styles
export const navigation = style({
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  background: tokens.color.bg.raised,
})

export const treeContainer = style({
  flex: 1,
  overflowY: 'auto',
  padding: tokens.space['2'],
  minHeight: 0,
})

export const nodeItem = style({
  userSelect: 'none',
})

export const nodeItemDragging = style({
  opacity: 0.6,
})

export const nodeHeader = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['1'],
  color: tokens.color.text.primary,
  padding: '0.125rem 0.25rem',
  cursor: 'pointer',
  transition: 'background-color 0.2s',
  position: 'relative',
  borderLeft: '3px solid transparent',
})

export const nodeHeaderSelected = style({
  background: tokens.color.surface.selected,
  borderLeftColor: tokens.color.accent.primary,
})

export const nodeHeaderIncludeInFull = style({
  background: 'rgba(255, 235, 59, 0.2)',
  borderLeftColor: '#ffc107',
})

export const nodeHeaderSelectedIncludeInFull = style({
  background: 'rgba(255, 235, 59, 0.3)',
  borderLeftColor: tokens.color.accent.primary,
})

export const nodeHeaderInactive = style({
  opacity: 0.4,
  filter: 'grayscale(0.3)',
})

export const nodeHeaderMultiSelected = style({
  background: 'rgba(59, 130, 246, 0.12)',
  borderLeftColor: 'rgba(59, 130, 246, 0.45)',
})

export const nodeHeaderDropBefore = style({
  boxShadow: `inset 0 2px 0 ${tokens.color.accent.primary}`,
})

export const nodeHeaderDropAfter = style({
  boxShadow: `inset 0 -2px 0 ${tokens.color.accent.primary}`,
})

export const nodeHeaderDropInside = style({
  background: 'rgba(59, 130, 246, 0.15)',
  borderLeftColor: tokens.color.accent.primary,
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

export const expandPlaceholder = style({
  width: '20px',
  height: '20px',
})

export const nodeIcon = style({
  display: 'flex',
  alignItems: 'center',
  fontSize: '1.1rem',
  width: '20px',
})

export const nodeTitle = style({
  flex: 1,
  fontSize: tokens.font.size.sm,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
})

export const indicatorIcon = style({
  display: 'inline-flex',
  alignItems: 'center',
  marginLeft: tokens.space['1'],
  fontSize: '0.9em',
  opacity: 0.8,
  cursor: 'pointer',
  transition: 'transform 0.2s ease, opacity 0.2s ease',
})

// Container for both indicators and actions
export const nodeControls = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['1'],
})

// Indicators are always visible
export const nodeIndicators = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['1'],
})

// Actions fade in on hover (desktop), always visible on mobile
export const nodeActions = style({
  display: 'flex',
  gap: tokens.space['1'],
  opacity: 0,
  transition: 'opacity 0.2s',

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

export const actionButton = style({
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: tokens.space['1'],
  color: tokens.color.text.secondary,
  display: 'flex',
  alignItems: 'center',
  borderRadius: tokens.radius.default,
  transition: 'all 0.2s',

  ':hover': {
    color: tokens.color.text.primary,
    background: tokens.color.surface.hover,
  },
})

export const menuContainer = style({
  position: 'relative',
})

export const dropdownMenu = style({
  background: tokens.color.bg.elevated,
  color: tokens.color.text.primary,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.default,
  boxShadow: tokens.shadow.lg,
  padding: tokens.space['1'],
})

export const dropdownButton = style({
  display: 'flex',
  alignItems: 'center',
  color: tokens.color.text.primary,
  gap: tokens.space['2'],
  width: '100%',
  padding: tokens.space['2'],
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  textAlign: 'left',
  borderRadius: tokens.radius.default,
  transition: 'background-color 0.2s',
  whiteSpace: 'nowrap',

  ':hover': {
    background: tokens.color.surface.hover,
  },
})

export const deleteButton = style({
  color: tokens.color.semantic.error,
})

export const editInput = style({
  flex: 1,
  padding: tokens.space['1'],
  border: `1px solid ${tokens.color.accent.primary}`,
  borderRadius: tokens.radius.default,
  background: tokens.color.bg.base,
  color: tokens.color.text.primary,
  fontSize: tokens.font.size.sm,
})

export const emptyState = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: tokens.space['4'],
  color: tokens.color.text.secondary,
  minHeight: '100px',
})

export const footer = style({
  padding: tokens.space['2'],
  borderTop: `1px solid ${tokens.color.border.default}`,
  background: tokens.color.bg.elevated,
})

export const footerButtonsGrid = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['2'],
})

export const footerRow = style({
  display: 'flex',
  gap: tokens.space['2'],
})

export const tokenEstimate = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
  marginBottom: tokens.space['2'],
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.muted,
  backgroundColor: tokens.color.bg.base,
  borderRadius: tokens.radius.default,
  flexWrap: 'wrap',
})

export const tokenEstimateDetail = style({
  color: tokens.color.text.secondary,
})

export const tokenEstimateWarning = style({
  color: '#f59e0b',
})

export const tokenEstimateError = style({
  color: '#ef4444',
})

export const addButton = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  flex: 1,
  padding: tokens.space['2'],
  background: tokens.color.bg.raised,
  border: `1px dashed ${tokens.color.border.default}`,
  borderRadius: tokens.radius.default,
  cursor: 'pointer',
  color: tokens.color.text.secondary,
  transition: 'all 0.2s',

  ':hover': {
    background: tokens.color.surface.hover,
    borderColor: tokens.color.accent.primary,
    color: tokens.color.text.primary,
  },
})

export const loadingIndicator = style({
  display: 'inline-flex',
  alignItems: 'center',
  marginLeft: tokens.space['2'],
  color: tokens.color.accent.primary,
})

const spin = keyframes({
  from: { transform: 'rotate(0deg)' },
  to: { transform: 'rotate(360deg)' },
})

export const spinner = style({
  display: 'inline-block',
  animation: `${spin} 1s linear infinite`,
  fontSize: '1.2rem',
})

export const dragPreview = style({
  position: 'fixed',
  top: 0,
  left: 0,
  pointerEvents: 'none',
  padding: '0.35rem 0.6rem',
  borderRadius: tokens.radius.lg,
  background: 'rgba(30, 41, 59, 0.92)',
  color: tokens.color.text.primary,
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.35)',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.125rem',
  fontSize: tokens.font.size.sm,
  zIndex: 2000,
})

export const childrenContainer = style({
  marginLeft: tokens.space['1'],
})

// Preset buttons container
export const presetButtons = style({
  display: 'flex',
  gap: tokens.space['1'],
  marginLeft: 'auto',
})

// Individual preset button
export const presetButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: tokens.space['1'],
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
  background: tokens.color.bg.raised,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.default,
  cursor: 'pointer',
  color: tokens.color.text.secondary,
  fontSize: tokens.font.size.sm,
  transition: 'all 0.2s',
  minWidth: '48px',

  ':hover': {
    background: tokens.color.surface.hover,
    borderColor: tokens.color.accent.primary,
    color: tokens.color.text.primary,
  },
})

// Preset button when it has stored settings
export const presetButtonStored = style({
  background: 'rgba(34, 197, 94, 0.15)',
  borderColor: '#22c55e',
  color: '#22c55e',

  ':hover': {
    background: 'rgba(34, 197, 94, 0.25)',
    borderColor: '#22c55e',
    color: '#22c55e',
  },
})
