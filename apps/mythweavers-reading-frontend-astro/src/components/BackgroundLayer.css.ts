import { style } from '@vanilla-extract/css'

/**
 * Fixed root that fills the viewport and sits behind page content.
 * Pointer-events disabled so it never intercepts clicks on the prose.
 */
export const layerRoot = style({
  position: 'fixed',
  inset: 0,
  zIndex: -1,
  pointerEvents: 'none',
  overflow: 'hidden',
})

/**
 * One of two stacked image layers. CSS opacity transition crossfades
 * between them. We use background-image (centred + cover-sized) so the
 * image scales with the viewport without depending on the file's
 * intrinsic dimensions.
 */
export const layer = style({
  position: 'absolute',
  inset: 0,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  transition: 'opacity 700ms ease-in-out',
  willChange: 'opacity',

  '@media': {
    '(prefers-reduced-motion: reduce)': {
      transition: 'opacity 0s',
    },
  },
})

/**
 * Subtle dark scrim layered on top of the background image so the
 * page's prose stays legible regardless of image brightness. Uses
 * a vertical gradient that's stronger near the centre where text lives.
 */
export const scrim = style({
  position: 'absolute',
  inset: 0,
  background: 'linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0.55) 40%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.35))',
  pointerEvents: 'none',
})
