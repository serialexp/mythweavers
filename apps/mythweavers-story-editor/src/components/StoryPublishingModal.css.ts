import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const currentState = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  flexWrap: 'wrap',
})

export const currentStateLabel = style({
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
})

export const currentStateDetail = style({
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
})

export const releaseSummary = style({
  padding: tokens.space['3'],
  borderRadius: tokens.radius.md,
  backgroundColor: tokens.color.bg.raised,
  border: `1px solid ${tokens.color.border.subtle}`,
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['1'],
})

export const releaseLabel = style({
  fontWeight: tokens.font.weight.medium,
  color: tokens.color.text.primary,
})

export const optionList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['2'],
})

export const option = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: tokens.space['3'],
  padding: tokens.space['3'],
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
  cursor: 'pointer',
  transition: `border-color ${tokens.duration.fast} ${tokens.easing.default}`,
  selectors: {
    '&:hover': {
      borderColor: tokens.color.border.strong,
    },
    '&:has(input:checked)': {
      borderColor: tokens.color.accent.primary,
      backgroundColor: tokens.color.surface.selected,
    },
  },
})

export const optionBody = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['1'],
  flex: 1,
  minWidth: 0,
})

export const optionTitle = style({
  fontWeight: tokens.font.weight.medium,
  color: tokens.color.text.primary,
})

export const optionDetail = style({
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
})

export const scheduleInput = style({
  marginTop: tokens.space['2'],
})
