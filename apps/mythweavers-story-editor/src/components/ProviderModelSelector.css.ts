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

// --- Mythweavers balance & top-up ---

export const balanceRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
})

export const balanceValue = style({
  fontSize: '0.875rem',
  fontWeight: 600,
  color: tokens.color.text.primary,
})

export const topUpPresets = style({
  display: 'flex',
  gap: tokens.space['1'],
  flexWrap: 'wrap',
  alignItems: 'center',
})

export const presetButton = style({
  padding: `${tokens.space['1']} ${tokens.space['3']}`,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  backgroundColor: tokens.color.bg.base,
  color: tokens.color.text.secondary,
  fontSize: '0.875rem',
  fontWeight: 500,
  cursor: 'pointer',
  transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,

  ':hover': {
    backgroundColor: tokens.color.surface.hover,
    color: tokens.color.text.primary,
  },
})

export const presetButtonActive = style({
  backgroundColor: tokens.color.surface.hover,
  color: tokens.color.text.primary,
  borderColor: tokens.color.border.focus,
})

export const customAmountInput = style({
  width: '80px',
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
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

// --- Pricing estimates ---

export const estimatesTable = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['1'],
})

export const estimateRow = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: '0.8125rem',
  padding: `${tokens.space['1']} 0`,
  borderBottom: `1px solid ${tokens.color.border.subtle}`,

  selectors: {
    '&:last-child': {
      borderBottom: 'none',
    },
  },
})

export const estimateModel = style({
  color: tokens.color.text.secondary,
})

export const estimateValue = style({
  color: tokens.color.text.primary,
  fontFamily: tokens.font.family.mono,
  fontSize: '0.75rem',
})

// --- Payment modal ---

export const paymentModalContent = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['4'],
})

export const paymentElement = style({
  minHeight: '100px',
})

export const successText = style({
  fontSize: '0.875rem',
  color: tokens.color.semantic.success,
  fontWeight: 500,
  textAlign: 'center',
  padding: `${tokens.space['4']} 0`,
})

export const errorText = style({
  fontSize: '0.875rem',
  color: tokens.color.semantic.error,
})

// --- Secret input with show/hide toggle ---

export const secretInputWrapper = style({
  display: 'flex',
  gap: tokens.space['1'],
  alignItems: 'center',
})

export const secretInput = style({
  flex: 1,
  padding: tokens.space['2'],
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  backgroundColor: tokens.color.bg.base,
  color: tokens.color.text.primary,
  fontSize: '0.875rem',
  minWidth: 0,

  ':focus': {
    outline: 'none',
    borderColor: tokens.color.border.focus,
  },

  '::placeholder': {
    color: tokens.color.text.muted,
  },
})

export const secretToggle = style({
  padding: `${tokens.space['1']} ${tokens.space['2']}`,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  backgroundColor: tokens.color.bg.base,
  color: tokens.color.text.muted,
  fontSize: '0.75rem',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
  transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,

  ':hover': {
    color: tokens.color.text.secondary,
    backgroundColor: tokens.color.surface.hover,
  },
})
