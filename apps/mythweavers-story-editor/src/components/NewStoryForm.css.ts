import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const storageContainer = style({
  display: 'flex',
  flexDirection: 'row',
  gap: '0.75rem',
})

export const storageOption = style({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '1rem',
  background: tokens.color.bg.raised,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.default,
  cursor: 'pointer',
  transition: 'all 0.2s ease',

  ':hover': {
    borderColor: tokens.color.border.strong,
  },
})

export const storageOptionDisabled = style({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '1rem',
  background: tokens.color.bg.raised,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.default,
  opacity: 0.6,
})

export const radio = style({
  width: '18px',
  height: '18px',
  accentColor: tokens.color.accent.primary,
})

export const icon = style({
  width: '24px',
  height: '24px',
  color: tokens.color.text.secondary,
})

export const warningIcon = style({
  width: '24px',
  height: '24px',
  color: tokens.color.semantic.warning,
})

export const optionTitle = style({
  fontWeight: tokens.font.weight.medium,
  color: tokens.color.text.primary,
})

export const optionDescription = style({
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
  marginTop: '0.25rem',
})

export const fieldLabel = style({
  display: 'block',
  fontWeight: tokens.font.weight.medium,
  color: tokens.color.text.primary,
  marginBottom: '0.5rem',
})

export const buttonRow = style({
  display: 'flex',
  gap: '0.75rem',
  justifyContent: 'flex-end',
  marginTop: '0.5rem',
})
