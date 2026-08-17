import { describe, expect, it } from 'vitest'
import { Node } from '../types/core'
import {
  Viewport,
  assignStackLanes,
  buildUnitLadder,
  exceedsDragThreshold,
  fractionToTime,
  generateTicks,
  hasStoryTime,
  panViewport,
  pickLabelledItems,
  pickSnapStep,
  pixelDeltaToMinutes,
  rectFromPoints,
  rectsIntersect,
  resolveSceneTimes,
  sceneTimeExtent,
  snapTime,
  timeToFraction,
  zoomViewport,
} from './timelineLayout'

const HOUR = 60
const DAY = 1440

function scene(id: string, storyTime?: number | null): Node {
  return {
    id,
    storyId: 'story-1',
    type: 'scene',
    title: id,
    order: 0,
    storyTime: storyTime ?? undefined,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  } as Node
}

const VIEWPORT: Viewport = { start: 0, end: 1000 }

describe('viewport math', () => {
  it('maps time to fraction and back', () => {
    expect(timeToFraction(250, VIEWPORT)).toBe(0.25)
    expect(fractionToTime(0.25, VIEWPORT)).toBe(250)
  })

  it('does not divide by zero on a collapsed viewport', () => {
    expect(timeToFraction(5, { start: 10, end: 10 })).toBe(0)
    expect(pixelDeltaToMinutes(100, VIEWPORT, 0)).toBe(0)
  })

  it('returns positions outside 0..1 for off-screen times', () => {
    expect(timeToFraction(-500, VIEWPORT)).toBe(-0.5)
    expect(timeToFraction(2000, VIEWPORT)).toBe(2)
  })

  it('converts a pixel drag into minutes at the current zoom', () => {
    // 1000 minutes across 500px => 2 minutes per pixel.
    expect(pixelDeltaToMinutes(10, VIEWPORT, 500)).toBe(20)
  })

  it('pans without changing span', () => {
    const panned = panViewport(VIEWPORT, 100)
    expect(panned).toEqual({ start: 100, end: 1100 })
  })

  it('keeps the anchored time under the cursor when zooming', () => {
    const anchor = 0.25
    const anchorTime = fractionToTime(anchor, VIEWPORT)
    const zoomed = zoomViewport(VIEWPORT, 0.5, anchor)
    expect(fractionToTime(anchor, zoomed)).toBeCloseTo(anchorTime, 6)
    expect(zoomed.end - zoomed.start).toBeCloseTo(500, 6)
  })

  it('clamps zoom so the viewport never collapses or explodes', () => {
    const tiny = zoomViewport({ start: 0, end: 60 }, 0.0001, 0.5)
    expect(tiny.end - tiny.start).toBeGreaterThanOrEqual(60)

    const huge = zoomViewport({ start: 0, end: 60 }, 1e12, 0.5)
    expect(Number.isFinite(huge.end - huge.start)).toBe(true)
  })
})

describe('snap ladder', () => {
  const ladder = buildUnitLadder(60, 1440, 365)

  it('derives units from the calendar config rather than hardcoding them', () => {
    // A calendar with 100-minute hours and 10-hour days.
    const odd = buildUnitLadder(100, 1000, 400)
    expect(odd).toContain(100)
    expect(odd).toContain(1000)
    expect(odd).toContain(1000 * 400)
  })

  it('falls back to sane units when the config is degenerate', () => {
    const ladder = buildUnitLadder(0, 0, 0)
    expect(ladder).toContain(60)
    expect(ladder).toContain(1440)
  })

  it('picks a finer step when zoomed in', () => {
    // One day across 1000px -- an hour is ~41px wide, comfortably clickable.
    const step = pickSnapStep({ start: 0, end: DAY }, 1000, ladder)
    expect(step).toBe(HOUR)
  })

  it('picks a coarser step when zoomed out', () => {
    // Ten years across 1000px -- hours are far below a pixel.
    const step = pickSnapStep({ start: 0, end: DAY * 3650 }, 1000, ladder)
    expect(step).toBeGreaterThanOrEqual(DAY)
  })

  it('never returns a step finer than a pixel of hand tremor', () => {
    const width = 1000
    for (const span of [DAY, DAY * 30, DAY * 365, DAY * 3650]) {
      const step = pickSnapStep({ start: 0, end: span }, width, ladder)
      const stepPx = (step / span) * width
      expect(stepPx).toBeGreaterThanOrEqual(6)
    }
  })

  it('always rounds to an integer, because the API rejects floats', () => {
    // Both scene PATCH and nodes/bulk-update validate storyTime as z.number().int().
    expect(Number.isInteger(snapTime(1234.567, HOUR))).toBe(true)
    expect(Number.isInteger(snapTime(1234.567, 0))).toBe(true)
    expect(Number.isInteger(snapTime(-1234.567, HOUR))).toBe(true)
  })

  it('snaps to the nearest multiple of the step', () => {
    expect(snapTime(1490, HOUR)).toBe(1500)
    expect(snapTime(1510, DAY)).toBe(1440)
  })

  it('survives non-finite input', () => {
    expect(snapTime(Number.NaN, HOUR)).toBe(0)
    expect(snapTime(Number.POSITIVE_INFINITY, HOUR)).toBe(0)
  })

  it('handles negative story times (before the epoch)', () => {
    expect(snapTime(-1490, HOUR)).toBe(-1500)
  })
})

