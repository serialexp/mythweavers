import { createThemeContract } from '@vanilla-extract/css'

/**
 * Design Token Contract
 *
 * This defines the shape of our design system. All themes must implement
 * every token defined here. The actual values are set in theme files.
 */
export const tokens = createThemeContract({
  // === COLOR SYSTEM ===
  color: {
    // Backgrounds - layered from deepest to surface
    bg: {
      base: null, // App background, deepest layer
      raised: null, // Cards, panels - one level up
      elevated: null, // Modals, dropdowns - highest elevation
      overlay: null, // Semi-transparent overlays
    },

    // Surfaces - interactive areas
    surface: {
      default: null, // Default interactive surface
      hover: null, // Hover state
      active: null, // Active/pressed state
      selected: null, // Selected state
    },

    // Text
    text: {
      primary: null, // Main content text
      secondary: null, // Supporting text, labels
      muted: null, // Disabled, placeholder text
      inverse: null, // Text on accent backgrounds
    },

    // Borders
    border: {
      subtle: null, // Barely visible separators
      default: null, // Standard borders
      strong: null, // Emphasized borders
      focus: null, // Focus ring color
    },

    // Accent colors - the personality of the theme
    accent: {
      primary: null, // Main brand/action color
      primaryHover: null,
      primaryActive: null,
      secondary: null, // Secondary accent
      secondaryHover: null,
      secondaryActive: null,
    },

    // Semantic colors
    semantic: {
      success: null,
      successSubtle: null,
      warning: null,
      warningSubtle: null,
      error: null,
      errorSubtle: null,
      info: null,
      infoSubtle: null,
    },
  },

  // === TYPOGRAPHY ===
  font: {
    family: {
      sans: null, // UI text
      serif: null, // Reading/content text
      mono: null, // Code
    },
    size: {
      xs: null, // 12px equivalent
      sm: null, // 14px
      base: null, // 16px
      lg: null, // 18px
      xl: null, // 20px
      '2xl': null, // 24px
      '3xl': null, // 30px
      '4xl': null, // 36px
    },
    weight: {
      normal: null,
      medium: null,
      semibold: null,
      bold: null,
    },
    lineHeight: {
      tight: null, // 1.25
      normal: null, // 1.5
      relaxed: null, // 1.75
    },
    letterSpacing: {
      tight: null,
      normal: null,
      wide: null,
    },
  },

  // === SPACING ===
  space: {
    px: null, // 1px
    '0.5': null, // 2px
    '1': null, // 4px
    '1.5': null, // 6px
    '2': null, // 8px
    '2.5': null, // 10px
    '3': null, // 12px
    '4': null, // 16px
    '5': null, // 20px
    '6': null, // 24px
    '8': null, // 32px
    '10': null, // 40px
    '12': null, // 48px
    '16': null, // 64px
    '20': null, // 80px
    '24': null, // 96px
  },

  // === BORDERS ===
  radius: {
    none: null,
    sm: null, // 2px - subtle rounding
    default: null, // 4px - standard
    md: null, // 6px
    lg: null, // 8px
    xl: null, // 12px
    '2xl': null, // 16px
    full: null, // 9999px - pills/circles
  },

  borderWidth: {
    thin: null, // 1px
    default: null, // 1px (can be same)
    thick: null, // 2px
  },

  // === SHADOWS ===
  shadow: {
    none: null,
    sm: null, // Subtle elevation
    default: null, // Standard cards
    md: null, // Dropdowns
    lg: null, // Modals
    xl: null, // Popovers
    inner: null, // Inset shadow
    glow: null, // Accent glow effect
  },

  // === MOTION ===
  duration: {
    instant: null, // 0ms
    fast: null, // 100ms
    normal: null, // 200ms
    slow: null, // 300ms
    slower: null, // 500ms
  },

  easing: {
    default: null, // Standard easing
    in: null, // Accelerate
    out: null, // Decelerate
    inOut: null, // Both
    bounce: null, // Playful
  },

  // === Z-INDEX ===
  zIndex: {
    hide: null, // -1
    base: null, // 0
    raised: null, // 10
    dropdown: null, // 100
    sticky: null, // 200
    modal: null, // 300
    popover: null, // 400
    tooltip: null, // 500
  },

  // === BREAKPOINTS (for reference, used in responsive utilities) ===
  // These are defined separately as they're used in media queries
})
