/**
 * Chronicle Theme - Raw Color Values
 *
 * These are the actual color values used by the Chronicle theme.
 * Import this for contrast calculations or anywhere you need the raw hex values.
 */
export const chronicleColors = {
  bg: {
    base: '#1c1816',
    raised: '#252220',
    elevated: '#302b27',
    overlay: 'rgba(28, 24, 22, 0.9)',
  },

  surface: {
    default: '#282421',
    hover: '#332e2a',
    active: '#3d3632',
    selected: '#453d35',
  },

  text: {
    primary: '#e8dcc8',
    secondary: '#b8a88e',
    muted: '#7a6c58',
    inverse: '#0d0b09',
  },

  border: {
    subtle: '#2a2420',
    default: '#3d3428',
    strong: '#5c4d3c',
    focus: '#c9a227',
  },

  accent: {
    primary: '#c9a227',
    primaryHover: '#d9b23a',
    primaryActive: '#b8921e',
    secondary: '#8b4d6e',
    secondaryHover: '#a05a80',
    secondaryActive: '#7a4260',
  },

  semantic: {
    success: '#4a7c59',
    successSubtle: '#1e2d22',
    warning: '#d97706', // Amber-orange, distinct from gold accent
    warningSubtle: '#2d2015',
    error: '#a63d40',
    errorSubtle: '#2d1a1b',
    info: '#5c7a99',
    infoSubtle: '#1a2129',
  },
}
