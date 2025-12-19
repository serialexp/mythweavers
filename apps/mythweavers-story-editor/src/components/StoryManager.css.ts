import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const currentStoryBar = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `${tokens.space['2']} ${tokens.space['3']}`,
  background: tokens.color.bg.raised,
  borderRadius: tokens.radius.md,
  marginBottom: tokens.space['4'],
})

export const currentStoryInfo = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
})

export const storageIcon = style({
  display: 'flex',
  alignItems: 'center',
  fontSize: tokens.font.size.lg,
})

export const storyName = style({
  fontWeight: tokens.font.weight.medium,
  color: tokens.color.text.primary,
})

export const buttonRow = style({
  display: 'flex',
  gap: tokens.space['2'],
})

export const saveAsForm = style({
  marginTop: tokens.space['4'],
  padding: tokens.space['4'],
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.md,
  background: tokens.color.surface.default,
})

export const saveAsFormTitle = style({
  margin: 0,
  marginBottom: tokens.space['3'],
  fontSize: tokens.font.size.base,
  fontWeight: tokens.font.weight.medium,
})

export const inputField = style({
  width: '100%',
  padding: tokens.space['2'],
  marginBottom: tokens.space['3'],
  fontSize: tokens.font.size.sm,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.sm,
  background: tokens.color.bg.base,
  color: tokens.color.text.primary,

  ':focus': {
    outline: 'none',
    borderColor: tokens.color.accent.primary,
    boxShadow: `0 0 0 2px ${tokens.color.border.focus}`,
  },
})

export const radioGroup = style({
  display: 'flex',
  gap: tokens.space['4'],
  marginBottom: tokens.space['3'],
})

export const radioLabel = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
  cursor: 'pointer',
})

export const storageInfo = style({
  marginBottom: tokens.space['3'],
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.muted,
})

export const storiesHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: tokens.space['3'],
})

export const storiesTitle = style({
  margin: 0,
  fontSize: tokens.font.size.lg,
  fontWeight: tokens.font.weight.semibold,
})

export const storiesSection = style({
  maxHeight: '400px',
  overflowY: 'auto',
  // Add padding at top so cards can slide up on hover without being clipped
  paddingTop: tokens.space['2'],
})

export const noStories = style({
  padding: tokens.space['8'],
  textAlign: 'center',
  color: tokens.color.text.muted,
  fontSize: tokens.font.size.sm,
})
