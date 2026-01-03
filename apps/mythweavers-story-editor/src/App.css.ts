import { style } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

// Main app layout
export const app = style({
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  width: '100%',
  background: tokens.color.bg.base,
})

export const mainContent = style({
  display: 'flex',
  flexDirection: 'row',
  flex: 1,
  overflow: 'hidden',
  position: 'relative',
})

export const desktopNavigation = style({
  width: '400px',
  flexShrink: 0,
  height: '100%',
  borderRight: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  background: tokens.color.bg.raised,
  overflow: 'hidden',
})

export const desktopEpisodeViewer = style({
  width: '400px',
  flexShrink: 0,
  height: '100%',
  background: tokens.color.bg.raised,
  overflow: 'hidden',
})

export const chatContainer = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  background: tokens.color.bg.base,
})

// Loading states
export const authLoadingOverlay = style({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
})

export const authLoadingContent = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: tokens.space['6'],
  background: tokens.color.bg.base,
  padding: `${tokens.space['8']} ${tokens.space['12']}`,
  borderRadius: tokens.radius.lg,
  boxShadow: tokens.shadow.lg,
})

export const loadingContainer = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100vh',
  gap: tokens.space['6'],
  backgroundColor: tokens.color.surface.default,
})

export const loadingText = style({
  color: tokens.color.text.secondary,
  fontSize: tokens.font.size.lg,
  fontWeight: tokens.font.weight.medium,
})

// Error states
export const errorText = style({
  color: tokens.color.semantic.error,
  fontSize: tokens.font.size.lg,
  textAlign: 'center',
  maxWidth: '400px',
  lineHeight: 1.5,
})

export const errorContainer = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: tokens.space['4'],
  padding: tokens.space['8'],
  background: tokens.color.bg.raised,
  borderRadius: tokens.radius.default,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
})

export const errorTitle = style({
  fontSize: tokens.font.size.xl,
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.semantic.error,
})

export const errorDetails = style({
  marginTop: tokens.space['4'],
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
  maxWidth: '100%',
  overflow: 'auto',
})

export const retryButton = style({
  marginTop: tokens.space['4'],
  padding: `${tokens.space['2']} ${tokens.space['4']}`,
  background: tokens.color.accent.primary,
  color: tokens.color.text.inverse,
  border: 'none',
  borderRadius: tokens.radius.sm,
  cursor: 'pointer',
  fontSize: tokens.font.size.base,
  transition: `background ${tokens.duration.fast} ${tokens.easing.default}`,

  ':hover': {
    background: tokens.color.accent.primaryHover,
  },
})

// Modal styles (migrated from App.css)
export const modalOverlay = style({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
})

export const modalContent = style({
  background: tokens.color.bg.elevated,
  borderRadius: tokens.radius.lg,
  boxShadow: tokens.shadow.xl,
  maxWidth: '95vw',
  maxHeight: '80vh',
  width: '500px',
  display: 'flex',
  flexDirection: 'column',

  '@media': {
    '(max-width: 768px)': {
      width: '95vw',
      maxHeight: '90vh',
    },
  },
})

export const modalHeader = style({
  padding: tokens.space['4'],
  borderBottom: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
})

export const modalBody = style({
  padding: tokens.space['4'],
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
})

// Button styles
export const primaryButton = style({
  padding: `${tokens.space['3']} ${tokens.space['6']}`,
  background: tokens.color.accent.primary,
  color: tokens.color.text.inverse,
  border: 'none',
  borderRadius: tokens.radius.default,
  cursor: 'pointer',
  fontSize: tokens.font.size.sm,
  fontWeight: tokens.font.weight.medium,
  transition: `background ${tokens.duration.fast} ${tokens.easing.default}`,

  ':hover': {
    background: tokens.color.accent.primaryHover,
  },

  ':disabled': {
    background: tokens.color.text.secondary,
    cursor: 'not-allowed',
    opacity: 0.6,
  },
})

export const secondaryButton = style({
  padding: `${tokens.space['3']} ${tokens.space['6']}`,
  background: tokens.color.bg.raised,
  color: tokens.color.text.primary,
  border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
  borderRadius: tokens.radius.default,
  cursor: 'pointer',
  fontSize: tokens.font.size.sm,
  fontWeight: tokens.font.weight.medium,
  transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,

  ':hover': {
    background: tokens.color.surface.hover,
    borderColor: tokens.color.border.strong,
  },

  ':disabled': {
    cursor: 'not-allowed',
    opacity: 0.6,
  },
})

// Placeholder message for no scene selected
export const noSceneMessage = style({
  padding: tokens.space['8'],
  textAlign: 'center',
  color: tokens.color.text.muted,
})

// Modal button container
export const modalButtons = style({
  display: 'flex',
  gap: tokens.space['4'],
  justifyContent: 'flex-end',
})
