import { tokens } from '@mythweavers/ui/tokens'
import { style } from '@vanilla-extract/css'

export const body = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['4'],
  padding: tokens.space['4'],
})

export const previewRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['3'],
})

export const preview = style({
  width: '64px',
  height: '64px',
  objectFit: 'cover',
  borderRadius: tokens.radius.default,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  flexShrink: 0,
})

// Fallback box for non-image files (audio, etc.) — matches the preview footprint.
export const previewFallback = style({
  width: '64px',
  height: '64px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: tokens.radius.default,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  background: tokens.color.bg.raised,
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.muted,
  padding: tokens.space['2'],
  textAlign: 'center',
  overflow: 'hidden',
  flexShrink: 0,
})

export const filename = style({
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.primary,
  wordBreak: 'break-all',
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
})

export const usageLoading = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.muted,
})

export const usageNone = style({
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
  margin: 0,
})

export const usageHeading = style({
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.primary,
  margin: 0,
})

export const usageList = style({
  margin: 0,
  paddingLeft: tokens.space['5'],
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['1'],
})

export const usageWarning = style({
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.muted,
  margin: 0,
  fontStyle: 'italic',
})
