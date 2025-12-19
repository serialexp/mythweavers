import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const section = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['4'],
})

export const settingRow = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['1'],
})

export const label = style({
  fontSize: '0.75rem',
  fontWeight: 600,
  color: tokens.color.text.secondary,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
})

export const inputRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
})

export const listItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  flex: 1,
})

export const input = style({
  flex: 1,
  padding: tokens.space['2'],
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  backgroundColor: tokens.color.bg.base,
  color: tokens.color.text.primary,
  fontSize: '0.875rem',

  ':focus': {
    outline: 'none',
    borderColor: tokens.color.border.focus,
  },

  '::placeholder': {
    color: tokens.color.text.muted,
  },
})

export const select = style({
  width: '100%',
  padding: tokens.space['2'],
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  backgroundColor: tokens.color.bg.base,
  color: tokens.color.text.primary,
  fontSize: '0.875rem',
  cursor: 'pointer',

  ':focus': {
    outline: 'none',
    borderColor: tokens.color.border.focus,
  },
})

export const button = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: tokens.space['2'],
  width: '100%',
  padding: `${tokens.space['2']} ${tokens.space['4']}`,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  backgroundColor: tokens.color.bg.base,
  color: tokens.color.text.primary,
  fontSize: '0.875rem',
  fontWeight: 500,
  cursor: 'pointer',
  transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,

  ':hover': {
    backgroundColor: tokens.color.surface.hover,
  },

  ':disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
})

export const showKeyButton = style({
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  backgroundColor: tokens.color.bg.base,
  color: tokens.color.text.secondary,
  fontSize: '0.75rem',
  cursor: 'pointer',
  transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,

  ':hover': {
    backgroundColor: tokens.color.surface.hover,
  },
})

export const checkboxContainer = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  cursor: 'pointer',
})

export const checkboxLabel = style({
  fontSize: '0.875rem',
  fontWeight: 500,
  color: tokens.color.text.primary,
})

export const checkboxDescription = style({
  fontSize: '0.8rem',
  color: tokens.color.text.secondary,
  marginLeft: tokens.space['6'],
})

export const infoText = style({
  fontSize: '0.875rem',
  color: tokens.color.text.secondary,
})

// Import dialog styles
export const dialogOverlay = style({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 400,
})

export const dialog = style({
  backgroundColor: tokens.color.bg.base,
  borderRadius: tokens.radius.lg,
  boxShadow: tokens.shadow.xl,
  width: '90%',
  maxWidth: '500px',
  maxHeight: '90vh',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
})

export const dialogHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: tokens.space['4'],
  borderBottom: `1px solid ${tokens.color.border.default}`,
})

export const dialogTitle = style({
  fontSize: '1.125rem',
  fontWeight: 600,
  color: tokens.color.text.primary,
  margin: 0,
})

export const dialogCloseButton = style({
  padding: tokens.space['1'],
  border: 'none',
  background: 'none',
  color: tokens.color.text.secondary,
  fontSize: '1.5rem',
  lineHeight: 1,
  cursor: 'pointer',
  borderRadius: tokens.radius.sm,
  transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,

  ':hover': {
    backgroundColor: tokens.color.surface.hover,
    color: tokens.color.text.primary,
  },
})

export const dialogContent = style({
  padding: tokens.space['4'],
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['4'],
  overflowY: 'auto',
})

export const dialogInfo = style({
  fontSize: '0.875rem',
  color: tokens.color.text.secondary,
  lineHeight: 1.5,
  margin: 0,
})

export const textarea = style({
  width: '100%',
  padding: tokens.space['3'],
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  backgroundColor: tokens.color.bg.base,
  color: tokens.color.text.primary,
  fontSize: '0.875rem',
  fontFamily: 'inherit',
  lineHeight: 1.5,
  resize: 'vertical',

  ':focus': {
    outline: 'none',
    borderColor: tokens.color.border.focus,
  },

  '::placeholder': {
    color: tokens.color.text.muted,
  },
})

export const errorText = style({
  padding: tokens.space['2'],
  backgroundColor: `color-mix(in srgb, ${tokens.color.semantic.error} 10%, transparent)`,
  border: `1px solid ${tokens.color.semantic.error}`,
  borderRadius: tokens.radius.sm,
  color: tokens.color.semantic.error,
  fontSize: '0.875rem',
})

export const dialogActions = style({
  display: 'flex',
  gap: tokens.space['2'],
  justifyContent: 'flex-end',
  paddingTop: tokens.space['2'],
  borderTop: `1px solid ${tokens.color.border.default}`,
})

export const primaryButton = style({
  padding: `${tokens.space['2']} ${tokens.space['4']}`,
  border: 'none',
  borderRadius: tokens.radius.sm,
  backgroundColor: tokens.color.accent.primary,
  color: tokens.color.text.inverse,
  fontSize: '0.875rem',
  fontWeight: 500,
  cursor: 'pointer',
  transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,

  ':hover': {
    opacity: 0.9,
  },

  ':disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
})

export const secondaryButton = style({
  padding: `${tokens.space['2']} ${tokens.space['4']}`,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  backgroundColor: 'transparent',
  color: tokens.color.text.primary,
  fontSize: '0.875rem',
  fontWeight: 500,
  cursor: 'pointer',
  transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,

  ':hover': {
    backgroundColor: tokens.color.surface.hover,
  },
})
