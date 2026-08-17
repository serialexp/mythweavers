/**
 * Timeline Layout
 *
 * Pure geometry and inference helpers for the timeline editor. Everything here
 * is deliberately free of stores and Solid primitives so it can be unit tested
 * and so the view layer stays a thin rendering shell.
 *
 * Vocabulary:
 * - `storyTime` is an absolute number of minutes on the story's in-world
 *   calendar. It can be negative (before the calendar epoch) and `0` is a
 *   perfectly ordinary value -- never test it for truthiness.
 * - a `Viewport` is the visible slice of that axis.
 */

import { Node } from '../types/core'

/** Visible slice of the time axis, in absolute story-time minutes. */
export interface Viewport {
  start: number
  end: number
}

/** How a scene's displayed position was arrived at. */
export type TimeConfidence =
  /** The scene has a real, persisted `storyTime`. */
  | 'exact'
  /** Inferred between two timed neighbours in narrative order. */
  | 'interpolated'
  /** Inferred past the first or last timed scene. */
  | 'extrapolated'
  /** No defensible position -- the scene is not placed on the axis. */
  | 'unknown'

export interface ResolvedSceneTime {
  time: number
  confidence: TimeConfidence
}

/** A scene only carries a real time when `storyTime` is an actual number. */
export function hasStoryTime(node: Pick<Node, 'storyTime'>): boolean {
  return node.storyTime !== null && node.storyTime !== undefined
}

// ---------------------------------------------------------------------------
// Viewport <-> pixel math
// ---------------------------------------------------------------------------

/** Fraction (0..1) of the viewport width at which `time` sits. Unclamped. */
export function timeToFraction(time: number, viewport: Viewport): number {
  const span = viewport.end - viewport.start
  if (span <= 0) return 0
  return (time - viewport.start) / span
}

/** Absolute story time at a fraction (0..1) across the viewport. */
export function fractionToTime(fraction: number, viewport: Viewport): number {
  return viewport.start + fraction * (viewport.end - viewport.start)
}

/** Minutes represented by a single pixel at the current zoom. */
export function minutesPerPixel(viewport: Viewport, widthPx: number): number {
  if (widthPx <= 0) return 0
  return (viewport.end - viewport.start) / widthPx
}

/** Convert a horizontal pixel drag distance into a story-time delta. */
export function pixelDeltaToMinutes(deltaPx: number, viewport: Viewport, widthPx: number): number {
  return deltaPx * minutesPerPixel(viewport, widthPx)
}

/**
 * Zoom about a fixed point, so the time under the cursor stays under the
 * cursor. `factor` < 1 zooms in, > 1 zooms out.
 */
export function zoomViewport(viewport: Viewport, factor: number, anchorFraction: number): Viewport {
  const span = viewport.end - viewport.start
  const anchorTime = fractionToTime(anchorFraction, viewport)
  const newSpan = clampSpan(span * factor)
  return {
    start: anchorTime - anchorFraction * newSpan,
    end: anchorTime + (1 - anchorFraction) * newSpan,
  }
}

/** Shift the viewport without changing its span. */
export function panViewport(viewport: Viewport, deltaMinutes: number): Viewport {
  return { start: viewport.start + deltaMinutes, end: viewport.end + deltaMinutes }
}

/** One hour is the tightest useful zoom; a millennium the loosest. */
const MIN_SPAN_MINUTES = 60
const MAX_SPAN_MINUTES = 1000 * 365 * 24 * 60

function clampSpan(span: number): number {
  return Math.min(MAX_SPAN_MINUTES, Math.max(MIN_SPAN_MINUTES, span))
}

// ---------------------------------------------------------------------------
// Snap ladder
// ---------------------------------------------------------------------------

/**
 * Time units the ruler ticks and drag-snapping step through, smallest first.
 * Derived from the calendar config rather than hardcoded, because
 * `minutesPerHour` / `minutesPerDay` are user-editable in the calendar editor.
 */
export function buildUnitLadder(minutesPerHour: number, minutesPerDay: number, daysPerYear: number): number[] {
  const hour = minutesPerHour > 0 ? minutesPerHour : 60
  const day = minutesPerDay > 0 ? minutesPerDay : hour * 24
  const year = daysPerYear > 0 ? day * daysPerYear : day * 365
  return [1, hour, day, day * 7, day * 30, year, year * 10, year * 100]
}

/**
 * Pick the smallest ladder unit that is still at least `minPx` wide on screen.
 *
 * This is what makes dragging usable at every zoom: snapping to a fixed story
 * granularity means that at a one-day zoom a `day` step never moves the chip,
 * and at a five-year zoom an `hour` step is finer than a pixel of hand tremor.
 */
export function pickSnapStep(viewport: Viewport, widthPx: number, ladder: number[], minPx = 6): number {
  const mpp = minutesPerPixel(viewport, widthPx)
  if (mpp <= 0) return ladder[0]
  const minMinutes = mpp * minPx
  return ladder.find((unit) => unit >= minMinutes) ?? ladder[ladder.length - 1]
}

