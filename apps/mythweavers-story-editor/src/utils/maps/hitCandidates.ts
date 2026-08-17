/**
 * Resolving what a click on the map actually hit.
 *
 * Pawns render above landmarks and swallow the pointer event, so a pawn parked
 * on a landmark makes that landmark unreachable. Rather than fight the z-order,
 * we collect *every* selectable thing near the cursor and step through them on
 * repeated clicks.
 *
 * These helpers are deliberately free of PIXI and of any store: callers hand in
 * screen-space positions they have already computed, so the ordering and cycling
 * rules can be tested on their own.
 */

/** Kinds of thing a click can land on. Paths are hit-tested by PIXI, not here. */
export type CandidateType = 'pawn' | 'landmark'

/** A selectable item, with the screen position its sprite currently occupies. */
export interface CandidatePoint {
  type: CandidateType
  id: string
  screenX: number
  screenY: number
}

/** The identity of a selected item, independent of where it happens to be. */
export interface CandidateRef {
  type: CandidateType
  id: string
}

/** Default click tolerance in screen pixels, matching the landmark snap radius. */
export const DEFAULT_HIT_RADIUS = 30

/**
 * Order two candidates for cycling.
 *
 * Pawns come before landmarks, so the first click on a stack lands on a pawn
 * (which is what the user sees on top) and the landmark underneath is reached by
 * clicking again. Within a type, nearer wins; ties break on id so the order is
 * stable across renders and does not depend on array order from the API.
 */
const compareCandidates = (a: CandidatePoint & { distance: number }, b: CandidatePoint & { distance: number }) => {
  if (a.type !== b.type) return a.type === 'pawn' ? -1 : 1
  if (a.distance !== b.distance) return a.distance - b.distance
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/**
 * Every candidate whose sprite sits within `radius` screen pixels of the click,
 * in the order repeated clicks should step through them.
 *
 * A non-finite radius, or non-finite candidate coordinates, are treated as
 * misses rather than allowed to poison the comparison.
 */
export function collectCandidatesAt(
  points: readonly CandidatePoint[],
  clickX: number,
  clickY: number,
  radius: number = DEFAULT_HIT_RADIUS,
): CandidatePoint[] {
  if (!Number.isFinite(clickX) || !Number.isFinite(clickY) || !Number.isFinite(radius) || radius < 0) {
    return []
  }

  const withinRadius: Array<CandidatePoint & { distance: number }> = []

  for (const point of points) {
    if (!Number.isFinite(point.screenX) || !Number.isFinite(point.screenY)) continue

    const dx = point.screenX - clickX
    const dy = point.screenY - clickY
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance <= radius) {
      withinRadius.push({ ...point, distance })
    }
  }

  withinRadius.sort(compareCandidates)

  return withinRadius.map(({ distance: _distance, ...point }) => point)
}

const isSameRef = (a: CandidateRef | null, b: CandidateRef | null): boolean =>
  a !== null && b !== null && a.type === b.type && a.id === b.id

/**
 * Pick which candidate a click should select.
 *
 * - Nothing under the cursor selects nothing (the caller deselects).
 * - If the current selection is part of this stack, advance to the next one,
 *   wrapping at the end. This is what makes repeated clicks cycle.
 * - Otherwise this is a fresh click on the stack: prefer the item PIXI actually
 *   hit, so the sprite the user aimed at is selected first. Fall back to the
 *   head of the stack when the hit item is unknown or is not a candidate.
 */
export function nextInCycle(
  candidates: readonly CandidatePoint[],
  current: CandidateRef | null,
  hit: CandidateRef | null = null,
): CandidateRef | null {
  if (candidates.length === 0) return null

  const currentIndex = candidates.findIndex((candidate) => isSameRef(candidate, current))

  if (currentIndex !== -1) {
    const next = candidates[(currentIndex + 1) % candidates.length]
    return { type: next.type, id: next.id }
  }

  const hitCandidate = candidates.find((candidate) => isSameRef(candidate, hit))
  const chosen = hitCandidate ?? candidates[0]

  return { type: chosen.type, id: chosen.id }
}
