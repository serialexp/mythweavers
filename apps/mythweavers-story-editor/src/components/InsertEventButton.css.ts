import { tokens } from '@mythweavers/ui/tokens'
import { keyframes, style } from '@vanilla-extract/css'

/**
 * Styles for InsertEventButton and InsertBranchButton components
 * Uses design tokens from @mythweavers/ui for consistent theming
 */

const fadeIn = keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
})

const slideUp = keyframes({
  from: {
    transform: 'translateY(20px)',
    opacity: 0,
  },
  to: {
    transform: 'translateY(0)',
    opacity: 1,
  },
})

export const insertButton = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  padding: `${tokens.space['2']} ${tokens.space['3']}`,
  background: tokens.color.bg.raised,
  color: tokens.color.text.secondary,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
  cursor: 'pointer',
  fontSize: tokens.font.size.sm,
  transition: `all ${tokens.duration.normal} ${tokens.easing.default}`,
  whiteSpace: 'nowrap',

  ':hover': {
    background: tokens.color.bg.elevated,
    color: tokens.color.text.primary,
    borderColor: tokens.color.accent.primary,
  },
})

export const modalOverlay = style({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: tokens.color.bg.overlay,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  animation: `${fadeIn} ${tokens.duration.normal} ${tokens.easing.out}`,
})

export const modalContent = style({
  background: tokens.color.bg.base,
  borderRadius: tokens.radius.lg,
  width: '90%',
  maxWidth: '800px',
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: tokens.shadow.xl,
  animation: `${slideUp} ${tokens.duration.normal} ${tokens.easing.out}`,
})

export const modalHeader = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: `${tokens.space['4']} ${tokens.space['6']}`,
  borderBottom: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
})

export const modalTitle = style({
  margin: 0,
  color: tokens.color.text.primary,
  fontSize: tokens.font.size.xl,
  fontWeight: tokens.font.weight.semibold,
})

export const closeButton = style({
  background: 'none',
  border: 'none',
  fontSize: tokens.font.size['2xl'],
  color: tokens.color.text.secondary,
  cursor: 'pointer',
  width: '32px',
  height: '32px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: tokens.radius.default,

  ':hover': {
    background: tokens.color.bg.raised,
  },
})

export const modalBody = style({
  padding: tokens.space['6'],
  overflowY: 'auto',
  flex: 1,
})

export const modalFooter = style({
  display: 'flex',
  gap: tokens.space['2'],
  padding: `${tokens.space['4']} ${tokens.space['6']}`,
  borderTop: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  justifyContent: 'flex-end',
})

export const formGroup = style({
  marginBottom: tokens.space['5'],
})

export const label = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['1'],
  marginBottom: tokens.space['2'],
  color: tokens.color.text.primary,
  fontWeight: tokens.font.weight.medium,
  fontSize: tokens.font.size.sm,
})

export const input = style({
  width: '100%',
  padding: tokens.space['2'],
  background: tokens.color.bg.raised,
  color: tokens.color.text.primary,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.default,
  fontSize: tokens.font.size.sm,

  ':focus': {
    outline: 'none',
    borderColor: tokens.color.accent.primary,
  },
})

export const textarea = style({
  width: '100%',
  padding: tokens.space['2'],
  background: tokens.color.bg.raised,
  color: tokens.color.text.primary,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.default,
  fontSize: tokens.font.size.sm,
  fontFamily: tokens.font.family.mono,
  resize: 'vertical',

  ':focus': {
    outline: 'none',
    borderColor: tokens.color.accent.primary,
  },
})

export const hint = style({
  margin: `${tokens.space['1']} 0 0 0`,
  color: tokens.color.text.secondary,
  fontSize: tokens.font.size.xs,
})

export const insertButtonConfirm = style({
  padding: `${tokens.space['2']} ${tokens.space['4']}`,
  background: tokens.color.accent.primary,
  color: tokens.color.text.inverse,
  border: 'none',
  borderRadius: tokens.radius.default,
  cursor: 'pointer',
  fontSize: tokens.font.size.sm,

  ':hover': {
    background: tokens.color.accent.primaryHover,
  },

  ':disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
})

export const cancelButton = style({
  padding: `${tokens.space['2']} ${tokens.space['4']}`,
  background: tokens.color.bg.raised,
  color: tokens.color.text.primary,
  border: 'none',
  borderRadius: tokens.radius.default,
  cursor: 'pointer',
  fontSize: tokens.font.size.sm,

  ':hover': {
    background: tokens.color.surface.hover,
  },
})

export const editorWrapper = style({
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.default,
  overflow: 'hidden',
})
