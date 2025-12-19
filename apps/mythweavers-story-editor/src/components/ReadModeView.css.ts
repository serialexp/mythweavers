import { tokens } from '@mythweavers/ui/tokens'
import { style } from '@vanilla-extract/css'

/**
 * Styles for ReadModeView component
 * Uses design tokens from @mythweavers/ui for consistent theming
 */

export const container = style({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  background: tokens.color.bg.base,
})

export const readingArea = style({
  flex: 1,
  padding: '24px 16px',
  overflow: 'hidden',
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-start',
  alignItems: 'center',

  '::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.5)), url("/paper.png")',
    backgroundRepeat: 'repeat',
    backgroundSize: '276px 276px',
    zIndex: 1,
  },

  '@media': {
    '(prefers-color-scheme: dark)': {
      '::before': {
        background: 'linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.7)), url("/paper.png")',
        backgroundRepeat: 'repeat',
        backgroundSize: '276px 276px',
      },
    },
  },
})

export const pageContent = style({
  maxWidth: '700px',
  width: '100%',
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-start',
  fontFamily: tokens.font.family.serif,
  fontSize: tokens.font.size.base,
  lineHeight: '1.75',
  color: tokens.color.text.primary,
  position: 'relative',
  zIndex: 2,
  border: '2px solid transparent',

  '@media': {
    '(prefers-color-scheme: dark)': {
      fontWeight: '300',
    },
  },
})

export const chapterTitle = style({
  margin: '0 0 2em 0',
  fontFamily: tokens.font.family.serif,
  fontSize: '2.5em',
  fontWeight: tokens.font.weight.semibold,
  textAlign: 'center',
  color: tokens.color.text.primary,
  letterSpacing: '0.02em',
})

export const paragraph = style({
  marginBottom: '1.5em',
  textIndent: '2em',
  textAlign: 'justify',
  hyphens: 'auto',

  selectors: {
    '&:last-child': {
      marginBottom: 0,
    },
  },
})

export const firstParagraph = style({
  textIndent: 0,

  '::first-letter': {
    float: 'left',
    fontSize: '3.2em',
    lineHeight: '0.8',
    margin: '0.05em 0.08em -0.1em 0',
    fontWeight: tokens.font.weight.bold,
    color: tokens.color.accent.primary,
  },

  '@media': {
    '(prefers-color-scheme: dark)': {
      '::first-letter': {
        fontWeight: tokens.font.weight.semibold,
      },
    },
  },
})

export const emptyState = style({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  height: '100%',
  fontFamily: tokens.font.family.serif,
  fontSize: tokens.font.size.lg,
  color: tokens.color.text.muted,
  fontStyle: 'italic',
})

export const pageIndicator = style({
  display: 'flex',
  justifyContent: 'center',
  padding: `${tokens.space['4']} 0`,
  fontSize: tokens.font.size.xs,
  color: tokens.color.text.muted,
  minHeight: '1.6em',
  fontFamily: tokens.font.family.sans,
  userSelect: 'none',
  opacity: 0.6,
  fontWeight: tokens.font.weight.medium,
  position: 'relative',
  zIndex: 2,
})

const navZoneBase = style({
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: '30%',
  cursor: 'pointer',
  zIndex: 3,
  transition: `background-color ${tokens.duration.normal} ${tokens.easing.default}`,
})

export const prevZone = style([
  navZoneBase,
  {
    left: 0,

    ':hover': {
      background: 'linear-gradient(to right, rgba(0, 0, 0, 0.02), transparent)',
    },

    '@media': {
      '(prefers-color-scheme: dark)': {
        ':hover': {
          background: 'linear-gradient(to right, rgba(255, 255, 255, 0.02), transparent)',
        },
      },
    },
  },
])

export const nextZone = style([
  navZoneBase,
  {
    right: 0,

    ':hover': {
      background: 'linear-gradient(to left, rgba(0, 0, 0, 0.02), transparent)',
    },

    '@media': {
      '(prefers-color-scheme: dark)': {
        ':hover': {
          background: 'linear-gradient(to left, rgba(255, 255, 255, 0.02), transparent)',
        },
      },
    },
  },
])
