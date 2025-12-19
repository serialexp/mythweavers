import { tokens } from '@mythweavers/ui/theme'
import { style } from '@vanilla-extract/css'

export const cardContainer = style({
  position: 'relative',
})

export const storyCard = style({
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: tokens.color.bg.raised,
  borderRadius: tokens.radius.lg,
  boxShadow: tokens.shadow.lg,
  overflow: 'hidden',
  transition: `all ${tokens.duration.normal} ${tokens.easing.default}`,

  ':hover': {
    transform: 'scale(1.05)',
  },
})

export const cardFront = style({
  position: 'relative',
  overflow: 'hidden',
  height: '256px',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
})

export const coverImage = style({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
})

export const titleFallback = style({
  textAlign: 'center',
  color: tokens.color.text.secondary,
  alignSelf: 'flex-start',
  marginTop: tokens.space['8'],
  paddingLeft: tokens.space['4'],
  paddingRight: tokens.space['4'],
  fontSize: tokens.font.size.xl,
  fontWeight: tokens.font.weight.bold,
})

export const cardBody = style({
  display: 'flex',
  flexDirection: 'column',
  padding: tokens.space['4'],
  gap: tokens.space['2'],
  flex: 1,
})

export const cardTitle = style({
  fontSize: tokens.font.size.lg,
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.primary,
  margin: 0,
})

export const cardMeta = style({
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.secondary,
  overflow: 'hidden',
  width: '100%',
})

export const cardSummary = style({
  fontSize: tokens.font.size.xs,
  flex: 1,
  overflow: 'hidden',
  width: '100%',
  color: tokens.color.text.secondary,
})

export const cardActions = style({
  display: 'flex',
  justifyContent: 'space-around',
  gap: tokens.space['2'],
  marginTop: tokens.space['3'],
})

export const statusFooter = style({
  fontSize: tokens.font.size.lg,
  color: tokens.color.text.muted,
  marginTop: tokens.space['4'],
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: tokens.space['1'],
})
