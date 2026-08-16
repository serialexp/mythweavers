/**
 * Text width measurement for layout decisions that have to be made before
 * anything is rendered.
 *
 * Uses a canvas rather than a probe element in the DOM: `measureText` reads no
 * layout, so it can be called for hundreds of labels inside a memo without
 * forcing a reflow. Results are cached per font+text, since the same titles are
 * re-measured on every pan and zoom.
 */

let context: CanvasRenderingContext2D | null | undefined
const cache = new Map<string, number>()

/**
 * Rough fallback for environments with no canvas (jsdom/happy-dom in tests, or
 * a browser that refuses the context). Deliberately an over-estimate: guessing
 * a label is wider than it is costs a hidden label, while guessing narrow puts
 * two labels on top of each other.
 */
const FALLBACK_CHAR_WIDTH = 0.62

function estimate(text: string, fontSizePx: number): number {
  return text.length * fontSizePx * FALLBACK_CHAR_WIDTH
}

function getContext(): CanvasRenderingContext2D | null {
  if (context !== undefined) return context
  try {
    context = document.createElement('canvas').getContext('2d')
  } catch {
    context = null
  }
  return context
}

/**
 * Width of `text` in pixels when rendered in `font` (any valid CSS `font`
 * shorthand, e.g. `'12px system-ui'`).
 *
 * `fontSizePx` is used only by the no-canvas fallback; it should match the size
 * in `font`.
 */
export function measureTextWidth(text: string, font: string, fontSizePx: number): number {
  if (!text) return 0

  const key = `${font}|${text}`
  const cached = cache.get(key)
  if (cached !== undefined) return cached

  const ctx = getContext()
  let width: number
  if (ctx) {
    ctx.font = font
    width = ctx.measureText(text).width
    // happy-dom returns 0 for every string; an all-zero result would collapse
    // every spacing decision into "everything fits".
    if (width === 0) width = estimate(text, fontSizePx)
  } else {
    width = estimate(text, fontSizePx)
  }

  cache.set(key, width)
  return width
}

/** Drops the memoised widths. Only needed when the font itself changes. */
export function clearTextWidthCache(): void {
  cache.clear()
}
