import * as PIXI from 'pixi.js'

/**
 * Marks the grid Graphics on the viewport so other hooks can find and redraw it
 * without threading a callback through every layer.
 */
export const DIAGNOSTIC_GRID_LABEL = 'diagnostic-grid'

/** How far past the world bounds the grid keeps drawing, as a fraction. */
const OVERDRAW = 0.5
/** Roughly how many cells to span the larger world axis. */
const TARGET_CELLS = 20

const COLOR_MINOR = 0x2a2a35
const COLOR_MAJOR = 0x3d3d4d
const COLOR_BOUNDS = 0x5a5a70

/**
 * Rounds a raw step up to the nearest 1/2/5 x power of ten, so grid spacing
 * reads as a round number at any map size instead of 137.4.
 */
export function niceStep(span: number, targetCells = TARGET_CELLS): number {
  if (!Number.isFinite(span) || span <= 0 || targetCells <= 0) return 1
  const raw = span / targetCells
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  for (const multiple of [1, 2, 5]) {
    if (raw <= magnitude * multiple) return magnitude * multiple
  }
  return magnitude * 10
}

/**
 * The extent the grid covers: the world, expanded so that panning off the map
 * still shows lines. Without the overdraw, panning past the edge gives an empty
 * void that looks identical to a dead renderer.
 */
export function gridExtent(worldWidth: number, worldHeight: number) {
  const w = Number.isFinite(worldWidth) && worldWidth > 0 ? worldWidth : 1000
  const h = Number.isFinite(worldHeight) && worldHeight > 0 ? worldHeight : 1000
  return {
    minX: -w * OVERDRAW,
    maxX: w * (1 + OVERDRAW),
    minY: -h * OVERDRAW,
    maxY: h * (1 + OVERDRAW),
    step: niceStep(Math.max(w, h)),
  }
}

/**
 * Draws a reference grid in world space, beneath everything else.
 *
 * This exists to make a broken canvas diagnosable. A blank map view is
 * otherwise ambiguous between a renderer that never got a size, a WebGL context
 * that failed, a texture that did not load, and a viewport panned into empty
 * space -- all four look like the same black rectangle. With a grid, only the
 * first two stay black, a missing texture shows the grid alone, and a stray
 * viewport shows the grid sliding past the bounds rectangle.
 *
 * It is invisible in normal use: the map sprite is opaque and sorts above it.
 */
export function drawDiagnosticGrid(grid: PIXI.Graphics, worldWidth: number, worldHeight: number): void {
  const { minX, maxX, minY, maxY, step } = gridExtent(worldWidth, worldHeight)
  grid.clear()

  // Minor and major lines are built as two batched paths rather than stroking
  // per line, which would be one draw call each.
  const majorEvery = step * 5
  const isMajor = (value: number) => Math.abs(value % majorEvery) < step / 2

  const firstX = Math.ceil(minX / step) * step
  const firstY = Math.ceil(minY / step) * step

  for (const major of [false, true]) {
    let drew = false
    for (let x = firstX; x <= maxX; x += step) {
      if (isMajor(x) !== major) continue
      grid.moveTo(x, minY).lineTo(x, maxY)
      drew = true
    }
    for (let y = firstY; y <= maxY; y += step) {
      if (isMajor(y) !== major) continue
      grid.moveTo(minX, y).lineTo(maxX, y)
      drew = true
    }
    // Stroking an empty path throws off Pixi's batcher; skip if nothing queued.
    if (drew) {
      grid.stroke({
        width: major ? 2 : 1,
        color: major ? COLOR_MAJOR : COLOR_MINOR,
        alpha: major ? 0.55 : 0.35,
      })
    }
  }

  // The world bounds themselves: where the map image should be sitting.
  grid.rect(0, 0, worldWidth, worldHeight).stroke({ width: 3, color: COLOR_BOUNDS, alpha: 0.8 })
}
