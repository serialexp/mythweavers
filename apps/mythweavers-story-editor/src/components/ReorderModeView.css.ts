import { tokens } from '@mythweavers/ui/tokens'
import { style } from '@vanilla-extract/css'

/**
 * Styles for ReorderModeView component
 * Uses design tokens from @mythweavers/ui for consistent theming
 */

// Header section
export const reorderModeHeader = style({
  position: 'sticky',
  top: 0,
  zIndex: 10,
  background: tokens.color.bg.base,
  borderBottom: `${tokens.borderWidth.thick} solid ${tokens.color.border.default}`,
  padding: `${tokens.space['4']} ${tokens.space['6']}`,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
})

export const reorderTitle = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  fontSize: tokens.font.size.xl,
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.primary,
  margin: 0,
})

export const reorderActions = style({
  display: 'flex',
  gap: tokens.space['3'],
})

export const cancelButton = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['1.5'],
  padding: `${tokens.space['2']} ${tokens.space['4']}`,
  borderRadius: tokens.radius.md,
  fontSize: tokens.font.size.sm,
  fontWeight: tokens.font.weight.medium,
  cursor: 'pointer',
  transition: `all ${tokens.duration.normal} ${tokens.easing.default}`,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  background: tokens.color.bg.raised,
  color: tokens.color.text.secondary,

  ':hover': {
    background: tokens.color.bg.elevated,
  },
})

export const discardButton = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['1.5'],
  padding: `${tokens.space['2']} ${tokens.space['4']}`,
  borderRadius: tokens.radius.md,
  fontSize: tokens.font.size.sm,
  fontWeight: tokens.font.weight.medium,
  cursor: 'pointer',
  transition: `all ${tokens.duration.normal} ${tokens.easing.default}`,
  background: tokens.color.semantic.error,
  color: tokens.color.text.inverse,
  border: `${tokens.borderWidth.default} solid ${tokens.color.semantic.error}`,

  ':hover': {
    opacity: 0.9,
  },
})

export const saveButton = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['1.5'],
  padding: `${tokens.space['2']} ${tokens.space['4']}`,
  borderRadius: tokens.radius.md,
  fontSize: tokens.font.size.sm,
  fontWeight: tokens.font.weight.medium,
  cursor: 'pointer',
  transition: `all ${tokens.duration.normal} ${tokens.easing.default}`,
  background: tokens.color.accent.primary,
  color: tokens.color.text.inverse,
  border: `${tokens.borderWidth.default} solid ${tokens.color.accent.primary}`,

  ':hover': {
    background: tokens.color.accent.primaryHover,
  },

  ':disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
})

// List section
export const reorderList = style({
  listStyle: 'none',
  padding: tokens.space['4'],
  margin: 0,
})

export const reorderItem = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `${tokens.space['2']} ${tokens.space['3']}`,
  marginBottom: tokens.space['1.5'],
  background: tokens.color.bg.raised,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
  cursor: 'move',
  transition: `all ${tokens.duration.normal} ${tokens.easing.default}`,

  ':hover': {
    background: tokens.color.bg.elevated,
    boxShadow: tokens.shadow.sm,
  },
})

export const isDragging = style({
  opacity: 0.5,
  transform: 'scale(0.95)',
})

export const isOver = style({
  borderColor: tokens.color.accent.primary,
  background: tokens.color.surface.selected,
})

export const reorderItemCut = style({
  borderStyle: 'dashed',
  borderColor: tokens.color.accent.secondary,
  background: tokens.color.surface.selected,
})

// Item content
export const itemContent = style({
  flex: 1,
  minWidth: 0,
  marginRight: tokens.space['4'],
  position: 'relative',
  cursor: 'pointer',
})

export const messagePreview = style({
  color: tokens.color.text.secondary,
  fontSize: tokens.font.size.sm,
  lineHeight: tokens.font.lineHeight.normal,
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  textOverflow: 'ellipsis',
})

export const summaryText = style({
  color: tokens.color.text.secondary,
  fontSize: tokens.font.size.sm,
  lineHeight: tokens.font.lineHeight.normal,
  fontStyle: 'italic',
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  textOverflow: 'ellipsis',
})

export const fullContent = style({
  color: tokens.color.text.primary,
  fontSize: tokens.font.size.sm,
  lineHeight: tokens.font.lineHeight.normal,
  whiteSpace: 'pre-wrap',
  wordWrap: 'break-word',
  maxHeight: '400px',
  overflowY: 'auto',
  padding: `${tokens.space['1']} 0`,
})

// Item controls
export const itemControls = style({
  display: 'flex',
  gap: tokens.space['1'],
})

export const cutButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  padding: 0,
  background: tokens.color.bg.base,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.default,
  cursor: 'pointer',
  transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,
  color: tokens.color.text.secondary,

  ':hover': {
    background: tokens.color.accent.secondary,
    color: tokens.color.text.inverse,
    borderColor: tokens.color.accent.secondary,
  },
})

export const cutButtonActive = style({
  background: tokens.color.accent.secondary,
  color: tokens.color.text.inverse,
  borderColor: tokens.color.accent.secondary,
})

export const moveButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  padding: 0,
  background: tokens.color.bg.base,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.default,
  cursor: 'pointer',
  transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,
  color: tokens.color.text.secondary,

  ':hover': {
    background: tokens.color.accent.primary,
    color: tokens.color.text.inverse,
    borderColor: tokens.color.accent.primary,
  },

  ':disabled': {
    opacity: 0.3,
    cursor: 'not-allowed',
  },

  selectors: {
    '&:disabled:hover': {
      background: tokens.color.bg.base,
      color: tokens.color.text.secondary,
      borderColor: tokens.color.border.default,
    },
  },
})
