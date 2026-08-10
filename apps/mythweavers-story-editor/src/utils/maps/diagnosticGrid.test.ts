import { describe, expect, it } from 'vitest'
import { gridExtent, niceStep } from './diagnosticGrid'

describe('niceStep', () => {
  it('rounds to 1/2/5 x a power of ten', () => {
    expect(niceStep(2000, 20)).toBe(100)
    expect(niceStep(1000, 20)).toBe(50)
    expect(niceStep(400, 20)).toBe(20)
    expect(niceStep(200, 20)).toBe(10)
  })

  it('lands on a round number for awkward spans', () => {
    // 4321/20 = 216.05, which should round up to 500 rather than stay at 216.
    expect(niceStep(4321, 20)).toBe(500)
    expect(niceStep(137, 20)).toBe(10)
  })

  it('keeps the cell count near the target', () => {
    for (const span of [137, 512, 2000, 4321, 9999, 65536]) {
      const cells = span / niceStep(span, 20)
      expect(cells).toBeGreaterThan(1)
      expect(cells).toBeLessThan(40)
    }
  })

  it('survives degenerate input rather than emitting an infinite loop step', () => {
    // A zero or negative step would make the drawing loop never terminate.
    expect(niceStep(0)).toBe(1)
    expect(niceStep(-100)).toBe(1)
    expect(niceStep(Number.NaN)).toBe(1)
    expect(niceStep(Number.POSITIVE_INFINITY)).toBe(1)
    expect(niceStep(2000, 0)).toBe(1)
  })

  it('is always positive', () => {
    for (const span of [1, 0.5, 1e-6, 1e9]) {
      expect(niceStep(span)).toBeGreaterThan(0)
    }
  })
})

describe('gridExtent', () => {
  it('overdraws past the world so panning off the map still shows lines', () => {
    const extent = gridExtent(1000, 800)
    expect(extent.minX).toBeLessThan(0)
    expect(extent.maxX).toBeGreaterThan(1000)
    expect(extent.minY).toBeLessThan(0)
    expect(extent.maxY).toBeGreaterThan(800)
  })

  it('falls back to a usable extent when the world has no size yet', () => {
    // The viewport is 0x0 until a texture loads; the grid still has to draw,
    // because that is exactly the failure this is meant to make visible.
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const extent = gridExtent(bad, bad)
      expect(extent.maxX).toBeGreaterThan(extent.minX)
      expect(extent.maxY).toBeGreaterThan(extent.minY)
      expect(extent.step).toBeGreaterThan(0)
    }
  })

  it('produces a bounded number of lines at any world size', () => {
    for (const size of [100, 2000, 8192, 100000]) {
      const { minX, maxX, step } = gridExtent(size, size)
      expect((maxX - minX) / step).toBeLessThan(100)
    }
  })
})