describe('generateTicks', () => {
  it('covers the viewport at the given step', () => {
    const ticks = generateTicks({ start: 0, end: 300 }, 100)
    expect(ticks).toEqual([0, 100, 200, 300])
  })

  it('aligns ticks to multiples of the step, not the viewport start', () => {
    const ticks = generateTicks({ start: 150, end: 450 }, 100)
    expect(ticks).toEqual([200, 300, 400])
  })

  it('bails out rather than generating unbounded ticks', () => {
    expect(generateTicks({ start: 0, end: 1e9 }, 1)).toEqual([])
    expect(generateTicks({ start: 0, end: 100 }, 0)).toEqual([])
  })
})

describe('hasStoryTime', () => {
  it('treats 0 as a real time, not as unset', () => {
    // Epoch 0 is exactly where the default timeline range is centred, and
    // several older call sites in the app get this wrong with `if (storyTime)`.
    expect(hasStoryTime({ storyTime: 0 })).toBe(true)
    expect(hasStoryTime({ storyTime: undefined })).toBe(false)
    expect(hasStoryTime({ storyTime: null as unknown as undefined })).toBe(false)
  })
})

describe('resolveSceneTimes', () => {
  it('marks every scene unknown when nothing is timed', () => {
    const scenes = [scene('a'), scene('b'), scene('c')]
    const resolved = resolveSceneTimes(scenes, DAY)
    expect([...resolved.values()].every((r) => r.confidence === 'unknown')).toBe(true)
  })

  it('keeps real times exact', () => {
    const scenes = [scene('a', 0), scene('b', DAY)]
    const resolved = resolveSceneTimes(scenes, DAY)
    expect(resolved.get('a')).toEqual({ time: 0, confidence: 'exact' })
    expect(resolved.get('b')).toEqual({ time: DAY, confidence: 'exact' })
  })

  it('distributes untimed scenes evenly between two anchors', () => {
    const scenes = [scene('a', 0), scene('gap1'), scene('gap2'), scene('b', 300)]
    const resolved = resolveSceneTimes(scenes, DAY)
    expect(resolved.get('gap1')).toEqual({ time: 100, confidence: 'interpolated' })
    expect(resolved.get('gap2')).toEqual({ time: 200, confidence: 'interpolated' })
  })

  it('extrapolates backwards before the first anchor', () => {
    const scenes = [scene('head2'), scene('head1'), scene('a', 1000)]
    const resolved = resolveSceneTimes(scenes, 100)
    expect(resolved.get('head1')).toEqual({ time: 900, confidence: 'extrapolated' })
    expect(resolved.get('head2')).toEqual({ time: 800, confidence: 'extrapolated' })
  })

  it('extrapolates forwards after the last anchor', () => {
    const scenes = [scene('a', 1000), scene('tail1'), scene('tail2')]
    const resolved = resolveSceneTimes(scenes, 100)
    expect(resolved.get('tail1')).toEqual({ time: 1100, confidence: 'extrapolated' })
    expect(resolved.get('tail2')).toEqual({ time: 1200, confidence: 'extrapolated' })
  })

  it('handles a single anchor in both directions', () => {
    const scenes = [scene('before'), scene('only', 500), scene('after')]
    const resolved = resolveSceneTimes(scenes, 100)
    expect(resolved.get('before')?.time).toBe(400)
    expect(resolved.get('only')?.confidence).toBe('exact')
    expect(resolved.get('after')?.time).toBe(600)
  })

  it('does not interpolate across a flashback', () => {
    // Narrative order says a -> gap -> b, but b happens before a.
    const scenes = [scene('a', 5000), scene('gap'), scene('b', 1000)]
    const resolved = resolveSceneTimes(scenes, DAY)
    expect(resolved.get('gap')?.confidence).toBe('unknown')
    expect(resolved.get('a')?.confidence).toBe('exact')
    expect(resolved.get('b')?.confidence).toBe('exact')
  })

  it('does not divide by zero when both anchors share a time', () => {
    const scenes = [scene('a', 500), scene('gap1'), scene('gap2'), scene('b', 500)]
    const resolved = resolveSceneTimes(scenes, DAY)
    for (const id of ['gap1', 'gap2']) {
      const r = resolved.get(id)
      expect(r?.confidence).toBe('interpolated')
      expect(Number.isFinite(r?.time)).toBe(true)
      expect(r?.time).toBe(500)
    }
  })

  it('produces a finite time for every scene it places', () => {
    const scenes = [scene('a'), scene('b', 0), scene('c'), scene('d', 100), scene('e')]
    const resolved = resolveSceneTimes(scenes, 10)
    for (const s of scenes) {
      expect(Number.isFinite(resolved.get(s.id)?.time)).toBe(true)
    }
  })

  it('handles an empty scene list', () => {
    expect(resolveSceneTimes([], DAY).size).toBe(0)
  })

  it('copes with a zero fallback step', () => {
    const scenes = [scene('head'), scene('a', 100)]
    const resolved = resolveSceneTimes(scenes, 0)
    expect(Number.isFinite(resolved.get('head')?.time)).toBe(true)
  })
})

