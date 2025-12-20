import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const messages = style({
  flex: 1,
  overflow: 'auto',
  padding: 0,
  paddingBottom: '0.75rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  scrollBehavior: 'smooth',
})

export const loadingMessage = style({
  padding: tokens.space['4'],
  backgroundColor: tokens.color.bg.raised,
  borderRadius: tokens.radius.lg,
  borderLeft: `3px solid ${tokens.color.accent.primary}`,
})

export const loadingMessageContent = style({
  color: tokens.color.text.secondary,
  fontStyle: 'italic',
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['2'],
})

export const orphanedChaptersSection = style({
  marginBottom: tokens.space['4'],
  padding: tokens.space['4'],
  backgroundColor: tokens.color.bg.raised,
  borderRadius: tokens.radius.lg,
  border: `1px solid ${tokens.color.semantic.warning}`,
})

export const orphanedChaptersTitle = style({
  margin: `0 0 ${tokens.space['3']} 0`,
  color: tokens.color.semantic.warning,
  fontSize: tokens.font.size.base,
  fontWeight: tokens.font.weight.semibold,
})

export const orphanedChapterItem = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: tokens.space['2'],
  backgroundColor: tokens.color.bg.base,
  borderRadius: tokens.radius.default,
  marginBottom: tokens.space['2'],
})

export const orphanedChapterInfo = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['1'],
})

export const orphanedChapterTitle = style({
  fontWeight: tokens.font.weight.medium,
  color: tokens.color.text.primary,
})

export const orphanedChapterId = style({
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.secondary,
  fontFamily: tokens.font.family.mono,
})

export const orphanedChapterActions = style({
  display: 'flex',
  gap: tokens.space['2'],
})

export const createMarkerButton = style({
  padding: `${tokens.space['1.5']} ${tokens.space['3']}`,
  fontSize: tokens.font.size.sm,
  background: tokens.color.accent.primary,
  color: tokens.color.text.inverse,
  border: 'none',
  borderRadius: tokens.radius.default,
  cursor: 'pointer',
  transition: `background ${tokens.duration.fast} ${tokens.easing.default}`,

  ':hover': {
    background: tokens.color.accent.primaryHover,
  },
})

export const deleteOrphanedButton = style({
  padding: `${tokens.space['1.5']} ${tokens.space['3']}`,
  fontSize: tokens.font.size.sm,
  background: 'transparent',
  color: tokens.color.semantic.error,
  border: `1px solid ${tokens.color.semantic.error}`,
  borderRadius: tokens.radius.default,
  cursor: 'pointer',
  transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,

  ':hover': {
    background: tokens.color.semantic.error,
    color: tokens.color.text.inverse,
  },
})
