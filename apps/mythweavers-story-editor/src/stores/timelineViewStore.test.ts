import { beforeEach, describe, expect, it } from 'vitest'
import { timelineViewStore } from './timelineViewStore'

describe('timelineViewStore', () => {
  beforeEach(() => {
    timelineViewStore.reset()
  })

  it('round-trips a viewport', () => {
    timelineViewStore.setViewport({ start: 0, end: 100 })
    expect(timelineViewStore.viewport).toEqual({ start: 0, end: 100 })
  })

  it('clears the viewport', () => {
    timelineViewStore.setViewport({ start: 0, end: 100 })
    timelineViewStore.setViewport(null)
    expect(timelineViewStore.viewport).toBeNull()
  })

  it('hands out a snapshot that later writes cannot mutate', () => {
    // Solid merges an object write into the existing store node in place, so a
    // live node handed to a caller would silently track every later write. Pan
    // and pinch both capture the viewport at gesture start and measure deltas
    // against it; if that capture drifts, the gesture compounds and runs away.
    timelineViewStore.setViewport({ start: 0, end: 100 })
    const capturedAtGestureStart = timelineViewStore.viewport

    timelineViewStore.setViewport({ start: 1000, end: 1100 })

    expect(capturedAtGestureStart).toEqual({ start: 0, end: 100 })
  })

  it('returns a distinct object on each read', () => {
    timelineViewStore.setViewport({ start: 0, end: 100 })
    expect(timelineViewStore.viewport).not.toBe(timelineViewStore.viewport)
  })
})
