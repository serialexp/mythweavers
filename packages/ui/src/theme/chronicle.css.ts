import { createTheme } from '@vanilla-extract/css'
import { chronicleColors } from './chronicle.colors'
import { tokens } from './tokens.css'

/**
 * Chronicle Theme - Dark Mode
 *
 * Inspired by Baldur's Gate / Divinity: Original Sin
 * Rich, warm, fantasy RPG aesthetic - candlelit, leather-bound tome feel
 *
 * Color palette centers on:
 * - Deep warm blacks and charcoals
 * - Parchment/amber highlights
 * - Gold accents
 * - Burgundy and forest green for semantic meaning
 */
export const chronicleTheme = createTheme(tokens, {
  color: chronicleColors,

  font: {
    family: {
      sans: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
      serif: '"Crimson Pro", "Georgia", "Times New Roman", serif',
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
    // Dark theme: subtle gold border + shadow for visibility
    sm: '0 0 0 1px rgba(201, 162, 39, 0.15), 0 2px 4px 0 rgba(0, 0, 0, 0.4)',
    default: '0 0 0 1px rgba(201, 162, 39, 0.2), 0 4px 8px 0 rgba(0, 0, 0, 0.4)',
    md: '0 0 0 1px rgba(201, 162, 39, 0.2), 0 6px 12px 0 rgba(0, 0, 0, 0.5)',
    lg: '0 0 0 1px rgba(201, 162, 39, 0.25), 0 12px 24px 0 rgba(0, 0, 0, 0.5)',
    xl: '0 0 0 1px rgba(201, 162, 39, 0.25), 0 20px 40px 0 rgba(0, 0, 0, 0.5)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.4)',
    glow: '0 0 20px rgba(201, 162, 39, 0.4)',
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
