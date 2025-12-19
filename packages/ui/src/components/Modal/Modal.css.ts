import { keyframes, style } from '@vanilla-extract/css'
import { type RecipeVariants, recipe } from '@vanilla-extract/recipes'
import { tokens } from '../../theme/tokens.css'

const fadeIn = keyframes({
  '0%': { opacity: 0 },
  '100%': { opacity: 1 },
})

const scaleIn = keyframes({
  '0%': { opacity: 0, transform: 'translate(-50%, -50%) scale(0.95)' },
  '100%': { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
})

export const overlay = style({
  position: 'fixed',
  inset: 0,
  backgroundColor: tokens.color.bg.overlay,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: tokens.zIndex.modal,
  animation: `${fadeIn} ${tokens.duration.fast} ${tokens.easing.out}`,
})

export const modal = recipe({
  base: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: tokens.color.bg.elevated,
    borderRadius: tokens.radius.lg,
    boxShadow: tokens.shadow.lg,
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '90vh',
    animation: `${scaleIn} ${tokens.duration.normal} ${tokens.easing.out}`,
    zIndex: tokens.zIndex.modal,
  },

  variants: {
    size: {
      sm: {
        width: '400px',
        maxWidth: '90vw',
      },
      md: {
        width: '560px',
        maxWidth: '90vw',
      },
      lg: {
        width: '720px',
        maxWidth: '90vw',
      },
      xl: {
        width: '900px',
        maxWidth: '90vw',
      },
      full: {
        width: '90vw',
        height: '90vh',
      },
    },
  },

  defaultVariants: {
    size: 'md',
  },
})

export type ModalVariants = RecipeVariants<typeof modal>

export const header = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `${tokens.space['4']} ${tokens.space['6']}`,
  borderBottom: `${tokens.borderWidth.default} solid ${tokens.color.border.subtle}`,
  flexShrink: 0,
})

export const title = style({
  margin: 0,
  fontSize: tokens.font.size.lg,
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.primary,
})

export const closeButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  padding: 0,
  border: 'none',
  borderRadius: tokens.radius.default,
  backgroundColor: 'transparent',
  color: tokens.color.text.secondary,
  cursor: 'pointer',
  transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,
  fontSize: tokens.font.size.xl,
  lineHeight: 1,

  ':hover': {
    backgroundColor: tokens.color.surface.hover,
    color: tokens.color.text.primary,
  },

  ':focus-visible': {
    outline: `2px solid ${tokens.color.border.focus}`,
    outlineOffset: '2px',
  },
})

export const content = style({
  padding: tokens.space['6'],
  overflow: 'auto',
  flex: 1,
})

export const footer = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: tokens.space['3'],
  padding: `${tokens.space['4']} ${tokens.space['6']}`,
  borderTop: `${tokens.borderWidth.default} solid ${tokens.color.border.subtle}`,
  flexShrink: 0,
})
