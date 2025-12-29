import { tokens } from '@mythweavers/ui/theme'
import { style } from '@vanilla-extract/css'

// Page container - centers content with padding (matches story editor)
export const pageContainer = style({
  display: 'flex',
  justifyContent: 'center',
  width: '100%',
  padding: tokens.space['8'],
})

// Page titles
export const pageTitle = style({
  fontSize: tokens.font.size['4xl'],
  fontWeight: tokens.font.weight.bold,
  color: tokens.color.text.primary,
  marginTop: 0,
  marginBottom: tokens.space['6'],
})

export const sectionTitle = style({
  fontSize: tokens.font.size['2xl'],
  fontWeight: tokens.font.weight.bold,
  color: tokens.color.text.primary,
  marginBottom: tokens.space['4'],
})

// Grid layouts
export const storyGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(1, 1fr)',
  gap: tokens.space['6'],

  '@media': {
    '(min-width: 768px)': {
      gridTemplateColumns: 'repeat(2, 1fr)',
    },
    '(min-width: 1024px)': {
      gridTemplateColumns: 'repeat(3, 1fr)',
    },
  },
})

// Form layouts
export const formCard = style({
  backgroundColor: tokens.color.bg.elevated,
  padding: tokens.space['6'],
  borderRadius: tokens.radius.lg,
  boxShadow: tokens.shadow.lg,
  width: '100%',
  maxWidth: '400px',
})

export const formTitle = style({
  fontSize: tokens.font.size['3xl'],
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.primary,
  marginBottom: tokens.space['6'],
})

export const formGroup = style({
  marginBottom: tokens.space['4'],
})

export const formDivider = style({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space['4'],
  margin: `${tokens.space['8']} 0`,
  color: tokens.color.text.muted,
})

export const formDividerLine = style({
  flex: 1,
  height: '1px',
  backgroundColor: tokens.color.border.default,
})

// Center containers
export const centerContainer = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '70vh',
})

export const centeredColumn = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: tokens.space['4'],
})

// Flex utilities
export const flexRow = style({
  display: 'flex',
  alignItems: 'center',
})

export const flexBetween = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
})

export const gap2 = style({ gap: tokens.space['2'] })
export const gap4 = style({ gap: tokens.space['4'] })
export const gap6 = style({ gap: tokens.space['6'] })
export const gap8 = style({ gap: tokens.space['8'] })

// Margin utilities
export const mb4 = style({ marginBottom: tokens.space['4'] })
export const mb6 = style({ marginBottom: tokens.space['6'] })
export const mt4 = style({ marginTop: tokens.space['4'] })
export const mt6 = style({ marginTop: tokens.space['6'] })

// Text utilities
export const textCenter = style({ textAlign: 'center' })
export const textMuted = style({ color: tokens.color.text.muted })
export const textSecondary = style({ color: tokens.color.text.secondary })
export const textSm = style({ fontSize: tokens.font.size.sm })

// Marketing / Hero section
export const heroSection = style({
  textAlign: 'center',
  marginBottom: tokens.space['8'],
})

export const heroTitle = style({
  fontSize: tokens.font.size['5xl'],
  fontWeight: tokens.font.weight.bold,
  color: tokens.color.text.primary,
  marginBottom: tokens.space['2'],
})

export const heroSubtitle = style({
  fontSize: tokens.font.size.xl,
  color: tokens.color.text.secondary,
  marginBottom: tokens.space['6'],
})

export const heroDescription = style({
  fontSize: tokens.font.size.lg,
  color: tokens.color.text.secondary,
  maxWidth: '800px',
  margin: '0 auto',
  lineHeight: 1.6,
})

export const featureGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(1, 1fr)',
  gap: tokens.space['4'],
  marginBottom: tokens.space['8'],

  '@media': {
    '(min-width: 768px)': {
      gridTemplateColumns: 'repeat(2, 1fr)',
    },
    '(min-width: 1024px)': {
      gridTemplateColumns: 'repeat(3, 1fr)',
    },
  },
})

export const featureTitle = style({
  fontSize: tokens.font.size.lg,
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.primary,
  marginBottom: tokens.space['2'],
})

export const featureDescription = style({
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
  lineHeight: 1.5,
})

export const ctaSection = style({
  display: 'flex',
  justifyContent: 'center',
  gap: tokens.space['4'],
  marginBottom: tokens.space['8'],
})
