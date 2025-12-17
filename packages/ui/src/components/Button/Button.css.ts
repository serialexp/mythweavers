import { keyframes, style } from '@vanilla-extract/css'
import { type RecipeVariants, recipe } from '@vanilla-extract/recipes'
import { tokens } from '../../theme/tokens.css'

const spinGradient = keyframes({
  '0%': { transform: 'translate(-50%, -50%) rotate(0deg)' },
  '100%': { transform: 'translate(-50%, -50%) rotate(360deg)' },
})

const base = style({
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: tokens.space['2'],
  fontFamily: tokens.font.family.sans,
  fontWeight: tokens.font.weight.medium,
  lineHeight: tokens.font.lineHeight.tight,
  borderRadius: tokens.radius.default,
  border: 'none',
  cursor: 'pointer',
  transition: `all ${tokens.duration.fast} ${tokens.easing.default}`,
  userSelect: 'none',
  overflow: 'hidden',
  isolation: 'isolate',
  // Fallback background prevents white flash when ::before transitions
  // between gradient and solid (browsers can't interpolate these smoothly)
  backgroundColor: tokens.color.accent.primary,

  ':disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },

  ':focus-visible': {
    outline: `2px solid ${tokens.color.border.focus}`,
    outlineOffset: '2px',
  },

  // Spinning gradient layer - starts as solid color, becomes gradient on hover
  // Uses aspect-ratio: 1 to create a square based on width, ensuring
  // the gradient covers the button at all rotation angles (even for wide buttons)
  '::before': {
    content: '""',
    position: 'absolute',
    aspectRatio: '1',
    width: 'max(300%, 200px)',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    background: tokens.color.accent.primary,
    // Fast transition OUT so gradient disappears before rotation animation stops
    transition: 'background 50ms ease-out',
    zIndex: -2,
  },

  // Inner background that covers the gradient except at edges
  '::after': {
    content: '""',
    position: 'absolute',
    inset: '2px',
    borderRadius: `calc(${tokens.radius.default} - 2px)`,
    backgroundColor: tokens.color.accent.primary,
    transition: `background-color ${tokens.duration.fast} ${tokens.easing.default}`,
    zIndex: -1,
  },

  selectors: {
    '&:hover:not(:disabled)::before': {
      background: `conic-gradient(
        from 0deg,
        ${tokens.color.accent.primary},
        ${tokens.color.accent.primaryHover},
        ${tokens.color.accent.secondary},
        ${tokens.color.accent.secondaryHover},
        ${tokens.color.accent.primary}
      )`,
      // Slower transition IN for smooth gradient appearance
      transition: `background ${tokens.duration.normal} ${tokens.easing.default}`,
      animation: `${spinGradient} 3s linear infinite`,
    },
    '&:active:not(:disabled)::before': {
      animation: `${spinGradient} 1s linear infinite`,
    },
  },
})

// Separate style for ghost + pressed (compound variants don't work reliably)
// Match the specificity of the hover selector: .class:hover:not(:disabled)
export const pressedGhostStyle = style({
  selectors: {
    '&&:not(:disabled), &&:hover:not(:disabled)': {
      backgroundColor: tokens.color.surface.selected,
    },
  },
})

