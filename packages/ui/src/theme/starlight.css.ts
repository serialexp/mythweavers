import { createTheme } from '@vanilla-extract/css'
import { starlightColors } from './starlight.colors'
import { tokens } from './tokens.css'

/**
 * Starlight Theme - Light Mode
 *
 * Inspired by Star Trek / Star Wars aesthetic
 * Clean, sci-fi optimism - crisp whites, subtle blues, metallic accents
 * LCARS-influenced confidence with approachable warmth
 *
 * Color palette centers on:
 * - Clean whites and light grays
 * - Cool blue-grays for depth
 * - Electric blue as primary accent
 * - Metallic silvers and teals
 */
export const starlightTheme = createTheme(tokens, {
  color: starlightColors,

  font: {
    family: {
      sans: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
      serif: '"Source Serif Pro", "Georgia", "Times New Roman", serif',
      mono: '"JetBrains Mono", "Fira Code", "Consolas", monospace',
    },
    size: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
    },
    weight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    lineHeight: {
      tight: '1.25',
      normal: '1.5',
      relaxed: '1.75',
    },
    letterSpacing: {
      tight: '-0.025em',
      normal: '0',
      wide: '0.025em',
    },
  },

  space: {
    px: '1px',
    '0.5': '0.125rem',
    '1': '0.25rem',
    '1.5': '0.375rem',
    '2': '0.5rem',
    '2.5': '0.625rem',
    '3': '0.75rem',
    '4': '1rem',
    '5': '1.25rem',
    '6': '1.5rem',
    '8': '2rem',
    '10': '2.5rem',
    '12': '3rem',
    '16': '4rem',
    '20': '5rem',
    '24': '6rem',
  },

  radius: {
    none: '0',
    sm: '0.125rem',
    default: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '1rem',
    full: '9999px',
  },

  borderWidth: {
    thin: '1px',
    default: '1px',
    thick: '2px',
  },

  shadow: {
    none: 'none',
    sm: '0 1px 2px 0 rgba(26, 31, 46, 0.05)',
    default: '0 2px 4px 0 rgba(26, 31, 46, 0.08), 0 1px 2px 0 rgba(26, 31, 46, 0.04)',
    md: '0 4px 6px -1px rgba(26, 31, 46, 0.1), 0 2px 4px -1px rgba(26, 31, 46, 0.06)',
    lg: '0 10px 15px -3px rgba(26, 31, 46, 0.1), 0 4px 6px -2px rgba(26, 31, 46, 0.05)',
    xl: '0 20px 25px -5px rgba(26, 31, 46, 0.1), 0 10px 10px -5px rgba(26, 31, 46, 0.04)',
    inner: 'inset 0 2px 4px 0 rgba(26, 31, 46, 0.05)',
    glow: '0 0 20px rgba(59, 125, 216, 0.25)', // Blue glow
  },

  duration: {
    instant: '0ms',
    fast: '100ms',
    normal: '200ms',
    slow: '300ms',
    slower: '500ms',
  },

  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },

  zIndex: {
    hide: '-1',
    base: '0',
    raised: '10',
    dropdown: '100',
    sticky: '200',
    modal: '300',
    popover: '400',
    tooltip: '500',
  },
})
