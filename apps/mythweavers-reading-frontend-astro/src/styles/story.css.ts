import { tokens } from '@mythweavers/ui/theme'
import { style } from '@vanilla-extract/css'

export const storyLayout = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['8'],

  '@media': {
    '(min-width: 768px)': {
      flexDirection: 'row',
    },
  },
})

export const coverSection = style({
  flexShrink: 0,
  width: '100%',

  '@media': {
    '(min-width: 768px)': {
      width: '256px',
    },
  },
})

export const coverImage = style({
  height: '384px',
  borderRadius: tokens.radius.lg,
  overflow: 'hidden',
  boxShadow: tokens.shadow.lg,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',

  '@media': {
    '(min-width: 768px)': {
      height: '320px',
    },
  },
})

export const coverTitle = style({
  fontSize: tokens.font.size['3xl'],
  fontWeight: tokens.font.weight.bold,
  textAlign: 'center',
  padding: tokens.space['4'],
})

export const coverActions = style({
  marginTop: tokens.space['4'],
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['2'],
})

export const detailsSection = style({
  flex: 1,
})

export const storyTitle = style({
  fontSize: tokens.font.size['4xl'],
  fontWeight: tokens.font.weight.bold,
  color: tokens.color.text.primary,
  marginBottom: tokens.space['2'],
})

export const authorLine = style({
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
  marginBottom: tokens.space['2'],
})

export const badgeRow = style({
  display: 'flex',
  gap: tokens.space['2'],
  marginBottom: tokens.space['4'],
  flexWrap: 'wrap',
})

export const summary = style({
  marginBottom: tokens.space['6'],
})

export const chaptersSection = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['4'],
})

export const bookCard = style({
  backgroundColor: tokens.color.bg.elevated,
  borderRadius: tokens.radius.lg,
  padding: tokens.space['4'],
})

export const bookTitle = style({
  fontSize: tokens.font.size.lg,
  fontWeight: tokens.font.weight.semibold,
  marginBottom: tokens.space['3'],
})

export const arcSection = style({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['2'],
})

export const arcTitle = style({
  fontSize: tokens.font.size.sm,
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.secondary,
})

export const chapterLink = style({
  display: 'block',
  padding: tokens.space['2'],
  backgroundColor: tokens.color.bg.raised,
  borderRadius: tokens.radius.default,
  color: tokens.color.text.primary,
  textDecoration: 'none',
  transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,

  ':hover': {
    backgroundColor: tokens.color.accent.primary,
    color: tokens.color.text.inverse,
  },
})

// Chapter reader styles
export const chapterNav = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: tokens.space['6'],
})

export const chapterNavButtons = style({
  display: 'flex',
  gap: tokens.space['2'],
})

export const chapterContent = style({
  backgroundColor: tokens.color.bg.raised,
  padding: tokens.space['6'],
  borderRadius: tokens.radius.lg,
  boxShadow: tokens.shadow.default,
})

export const chapterTitle = style({
  fontSize: tokens.font.size['3xl'],
  fontWeight: tokens.font.weight.bold,
  textAlign: 'center',
  marginBottom: tokens.space['6'],
  color: tokens.color.text.primary,
})

export const chapterFooterNav = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: tokens.space['6'],
})