describe('sceneTimeExtent', () => {
  it('returns null when nothing is timed', () => {
    expect(sceneTimeExtent([scene('a'), scene('b')], DAY)).toBeNull()
  })

  it('brackets a single timed scene', () => {
    const extent = sceneTimeExtent([scene('a', 1000)], 100)
    expect(extent).not.toBeNull()
    expect(extent!.start).toBeLessThan(1000)
    expect(extent!.end).toBeGreaterThan(1000)
  })

  it('adds a margin around the timed scenes', () => {
    const extent = sceneTimeExtent([scene('a', 0), scene('b', 1000)], DAY)!
    expect(extent.start).toBeLessThan(0)
    expect(extent.end).toBeGreaterThan(1000)
  })

  it('ignores untimed scenes and handles a scene at time 0', () => {
    const extent = sceneTimeExtent([scene('a', 0), scene('untimed'), scene('b', 500)], DAY)!
    expect(extent.start).toBeLessThan(0)
    expect(extent.end).toBeGreaterThan(500)
  })
})

describe('marquee helpers', () => {
  it('normalises a rect dragged in any direction', () => {
    expect(rectFromPoints(100, 100, 10, 10)).toEqual({ left: 10, top: 10, right: 100, bottom: 100 })
  })

  it('detects intersection including edge contact', () => {
    const a = { left: 0, top: 0, right: 10, bottom: 10 }
    expect(rectsIntersect(a, { left: 5, top: 5, right: 15, bottom: 15 })).toBe(true)
    expect(rectsIntersect(a, { left: 10, top: 10, right: 20, bottom: 20 })).toBe(true)
    expect(rectsIntersect(a, { left: 11, top: 11, right: 20, bottom: 20 })).toBe(false)
  })

  it('treats a tiny movement as a click rather than a drag', () => {
    expect(exceedsDragThreshold(1, 1)).toBe(false)
    expect(exceedsDragThreshold(5, 0)).toBe(true)
    expect(exceedsDragThreshold(0, -5)).toBe(true)
  })
})

