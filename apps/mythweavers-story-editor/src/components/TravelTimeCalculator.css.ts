import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const ratingValue = style({
  color: tokens.color.accent.primary,
  fontWeight: tokens.font.weight.semibold,
})

export const loadingContainer = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  padding: '1rem',
  color: tokens.color.text.secondary,
})

export const resultDivider = style({
  paddingTop: '1rem',
  borderTop: `1px solid ${tokens.color.border.default}`,
})

export const totalTime = style({
  color: tokens.color.accent.primary,
  fontWeight: tokens.font.weight.semibold,
})

export const segmentsHeading = style({
  fontWeight: tokens.font.weight.semibold,
  fontSize: tokens.font.size.sm,
})

export const segmentCard = style({
  display: 'flex',
  gap: '0.5rem',
  padding: tokens.space['2'],
  background: tokens.color.bg.elevated,
  borderRadius: tokens.radius.sm,
  fontSize: tokens.font.size.sm,
})

export const segmentIndex = style({
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.secondary,
  minWidth: '1.5rem',
})

export const segmentContent = style({
  flex: 1,
})

export const segmentType = style({
  fontWeight: tokens.font.weight.medium,
})

export const segmentRoute = style({
  color: tokens.color.text.secondary,
  marginBottom: '0.25rem',
})

export const segmentTime = style({
  color: tokens.color.accent.primary,
  fontSize: '0.8125rem',
})

export const noSegments = style({
  padding: '1rem',
  textAlign: 'center',
  color: tokens.color.text.secondary,
  fontStyle: 'italic',
  fontSize: tokens.font.size.sm,
})
