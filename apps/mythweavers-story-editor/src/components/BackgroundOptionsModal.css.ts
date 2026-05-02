import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const modalContent = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['4'],
  maxHeight: '70vh',
  overflowY: 'auto',
})

export const formSection = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['2'],
})

export const label = style({
  fontSize: tokens.font.size.sm,
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.primary,
})

export const help = style({
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.muted,
})

export const previewRow = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: tokens.space['4'],
})

export const preview = style({
  flexShrink: 0,
  width: '240px',
  aspectRatio: '16 / 9',
  borderRadius: tokens.radius.default,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  backgroundColor: tokens.color.bg.raised,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  color: tokens.color.text.muted,
  fontSize: tokens.font.size.xs,
  textAlign: 'center',
})

export const previewImage = style({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
})

export const actionsCol = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['2'],
  flex: 1,
})

export const hiddenInput = style({
  display: 'none',
})

export const errorBox = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  padding: `${tokens.space['2']} ${tokens.space['3']}`,
  fontSize: tokens.font.size.sm,
  color: '#ef4444',
  backgroundColor: 'rgba(239, 68, 68, 0.1)',
  borderRadius: tokens.radius.default,
  border: `${tokens.borderWidth.default} solid rgba(239, 68, 68, 0.3)`,
})

export const actions = style({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: tokens.space['2'],
  paddingTop: tokens.space['2'],
  borderTop: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
})

// ---- Source tabs (Library / Generate) ----

export const tabRow = style({
  display: 'flex',
  gap: tokens.space['1'],
  borderBottom: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
})

export const tab = style({
  appearance: 'none',
  background: 'transparent',
  border: 'none',
  padding: `${tokens.space['2']} ${tokens.space['3']}`,
  fontSize: tokens.font.size.sm,
  fontWeight: tokens.font.weight.medium,
  color: tokens.color.text.secondary,
  cursor: 'pointer',
  borderBottom: `2px solid transparent`,
  marginBottom: '-1px',
  transition: 'color 0.15s ease, border-color 0.15s ease',
  selectors: {
    '&:hover:not(:disabled)': {
      color: tokens.color.text.primary,
    },
    '&:disabled': {
      cursor: 'not-allowed',
      opacity: 0.5,
    },
  },
})

export const tabActive = style({
  color: tokens.color.accent.primary,
  borderBottomColor: tokens.color.accent.primary,
})

// ---- Generate panel ----

export const generatePanel = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['3'],
})

export const promptInput = style({
  width: '100%',
  minHeight: '80px',
  padding: tokens.space['2'],
  fontSize: tokens.font.size.sm,
  fontFamily: tokens.font.family.sans,
  color: tokens.color.text.primary,
  backgroundColor: tokens.color.bg.raised,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.default,
  resize: 'vertical',
  selectors: {
    '&:focus': {
      outline: 'none',
      borderColor: tokens.color.border.focus,
    },
    '&:disabled': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  },
})

export const selectInput = style({
  width: '100%',
  padding: `${tokens.space['2']} ${tokens.space['2']}`,
  fontSize: tokens.font.size.sm,
  fontFamily: tokens.font.family.sans,
  color: tokens.color.text.primary,
  backgroundColor: tokens.color.bg.raised,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.default,
  selectors: {
    '&:focus': {
      outline: 'none',
      borderColor: tokens.color.border.focus,
    },
    '&:disabled': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  },
})

export const generateRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: tokens.space['3'],
})

export const costEstimate = style({
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.muted,
  fontVariantNumeric: 'tabular-nums',
})
