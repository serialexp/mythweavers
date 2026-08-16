import { tokens } from '@mythweavers/ui/tokens'
import { style } from '@vanilla-extract/css'

export const field = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['3'],
})

export const row = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: tokens.space['4'],
})

export const preview = style({
  flexShrink: 0,
  width: '160px',
  height: '110px',
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

export const actions = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['2'],
  flex: 1,
})

export const help = style({
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.muted,
})

export const error = style({
  fontSize: tokens.font.size.xs,
  color: '#ef4444',
})

export const hiddenInput = style({
  display: 'none',
})

export const localUpload = style({
  display: 'block',
  cursor: 'pointer',
})

export const localUploadLabel = style({
  display: 'block',
  padding: `${tokens.space['2']} ${tokens.space['3']}`,
  fontSize: tokens.font.size.sm,
  textAlign: 'center',
  color: tokens.color.text.secondary,
  backgroundColor: tokens.color.bg.raised,
  border: `${tokens.borderWidth.default} dashed ${tokens.color.border.default}`,
  borderRadius: tokens.radius.default,
  selectors: {
    '&:hover': {
      borderColor: tokens.color.accent.primary,
      color: tokens.color.text.primary,
    },
  },
})