/**
 * Snap to the nearest multiple of `step` and round to an integer.
 *
 * The integer rounding is not cosmetic: both `PATCH /my/scenes/:id` and
 * `POST /my/stories/:id/nodes/bulk-update` validate `storyTime` as
 * `z.number().int()`, and the bulk route validates the whole array, so a single
 * fractional value rejects an entire multi-scene drag.
 */
export function snapTime(time: number, step: number): number {
  if (!Number.isFinite(time)) return 0
  if (step <= 0) return Math.round(time)
  return Math.round(Math.round(time / step) * step)
}

/** Tick positions covering the viewport at the given step. */
export function generateTicks(viewport: Viewport, step: number, maxTicks = 200): number[] {
  if (step <= 0) return []
  const span = viewport.end - viewport.start
  if (span <= 0 || span / step > maxTicks) return []

  const ticks: number[] = []
  const first = Math.ceil(viewport.start / step) * step
  for (let t = first; t <= viewport.end; t += step) {
    ticks.push(t)
  }
  return ticks
}

/** One labellable item on a track: where it sits, and how wide its label is. */
export interface LabelCandidate {
  id: string
  time: number
  /** Rendered width of the label in pixels, including any surrounding chrome. */
  widthPx: number
}

/**
 * Choose which items can show their label without running into the next one.
 *
 * Walks left to right keeping the right-hand edge of the last label that was
 * granted, and skips anything that would start before it. Measuring each label
 * matters because they are not uniform: spacing by a fixed distance either lets
 * a long label overrun its neighbour or hides a short one that had room.
 *
 * `gapPx` is the clear space demanded after each label.
 */
export function pickLabelledItems(
  candidates: LabelCandidate[],
  viewport: Viewport,
  widthPx: number,
  gapPx: number,
): Set<string> {
  const allowed = new Set<string>()
  const span = viewport.end - viewport.start
  if (span <= 0 || widthPx <= 0) return allowed

  const sorted = [...candidates].sort((a, b) => a.time - b.time)
  let lastLabelEnd = Number.NEGATIVE_INFINITY

  for (const candidate of sorted) {
    const x = ((candidate.time - viewport.start) / span) * widthPx
    if (x < lastLabelEnd) continue
    allowed.add(candidate.id)
    lastLabelEnd = x + candidate.widthPx + gapPx
  }

  return allowed
}

/** One chip to assign a collision-free vertical stack row within a POV lane. */
export interface StackCandidate {
  id: string
  time: number
  /** Full horizontal footprint, including the chip's visible label and hit area. */
  widthPx: number
}

export interface StackLayout {
  /** Zero-based vertical row for each scene id. */
  rows: Map<string, number>
  /** Chips that belong to an overlapping group and therefore have their own row. */
  stackedIds: Set<string>
  /** Number of rows needed to render every candidate without overlap. */
  rowCount: number
}

/**
 * Assign chips to the lowest vertical row whose preceding chip no longer
 * overlaps horizontally. Input order breaks equal-time ties, which preserves
 * narrative order and keeps the result stable across renders.
 */
export function assignStackLanes(candidates: StackCandidate[], viewport: Viewport, widthPx: number): StackLayout {
  const rows = new Map<string, number>()
  const stackedIds = new Set<string>()
  const span = viewport.end - viewport.start
  if (span <= 0 || widthPx <= 0) return { rows, stackedIds, rowCount: 1 }

  const sorted = candidates
    .map((candidate, order) => ({ ...candidate, order, left: ((candidate.time - viewport.start) / span) * widthPx }))
    .sort((a, b) => a.left - b.left || a.order - b.order)
  const rowEnds: number[] = []
  const rowIds: string[][] = []

  for (const candidate of sorted) {
    const row = rowEnds.findIndex((end) => end <= candidate.left)
    const assignedRow = row === -1 ? rowEnds.length : row
    if (assignedRow > 0) {
      stackedIds.add(candidate.id)
      for (let index = 0; index < rowEnds.length; index++) {
        if (rowEnds[index] > candidate.left) {
          for (const id of rowIds[index] ?? []) stackedIds.add(id)
        }
      }
    }
    rowEnds[assignedRow] = candidate.left + candidate.widthPx
    ;(rowIds[assignedRow] ??= []).push(candidate.id)
    rows.set(candidate.id, assignedRow)
  }

  return { rows, stackedIds, rowCount: Math.max(1, rowEnds.length) }
}

// ---------------------------------------------------------------------------
// Inferred positions for scenes without a storyTime
// ---------------------------------------------------------------------------

