import { describe, expect, it } from 'vitest'
import { CandidatePoint, collectCandidatesAt, nextInCycle } from './hitCandidates'

const at = (type: 'pawn' | 'landmark', id: string, screenX: number, screenY: number): CandidatePoint => ({
  type,
  id,
  screenX,
  screenY,
})

/** The case this whole module exists for: two pawns parked on a landmark. */
const stack = [at('landmark', 'lm-1', 100, 100), at('pawn', 'pawn-b', 100, 100), at('pawn', 'pawn-a', 100, 100)]

describe('collectCandidatesAt', () => {
  it('returns nothing when the click is nowhere near anything', () => {
    expect(collectCandidatesAt(stack, 500, 500)).toEqual([])
  })

  it('collects everything stacked on the same point', () => {
    expect(collectCandidatesAt(stack, 100, 100)).toHaveLength(3)
  })

  it('puts pawns ahead of the landmark they sit on', () => {
    const result = collectCandidatesAt(stack, 100, 100)
    expect(result.map((c) => c.id)).toEqual(['pawn-a', 'pawn-b', 'lm-1'])
  })

  it('orders equidistant pawns by id so the cycle is stable across renders', () => {
    const reordered = [stack[2], stack[0], stack[1]]
    expect(collectCandidatesAt(reordered, 100, 100).map((c) => c.id)).toEqual(
      collectCandidatesAt(stack, 100, 100).map((c) => c.id),
    )
  })

  it('prefers the nearer of two pawns of the same type', () => {
    const points = [at('pawn', 'far', 120, 100), at('pawn', 'near', 105, 100)]
    expect(collectCandidatesAt(points, 100, 100).map((c) => c.id)).toEqual(['near', 'far'])
  })

  it('includes a candidate exactly on the radius boundary', () => {
    expect(collectCandidatesAt([at('pawn', 'edge', 130, 100)], 100, 100, 30)).toHaveLength(1)
  })

  it('excludes a candidate just past the radius', () => {
    expect(collectCandidatesAt([at('pawn', 'edge', 131, 100)], 100, 100, 30)).toHaveLength(0)
  })

  it('measures distance radially, not per axis', () => {
    // (25, 25) is inside a 30px box but ~35px away, so it must miss.
    expect(collectCandidatesAt([at('pawn', 'corner', 125, 125)], 100, 100, 30)).toHaveLength(0)
  })

  it('treats a zero radius as an exact-position hit', () => {
    expect(collectCandidatesAt(stack, 100, 100, 0)).toHaveLength(3)
    expect(collectCandidatesAt(stack, 101, 100, 0)).toHaveLength(0)
  })

  it('ignores candidates whose position has not been resolved yet', () => {
    const points = [at('pawn', 'ok', 100, 100), at('pawn', 'broken', Number.NaN, 100)]
    expect(collectCandidatesAt(points, 100, 100).map((c) => c.id)).toEqual(['ok'])
  })

  it('returns nothing rather than throwing on a non-finite click', () => {
    expect(collectCandidatesAt(stack, Number.NaN, 100)).toEqual([])
  })

  it('returns nothing for a negative radius', () => {
    expect(collectCandidatesAt(stack, 100, 100, -1)).toEqual([])
  })

  it('does not leak the internal distance field to callers', () => {
    expect(Object.keys(collectCandidatesAt(stack, 100, 100)[0]).sort()).toEqual(['id', 'screenX', 'screenY', 'type'])
  })
})

describe('nextInCycle', () => {
  const candidates = collectCandidatesAt(stack, 100, 100)

  it('selects nothing when the click hit nothing', () => {
    expect(nextInCycle([], null)).toBeNull()
  })

  it('selects the sprite that was actually clicked on a fresh click', () => {
    expect(nextInCycle(candidates, null, { type: 'landmark', id: 'lm-1' })).toEqual({ type: 'landmark', id: 'lm-1' })
  })

  it('falls back to the head of the stack when the hit sprite is unknown', () => {
    expect(nextInCycle(candidates, null)).toEqual({ type: 'pawn', id: 'pawn-a' })
  })

  it('ignores a hit sprite that is not among the candidates', () => {
    expect(nextInCycle(candidates, null, { type: 'pawn', id: 'elsewhere' })).toEqual({ type: 'pawn', id: 'pawn-a' })
  })

  it('advances to the next candidate when the current one is in the stack', () => {
    expect(nextInCycle(candidates, { type: 'pawn', id: 'pawn-a' })).toEqual({ type: 'pawn', id: 'pawn-b' })
  })

  it('reaches the landmark underneath after stepping past the pawns', () => {
    expect(nextInCycle(candidates, { type: 'pawn', id: 'pawn-b' })).toEqual({ type: 'landmark', id: 'lm-1' })
  })

  it('wraps from the last candidate back to the first', () => {
    expect(nextInCycle(candidates, { type: 'landmark', id: 'lm-1' })).toEqual({ type: 'pawn', id: 'pawn-a' })
  })

  it('walks the whole stack and returns to the start', () => {
    let current = nextInCycle(candidates, null)
    const visited = [current]
    for (let i = 0; i < candidates.length; i++) {
      current = nextInCycle(candidates, current)
      visited.push(current)
    }
    expect(visited.map((c) => c?.id)).toEqual(['pawn-a', 'pawn-b', 'lm-1', 'pawn-a'])
  })

  it('does not confuse a pawn and a landmark that share an id', () => {
    const shared = collectCandidatesAt([at('pawn', 'same', 100, 100), at('landmark', 'same', 100, 100)], 100, 100)
    expect(nextInCycle(shared, { type: 'pawn', id: 'same' })).toEqual({ type: 'landmark', id: 'same' })
  })

  it('re-selects the only candidate when clicking a lone item repeatedly', () => {
    const lone = collectCandidatesAt([at('pawn', 'solo', 100, 100)], 100, 100)
    expect(nextInCycle(lone, { type: 'pawn', id: 'solo' })).toEqual({ type: 'pawn', id: 'solo' })
  })
})
