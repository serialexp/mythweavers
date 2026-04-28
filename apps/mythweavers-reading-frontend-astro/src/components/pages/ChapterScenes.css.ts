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

/**
 * Wrapper around an inline `<audio controls>` block. Centred and constrained
 * so the player doesn't stretch full-width on wide screens, with margin so
 * it sits cleanly between paragraph runs.
 */
export const audioWrap = style({
  display: 'flex',
  justifyContent: 'center',
  margin: '1.5rem auto',
  maxWidth: '640px',
  width: '100%',
})

export const audioPlayer = style({
  width: '100%',
  // Match Prose's max width so embedded players sit naturally with the prose.
  maxWidth: '100%',
})
