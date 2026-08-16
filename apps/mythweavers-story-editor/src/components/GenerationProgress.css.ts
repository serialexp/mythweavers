import { tokens } from '@mythweavers/ui/tokens'
import { keyframes, style } from '@vanilla-extract/css'

const pulse = keyframes({
  '0%, 100%': { opacity: 0.35 },
  '50%': { opacity: 1 },
})

export const container = style({
  padding: tokens.space['4'],
  backgroundColor: tokens.color.bg.raised,
  borderRadius: tokens.radius.lg,
  borderLeft: `3px solid ${tokens.color.accent.primary}`,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['3'],
})

export const header = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  color: tokens.color.text.secondary,
  fontSize: tokens.font.size.sm,
})

export const dot = style({
  width: '0.5rem',
  height: '0.5rem',
  borderRadius: '50%',
  backgroundColor: tokens.color.accent.primary,
  animation: `${pulse} 1.2s ease-in-out infinite`,
  flexShrink: 0,
})

export const label = style({
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.primary,
})

export const stats = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  marginLeft: 'auto',
  fontVariantNumeric: 'tabular-nums',
  color: tokens.color.text.muted,
})

export const tail = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['2'],
  color: tokens.color.text.secondary,
  fontStyle: 'italic',
  whiteSpace: 'pre-wrap',
  maskImage: 'linear-gradient(to bottom, transparent, black 2.5rem)',
  WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 2.5rem)',
  maxHeight: '12rem',
  overflow: 'hidden',
  justifyContent: 'flex-end',
})

export const tailParagraph = style({
  margin: 0,
  lineHeight: tokens.font.lineHeight.relaxed,
})
