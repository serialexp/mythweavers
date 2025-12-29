import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const branchTitle = style({
  fontSize: '1.1rem',
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.primary,
  marginBottom: tokens.space['4'],
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
})

export const branchTitleIcon = style({
  fontSize: '1.3rem',
})

export const optionRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  padding: `${tokens.space['2']} ${tokens.space['4']}`,
  background: tokens.color.bg.base,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,
})

export const optionRowSelected = style({
  borderColor: tokens.color.semantic.success,
  background: `color-mix(in srgb, ${tokens.color.semantic.success} 10%, ${tokens.color.bg.base})`,
})

export const selectButtonDefault = style({
  color: tokens.color.text.secondary,
})

export const selectButtonSelected = style({
  color: tokens.color.semantic.success,
})

export const optionContent = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['1'],
})

export const optionDisplayContent = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['1'],
})

export const optionLabel = style({
  fontSize: '1rem',
  color: tokens.color.text.primary,
  fontWeight: tokens.font.weight.medium,
})

export const optionDescription = style({
  fontSize: '0.9rem',
  color: tokens.color.text.secondary,
  fontStyle: 'italic',
  marginTop: tokens.space['1'],
})

export const noTargetText = style({
  fontSize: '0.85rem',
  color: tokens.color.semantic.error,
  fontStyle: 'italic',
})

export const targetText = style({
  fontSize: '0.85rem',
  color: tokens.color.semantic.success,
})

export const goToTargetButton = style({
  color: tokens.color.semantic.success,
})

export const addOptionButton = style({
  width: '100%',
})

export const optionsContainer = style({
  marginBottom: tokens.space['4'],
})
