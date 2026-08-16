import { beforeEach, describe, expect, it } from 'vitest'
import { clearTextWidthCache, measureTextWidth } from './textWidth'

const FONT = '12px system-ui'

describe('measureTextWidth', () => {
  beforeEach(() => clearTextWidthCache())

  it('measures nothing as zero', () => {
    expect(measureTextWidth('', FONT, 12)).toBe(0)
  })

  it('never returns zero for text that has some', () => {
    // The headless canvas reports 0 for every string. Passing that through would
    // tell the timeline every label is weightless, so every one would be shown
    // and they would all overlap.
    expect(measureTextWidth('Chapter 1 · The Arrival', FONT, 12)).toBeGreaterThan(0)
  })

  it('grows with the length of the text', () => {
    const short = measureTextWidth('Ch 1', FONT, 12)
    const long = measureTextWidth('Chapter 1 · A Considerably Longer Scene Title', FONT, 12)

    expect(long).toBeGreaterThan(short)
  })

  it('grows with the font size', () => {
    const small = measureTextWidth('Arrival', '8px system-ui', 8)
    const large = measureTextWidth('Arrival', '24px system-ui', 24)

    expect(large).toBeGreaterThan(small)
  })

  it('returns a stable value for repeated measurements', () => {
    const first = measureTextWidth('Arrival', FONT, 12)

    expect(measureTextWidth('Arrival', FONT, 12)).toBe(first)
  })
})
