import { tokens } from '@mythweavers/ui/theme'
import { globalStyle, keyframes, style } from '@vanilla-extract/css'

/**
 * Animated gradient ring around the card. The background-position slides
 * across a 400% wide gradient to give the impression of a rotating sheen.
 */
const glowRotate = keyframes({
  from: { backgroundPosition: '0% 50%' },
  to: { backgroundPosition: '100% 50%' },
})

const glowGradient =
  'linear-gradient(90deg, hsla(197, 100%, 64%, 1) 0%, hsla(339, 100%, 55%, 1) 50%, hsla(197, 100%, 64%, 1) 100%)'

/**
 * The container is the 3D scene root. It also acts as a CSS container so
 * children can size themselves with `cqi` units relative to the card width
 * — that's how text and padding scale with the grid cell rather than the
 * viewport.
 *
 * `containerType: inline-size` lets cqi units resolve to this element's
 * inline (horizontal) extent. Aspect ratio 2:3 mirrors a printed book cover.
 */
export const cardContainer = style({
  position: 'relative',
  width: '100%',
  aspectRatio: '2 / 3',
  perspective: '1500px',
  containerType: 'inline-size',
  // Reserve a little margin for the side-spine / glow that extend beyond the
  // card face, so they don't get clipped by adjacent grid cells.
  margin: '0 3px',
})

/**
 * The animated gradient ring that surrounds the card. Sits behind the card
 * (negative Z) and fades out on hover so the back face reads cleanly.
 */
export const cardGlow = style({
  position: 'absolute',
  inset: '-3px',
  zIndex: 0,
  borderRadius: tokens.radius.sm,
  transform: 'translateZ(calc(var(--thickness, 30px) * -1))',
  transition: 'transform 0.6s, opacity 0.6s',
  overflow: 'visible',
  '::after': {
    content: '""',
    display: 'block',
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    width: '100%',
    background: glowGradient,
    backgroundSize: '400% 100%',
    filter: 'blur(5px)',
    transform: 'translate3d(0, 0, 0)',
    animationName: glowRotate,
    animationDuration: '6s',
    animationTimingFunction: 'linear',
    animationIterationCount: 'infinite',
    opacity: 0.7,
    zIndex: 1,
    borderRadius: tokens.radius.sm,
  },
  selectors: {
    [`${cardContainer}:hover &`]: {
      opacity: 0,
    },
  },
})

/**
 * Inner crisp gradient under the blurred outer glow — gives the ring a
 * defined edge against the page background.
 */
export const cardGlowInner = style({
  position: 'absolute',
  inset: 0,
  zIndex: 1,
  '::before': {
    content: '""',
    display: 'block',
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    width: '100%',
    background: glowGradient,
    backgroundSize: '400% 100%',
    animationName: glowRotate,
    animationDuration: '6s',
    animationTimingFunction: 'linear',
    animationIterationCount: 'infinite',
    zIndex: 1,
    borderRadius: tokens.radius.sm,
  },
})

/**
 * The card itself — a 3D scene that flips on hover. At rest it sits at
 * `rotateY(7deg)` so you can see a sliver of the side-spine; on hover it
 * rotates a full 180° to reveal the back face with the blurb.
 */
export const card = style({
  position: 'absolute',
  inset: 0,
  transformStyle: 'preserve-3d',
  transformOrigin: 'center',
  transition: 'transform 0.6s ease, box-shadow 0.6s ease',
  transform: 'rotateY(7deg)',
  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
  selectors: {
    [`${cardContainer}:hover &`]: {
      transform: 'rotateY(180deg) translateZ(10px)',
      boxShadow: '0 8px 16px rgba(0, 0, 0, 0.3)',
    },
  },
})

/**
 * Faces of the card — front (cover) and back (blurb). Both fill the card
 * and use `backfaceVisibility: hidden` so only the one facing the camera
 * is visible at any time.
 */
const cardFace = style({
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backfaceVisibility: 'hidden',
  WebkitBackfaceVisibility: 'hidden',
  borderRadius: tokens.radius.sm,
  overflow: 'hidden',
})