describe('assignStackLanes', () => {
  const viewport: Viewport = { start: 0, end: 1000 }

  it('stacks same-time chips in stable input order', () => {
    const layout = assignStackLanes(
      [
        { id: 'first', time: 500, widthPx: 100 },
        { id: 'second', time: 500, widthPx: 100 },
        { id: 'third', time: 500, widthPx: 100 },
      ],
      viewport,
      1000,
    )

    expect(layout.rowCount).toBe(3)
    expect([...layout.rows.entries()]).toEqual([
      ['first', 0],
      ['second', 1],
      ['third', 2],
    ])
    expect([...layout.stackedIds]).toEqual(['second', 'first', 'third'])
  })

  it('reuses a row when chips meet but do not overlap', () => {
    const layout = assignStackLanes(
      [
        { id: 'first', time: 100, widthPx: 100 },
        { id: 'second', time: 200, widthPx: 100 },
        { id: 'overlap', time: 250, widthPx: 100 },
      ],
      viewport,
      1000,
    )

    expect(layout.rowCount).toBe(2)
    expect(layout.rows.get('first')).toBe(0)
    expect(layout.rows.get('second')).toBe(0)
    expect(layout.rows.get('overlap')).toBe(1)
  })
})

describe('pickLabelledItems', () => {
  // 1000px wide, 1000 minutes across: one minute is one pixel, so widths and
  // times can be read as the same units.
  const track: Viewport = { start: 0, end: 1000 }
  const WIDTH = 1000

  it('hides a label that its neighbour would overrun', () => {
    const chosen = pickLabelledItems(
      [
        { id: 'wide', time: 0, widthPx: 200 },
        { id: 'shadowed', time: 100, widthPx: 40 },
      ],
      track,
      WIDTH,
      0,
    )

    expect(chosen.has('wide')).toBe(true)
    expect(chosen.has('shadowed')).toBe(false)
  })

  it('keeps a label that starts exactly where the previous one ends', () => {
    const chosen = pickLabelledItems(
      [
        { id: 'first', time: 0, widthPx: 100 },
        { id: 'second', time: 100, widthPx: 100 },
      ],
      track,
      WIDTH,
      0,
    )

    expect(chosen.size).toBe(2)
  })

  it('respects the requested gap', () => {
    // Same positions as above, but now 12px of clear space is demanded after
    // each label, which the second one no longer has.
    const chosen = pickLabelledItems(
      [
        { id: 'first', time: 0, widthPx: 100 },
        { id: 'second', time: 100, widthPx: 100 },
      ],
      track,
      WIDTH,
      12,
    )

    expect(chosen.has('first')).toBe(true)
    expect(chosen.has('second')).toBe(false)
  })

  it('gives a narrow label room a fixed spacing would have denied', () => {
    // Three short labels 40px apart: the old fixed 96px gap would have dropped
    // two of them even though they never touch.
    const chosen = pickLabelledItems(
      [
        { id: 'a', time: 0, widthPx: 30 },
        { id: 'b', time: 40, widthPx: 30 },
        { id: 'c', time: 80, widthPx: 30 },
      ],
      track,
      WIDTH,
      0,
    )

    expect(chosen.size).toBe(3)
  })

  it('resumes labelling once past a wide label', () => {
    const chosen = pickLabelledItems(
      [
        { id: 'wide', time: 0, widthPx: 200 },
        { id: 'shadowed', time: 100, widthPx: 40 },
        { id: 'clear', time: 300, widthPx: 40 },
      ],
      track,
      WIDTH,
      0,
    )

    expect([...chosen].sort()).toEqual(['clear', 'wide'])
  })

  it('considers items in time order regardless of input order', () => {
    const chosen = pickLabelledItems(
      [
        { id: 'later', time: 500, widthPx: 40 },
        { id: 'earlier', time: 0, widthPx: 40 },
      ],
      track,
      WIDTH,
      0,
    )

    expect(chosen.size).toBe(2)
  })

  it('labels nothing when the track has no width or no span', () => {
    const items = [{ id: 'a', time: 0, widthPx: 40 }]
    expect(pickLabelledItems(items, track, 0, 0).size).toBe(0)
    expect(pickLabelledItems(items, { start: 5, end: 5 }, WIDTH, 0).size).toBe(0)
  })

  it('labels an item sitting left of the viewport without swallowing the track', () => {
    // Off-screen chips are still candidates; a large negative x must not leave
    // lastLabelEnd far enough left to grant every later label unconditionally.
    const chosen = pickLabelledItems(
      [
        { id: 'offscreen', time: -1000, widthPx: 40 },
        { id: 'onscreen', time: 0, widthPx: 40 },
      ],
      track,
      WIDTH,
      0,
    )

    expect(chosen.has('offscreen')).toBe(true)
    expect(chosen.has('onscreen')).toBe(true)
  })
})
