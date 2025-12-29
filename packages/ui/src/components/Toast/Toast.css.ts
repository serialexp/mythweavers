import { keyframes, style } from '@vanilla-extract/css'
import { type RecipeVariants, recipe } from '@vanilla-extract/recipes'
import { tokens } from '../../theme/tokens.css'

const slideIn = keyframes({
  '0%': { transform: 'translateX(100%)', opacity: 0 },
  '100%': { transform: 'translateX(0)', opacity: 1 },
})

export const containerBase = style({
  position: 'fixed',
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space['2'],
  zIndex: tokens.zIndex.tooltip,
  pointerEvents: 'none',
})

export const container = recipe({
  base: [containerBase],

  variants: {
    position: {
      'top-right': {
        top: tokens.space['4'],
        right: tokens.space['4'],
      },
      'top-left': {
        top: tokens.space['4'],
        left: tokens.space['4'],
      },
      'bottom-right': {
        bottom: tokens.space['4'],
        right: tokens.space['4'],
      },
      'bottom-left': {
        bottom: tokens.space['4'],
        left: tokens.space['4'],
      },
      'top-center': {
        top: tokens.space['4'],
        left: '50%',
        transform: 'translateX(-50%)',
      },
      'bottom-center': {
        bottom: tokens.space['4'],
        left: '50%',
        transform: 'translateX(-50%)',
      },
    },
  },

  defaultVariants: {
    position: 'bottom-right',
  },
})

export type ContainerVariants = RecipeVariants<typeof container>

export const toast = recipe({
  base: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: tokens.space['3'],
    padding: tokens.space['4'],
    minWidth: '300px',
    maxWidth: '420px',
    backgroundColor: tokens.color.bg.elevated,
    borderRadius: tokens.radius.md,
    boxShadow: tokens.shadow.lg,
    border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
    animation: `${slideIn} ${tokens.duration.normal} ${tokens.easing.out}`,
    pointerEvents: 'auto',
  },

  variants: {
    variant: {
      default: {},
      success: {
        borderLeftWidth: '4px',
        borderLeftColor: tokens.color.semantic.success,
      },
      warning: {
        borderLeftWidth: '4px',
        borderLeftColor: tokens.color.semantic.warning,
      },
      error: {
        borderLeftWidth: '4px',
        borderLeftColor: tokens.color.semantic.error,
      },
      info: {
        borderLeftWidth: '4px',
        borderLeftColor: tokens.color.semantic.info,
      },
    },
  },

  defaultVariants: {
    variant: 'default',
  },
})

export type ToastVariants = RecipeVariants<typeof toast>

export const icon = recipe({
  base: {
    flexShrink: 0,
    width: '20px',
    height: '20px',
  },

  variants: {
    variant: {
      default: {
        color: tokens.color.text.secondary,
      },
      success: {
        color: tokens.color.semantic.success,
      },
      warning: {
        color: tokens.color.semantic.warning,
      },
      error: {
        color: tokens.color.semantic.error,
      },
      info: {
        color: tokens.color.semantic.info,
      },
    },
  },

  defaultVariants: {
    variant: 'default',
  },
})

export const content = style({
  flex: 1,
  minWidth: 0,
})

export const title = style({
  fontSize: tokens.font.size.sm,
  fontWeight: tokens.font.weight.semibold,
  color: tokens.color.text.primary,
  marginBottom: tokens.space['0.5'],
})

export const message = style({
  fontSize: tokens.font.size.sm,
  color: tokens.color.text.secondary,
})

export const closeButton = style({
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '24px',
  height: '24px',
  padding: 0,
  border: 'none',
  borderRadius: tokens.radius.default,
  backgroundColor: 'transparent',
  color: tokens.color.text.muted,
  cursor: 'pointer',
  transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,

  ':hover': {
    backgroundColor: tokens.color.surface.hover,
    color: tokens.color.text.primary,
  },
})