/**
 * Work out where to draw every scene, including the ones with no `storyTime`.
 *
 * Untimed scenes are placed by looking at their neighbours in *narrative*
 * order, which is a guess -- so each result carries a `confidence` and the view
 * renders anything other than `exact` as provisional. The value never leaves
 * the view: nothing is persisted until the user actually drags the chip.
 *
 * `scenesInNarrativeOrder` should come from `getScenesInStoryOrder`.
 */
export function resolveSceneTimes(
  scenesInNarrativeOrder: Node[],
  fallbackStepMinutes: number,
): Map<string, ResolvedSceneTime> {
  const resolved = new Map<string, ResolvedSceneTime>()
  const scenes = scenesInNarrativeOrder

  // Indices of the scenes that actually carry a time.
  const anchors: Array<{ index: number; time: number }> = []
  scenes.forEach((scene, index) => {
    if (hasStoryTime(scene)) {
      anchors.push({ index, time: scene.storyTime as number })
    }
  })

  // Nothing to anchor against -- refuse to invent an axis position for
  // anything. The view shows an empty state rather than a pile of chips at 0.
  if (anchors.length === 0) {
    for (const scene of scenes) {
      resolved.set(scene.id, { time: 0, confidence: 'unknown' })
    }
    return resolved
  }

  for (const anchor of anchors) {
    resolved.set(scenes[anchor.index].id, { time: anchor.time, confidence: 'exact' })
  }

  const step = fallbackStepMinutes > 0 ? fallbackStepMinutes : 1
  const first = anchors[0]
  const last = anchors[anchors.length - 1]

  // Head: everything before the first timed scene, stepping backwards.
  for (let i = 0; i < first.index; i++) {
    resolved.set(scenes[i].id, {
      time: first.time - step * (first.index - i),
      confidence: 'extrapolated',
    })
  }

  // Tail: everything after the last timed scene, stepping forwards.
  for (let i = last.index + 1; i < scenes.length; i++) {
    resolved.set(scenes[i].id, {
      time: last.time + step * (i - last.index),
      confidence: 'extrapolated',
    })
  }

  // Interior: distribute each run of untimed scenes across the gap between the
  // anchors that bracket it.
  for (let a = 0; a < anchors.length - 1; a++) {
    const prev = anchors[a]
    const next = anchors[a + 1]
    if (next.index === prev.index + 1) continue // no gap

    const span = next.time - prev.time

    // Narrative order disagrees with chronological order -- a flashback. Any
    // interpolation here would march backwards across its own anchors, so we
    // decline to guess rather than inventing something the author might trust.
    if (span < 0) {
      for (let i = prev.index + 1; i < next.index; i++) {
        resolved.set(scenes[i].id, { time: prev.time, confidence: 'unknown' })
      }
      continue
    }

    // Both anchors at the same instant: every scene between them collapses onto
    // one point. Keep the honest value; the view fans them out visually so they
    // stay individually clickable.
    const divisions = next.index - prev.index
    for (let i = prev.index + 1; i < next.index; i++) {
      resolved.set(scenes[i].id, {
        time: prev.time + (span * (i - prev.index)) / divisions,
        confidence: 'interpolated',
      })
    }
  }

  return resolved
}

/**
 * Range that comfortably contains every timed scene, with a margin so the
 * outermost chips are not flush against the edges.
 *
 * Deliberately scene-only. `getTimelineRange` in `timelineUtils` also honours
 * chapter `storyTime`, which the backend does not persist -- letting it widen
 * the initial viewport opens the timeline zoomed out over empty space.
 */
export function sceneTimeExtent(scenes: Node[], fallbackStepMinutes: number): Viewport | null {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY

  for (const scene of scenes) {
    if (!hasStoryTime(scene)) continue
    const time = scene.storyTime as number
    if (time < min) min = time
    if (time > max) max = time
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) return null

  // A single timed scene has no extent of its own; give it a window to sit in.
  if (min === max) {
    const pad = fallbackStepMinutes > 0 ? fallbackStepMinutes * 5 : 1440 * 5
    return { start: min - pad, end: max + pad }
  }

  const margin = (max - min) * 0.05
  return { start: min - margin, end: max + margin }
}

// ---------------------------------------------------------------------------
// Marquee selection
// ---------------------------------------------------------------------------

export interface Rect {
  left: number
  top: number
  right: number
  bottom: number
}

/** Build a normalised rect from two corners, whichever way they were dragged. */
export function rectFromPoints(x1: number, y1: number, x2: number, y2: number): Rect {
  return {
    left: Math.min(x1, x2),
    right: Math.max(x1, x2),
    top: Math.min(y1, y2),
    bottom: Math.max(y1, y2),
  }
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top
}

/** A marquee smaller than this is treated as a click, not a selection sweep. */
export const DRAG_THRESHOLD_PX = 4

export function exceedsDragThreshold(dx: number, dy: number, threshold = DRAG_THRESHOLD_PX): boolean {
  return Math.abs(dx) >= threshold || Math.abs(dy) >= threshold
}
