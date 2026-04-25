import { style } from '@vanilla-extract/css'

export const scenesContainer = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0',
})

/**
 * Invisible scroll anchor for a `background` block. Zero-height so it
 * doesn't disturb the prose flow; IntersectionObserver only needs a
 * positionable element, not a visible one.
 */
export const bgAnchor = style({
  display: 'block',
  width: '100%',
  height: '0',
  margin: '0',
  padding: '0',
})