export const button = recipe({
  base,

  variants: {
    variant: {
      primary: {
        color: tokens.color.text.inverse,
        selectors: {
          '&:hover:not(:disabled)::after': {
            backgroundColor: tokens.color.accent.primaryHover,
          },
          '&:active:not(:disabled)': {
            transform: 'scale(0.97)',
          },
          '&:active:not(:disabled)::after': {
            backgroundColor: tokens.color.accent.primaryActive,
          },
        },
      },
      secondary: {
        color: tokens.color.text.primary,
        backgroundColor: tokens.color.border.default,
        selectors: {
          '&::after': {
            backgroundColor: tokens.color.surface.default,
            border: `${tokens.borderWidth.default} solid ${tokens.color.border.default}`,
          },
          '&::before': {
            background: tokens.color.border.default,
          },
          '&:hover:not(:disabled)::before': {
            background: `conic-gradient(
              from 0deg,
              ${tokens.color.border.strong},
              ${tokens.color.border.default},
              ${tokens.color.accent.primary},
              ${tokens.color.border.default},
              ${tokens.color.border.strong}
            )`,
          },
          '&:hover:not(:disabled)::after': {
            backgroundColor: tokens.color.surface.hover,
            borderColor: tokens.color.border.strong,
          },
          '&:active:not(:disabled)': {
            transform: 'scale(0.97)',
          },
          '&:active:not(:disabled)::after': {
            backgroundColor: tokens.color.surface.active,
          },
        },
      },
      ghost: {
        color: tokens.color.text.primary,
        backgroundColor: 'transparent',
        selectors: {
          '&::after': {
            display: 'none',
          },
          '&::before': {
            display: 'none',
          },
          '&:hover:not(:disabled)::before': {
            display: 'none',
          },
          '&:hover:not(:disabled)': {
            backgroundColor: tokens.color.surface.hover,
          },
          '&:active:not(:disabled)': {
            backgroundColor: tokens.color.surface.selected,
            transform: 'scale(0.95)',
          },
        },
      },
      danger: {
        color: tokens.color.text.inverse,
        backgroundColor: tokens.color.semantic.error,
        selectors: {
          '&::after': {
            backgroundColor: tokens.color.semantic.error,
          },
          '&::before': {
            background: tokens.color.semantic.error,
          },
          '&:hover:not(:disabled)::before': {
            background: `conic-gradient(
              from 0deg,
              ${tokens.color.semantic.error},
              ${tokens.color.accent.secondary},
              ${tokens.color.semantic.error}
            )`,
          },
          '&:hover:not(:disabled)::after': {
            filter: 'brightness(1.1)',
          },
          '&:active:not(:disabled)': {
            transform: 'scale(0.97)',
          },
          '&:active:not(:disabled)::after': {
            filter: 'brightness(0.95)',
          },
        },
      },
    },

    size: {
      sm: {
        height: '32px',
        paddingLeft: tokens.space['3'],
        paddingRight: tokens.space['3'],
        fontSize: tokens.font.size.sm,
      },
      md: {
        height: '40px',
        paddingLeft: tokens.space['4'],
        paddingRight: tokens.space['4'],
        fontSize: tokens.font.size.base,
      },
      lg: {
        height: '48px',
        paddingLeft: tokens.space['6'],
        paddingRight: tokens.space['6'],
        fontSize: tokens.font.size.lg,
      },
    },

    fullWidth: {
      true: {
        width: '100%',
      },
    },

    // Icon-only button (square, no text padding)
    iconOnly: {
      true: {},
    },

    // Manually controlled pressed state (for use with preventDefault scenarios)
    pressed: {
      true: {
        transform: 'scale(0.95)',
      },
    },
  },

  compoundVariants: [
    // Icon-only size adjustments - make buttons square
    {
      variants: { iconOnly: true, size: 'sm' },
      style: {
        width: '32px',
        paddingLeft: 0,
        paddingRight: 0,
      },
    },
    {
      variants: { iconOnly: true, size: 'md' },
      style: {
        width: '40px',
        paddingLeft: 0,
        paddingRight: 0,
      },
    },
    {
      variants: { iconOnly: true, size: 'lg' },
      style: {
        width: '48px',
        paddingLeft: 0,
        paddingRight: 0,
      },
    },
    // Pressed state background colors per variant (ghost handled separately in Button.tsx)
    {
      variants: { pressed: true, variant: 'secondary' },
      style: {
        selectors: {
          '&::after': {
            backgroundColor: tokens.color.surface.selected,
          },
        },
      },
    },
    {
      variants: { pressed: true, variant: 'primary' },
      style: {
        selectors: {
          '&::after': {
            backgroundColor: tokens.color.accent.primaryActive,
          },
        },
      },
    },
    {
      variants: { pressed: true, variant: 'danger' },
      style: {
        selectors: {
          '&::after': {
            filter: 'brightness(0.9)',
          },
        },
      },
    },
  ],

  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
})

export type ButtonVariants = RecipeVariants<typeof button>