/**
 * The cover face. Inner shadow on the spine side gives a subtle "binding"
 * appearance; the `:after` 3-px strip is the gutter.
 */
export const cardFront = style([
  cardFace,
  {
    zIndex: 1,
    boxShadow: 'inset 4px 0 10px rgba(0, 0, 0, 0.1)',
    flexDirection: 'column',
    '::after': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: '4px',
      bottom: 0,
      width: '3px',
      background: 'rgba(0, 0, 0, 0.1)',
      boxShadow: '1px 0 3px rgba(255, 255, 255, 0.1)',
      zIndex: 1,
    },
  },
])

/**
 * The blurb face. Pre-rotated 180° + pushed out by the book's full thickness
 * so it sits on the back of the spine when the card flips.
 */
export const cardBack = style([
  cardFace,
  {
    transform: 'rotateY(180deg) translateZ(var(--thickness, 30px))',
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    padding: 'clamp(8px, 4cqi, 20px)',
    gap: 'clamp(4px, 2cqi, 10px)',
    '::after': {
      content: '""',
      position: 'absolute',
      top: 0,
      right: '4px',
      bottom: 0,
      width: '3px',
      background: 'rgba(0, 0, 0, 0.1)',
      boxShadow: '1px 0 3px rgba(255, 255, 255, 0.1)',
    },
  },
])

/**
 * The visible side of the spine — a thin slab rotated -90° around its left
 * edge and translated out by half the thickness so the cover and back share
 * its plane. Width is driven by `--thickness` (computed from page count) so
 * thicker books look thicker.
 */
export const cardLeft = style({
  position: 'absolute',
  width: 'var(--thickness, 30px)',
  height: '100%',
  backfaceVisibility: 'hidden',
  WebkitBackfaceVisibility: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: `linear-gradient(
      90deg,
      rgba(2, 0, 36, 1) 0%,
      rgba(3, 1, 43, 0) 2%,
      rgba(255, 255, 255, 0.16) 37%,
      rgba(255, 255, 255, 0.16) 59%,
      rgba(0, 0, 6, 0) 98%,
      rgba(0, 0, 0, 1) 100%
    ), var(--cover-color, #666)`,
  transform:
    'rotateY(-90deg) translateX(calc(var(--half-thickness, 15px) * -1)) translateZ(var(--half-thickness, 15px))',
})

/**
 * Cover image fills the front face. We keep `objectFit: cover` so any aspect
 * ratio art crops gracefully into the 2:3 cover.
 */
export const coverImage = style({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
})

/**
 * Fallback shown on the front when there's no cover art — a centered title
 * over the cover color, matching legacy behavior.
 */
export const titleFallback = style({
  textAlign: 'center',
  alignSelf: 'flex-start',
  marginTop: 'clamp(16px, 8cqi, 40px)',
  paddingLeft: 'clamp(8px, 4cqi, 20px)',
  paddingRight: 'clamp(8px, 4cqi, 20px)',
  fontSize: 'clamp(0.875rem, 6cqi, 1.5rem)',
  fontWeight: tokens.font.weight.bold,
  lineHeight: tokens.font.lineHeight.tight,
  margin: 0,
})

/* ============ Back-face content ============ */

export const backTitle = style({
  fontSize: 'clamp(0.875rem, 5.5cqi, 1.25rem)',
  fontWeight: tokens.font.weight.bold,
  lineHeight: tokens.font.lineHeight.tight,
  margin: 0,
})

export const backMeta = style({
  fontSize: 'clamp(0.625rem, 3.2cqi, 0.875rem)',
  opacity: 0.85,
  margin: 0,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
})

export const backSummary = style({
  fontSize: 'clamp(0.625rem, 3cqi, 0.85rem)',
  lineHeight: tokens.font.lineHeight.normal,
  flex: 1,
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 6,
})

// Defensive global rule: the summary HTML may contain `<p>` tags from the
// editor; collapse their default margin so the line-clamp stays tight.
globalStyle(`${backSummary} p`, {
  margin: 0,
})

export const backActions = style({
  display: 'flex',
  flexDirection: 'row',
  gap: 'clamp(4px, 2cqi, 8px)',
  justifyContent: 'space-around',
  marginTop: 'auto',
})
