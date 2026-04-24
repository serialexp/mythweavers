import { tokens } from '@mythweavers/ui/theme'
import { style } from '@vanilla-extract/css'

export const cardContainer = style({
  position: 'relative',
})

/**
 * The card is locked to a 2:3 aspect ratio (book-cover proportions) so covers
 * render at their intended dimensions. Contents (image + text overlay) stack
 * inside via absolute positioning.
 */
export const storyCard = style({
  position: 'relative',
  aspectRatio: '2 / 3',
  width: '100%',
  backgroundColor: tokens.color.bg.raised,
  borderRadius: tokens.radius.lg,
  boxShadow: tokens.shadow.lg,
  overflow: 'hidden',
  transition: `all ${tokens.duration.normal} ${tokens.easing.default}`,

  ':hover': {
    transform: 'scale(1.05)',
  },
})

/** Fills the card with the cover art (or solid color fallback). */
export const cardFront = style({
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
})

export const coverImage = style({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
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

/**
 * Bottom overlay — title, meta, summary, and actions on top of a dark
 * gradient so the text stays legible over any cover image.
 */
export const cardBody = style({
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['2'],
  padding: tokens.space['4'],
  paddingTop: tokens.space['10'],
  color: '#ffffff',
  background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.7) 45%, rgba(0,0,0,0) 100%)',
})

export const cardTitle = style({
  fontSize: tokens.font.size.lg,
  fontWeight: tokens.font.weight.semibold,
  color: '#ffffff',
  margin: 0,
  textShadow: '0 1px 2px rgba(0,0,0,0.8)',
})

export const cardMeta = style({
  fontSize: tokens.font.size.xs,
  color: 'rgba(255,255,255,0.85)',
  overflow: 'hidden',
  width: '100%',
  textShadow: '0 1px 2px rgba(0,0,0,0.8)',
})

export const cardSummary = style({
  fontSize: tokens.font.size.xs,
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
  width: '100%',
  color: 'rgba(255,255,255,0.85)',
  textShadow: '0 1px 2px rgba(0,0,0,0.8)',
})

export const cardActions = style({
  display: 'flex',
  justifyContent: 'space-around',
  gap: tokens.space['2'],
  marginTop: tokens.space['2'],
})

export const statusFooter = style({
  fontSize: tokens.font.size.lg,
  color: tokens.color.text.muted,
  marginTop: tokens.space['2'],
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: tokens.space['1'],
})
