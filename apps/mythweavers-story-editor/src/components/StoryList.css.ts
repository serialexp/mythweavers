import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const container = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
})

export const loadingOverlay = style({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.5)',
  backdropFilter: 'blur(2px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '1rem',
  borderRadius: '8px',
  zIndex: 10,
  color: tokens.color.text.primary,
})

export const storyName = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
})

export const storyTypeIcon = style({
  width: '16px',
  height: '16px',
  color: tokens.color.text.secondary,
})

export const warningIcon = style({
  width: '16px',
  height: '16px',
  color: tokens.color.semantic.warning,
})

export const currentStoryBorder = style({
  borderRadius: tokens.radius.sm,
  outline: `2px solid ${tokens.color.accent.primary}`,
})

export const rowInner = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['3'],
})

export const thumbnail = style({
  flexShrink: 0,
  width: '40px',
  height: '60px',
  borderRadius: tokens.radius.sm,
  objectFit: 'cover',
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  backgroundColor: tokens.color.bg.raised,
})

export const titleWithThumb = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['3'],
})
