import { afterEach, describe, expect, it } from 'vitest'
import {
  checkTextureFit,
  describeError,
  estimateTextureBytes,
  formatBytes,
  getMaxTextureSize,
  readMaxTextureSize,
  setMaxTextureSize,
} from './mapDiagnostics'

/** Minimal stand-in for the parts of a WebGL context the reader touches. */
const fakeGlRenderer = (value: unknown) => ({
  gl: {
    MAX_TEXTURE_SIZE: 0x0d33,
    getParameter: (name: number) => (name === 0x0d33 ? value : undefined),
  },
})

describe('readMaxTextureSize', () => {
  it('reads the limit off a live WebGL renderer', () => {
    expect(readMaxTextureSize(fakeGlRenderer(8192))).toBe(8192)
  })

  it('falls back to the WebGPU spelling of the same limit', () => {
    expect(readMaxTextureSize({ gpu: { device: { limits: { maxTextureDimension2D: 16384 } } } })).toBe(16384)
  })

  it('survives a renderer whose context is already gone', () => {
    // A lost context throws from getParameter rather than returning null.
    const dead = {
      gl: {
        MAX_TEXTURE_SIZE: 0x0d33,
        getParameter: () => {
          throw new Error('context lost')
        },
      },
    }
    expect(readMaxTextureSize(dead)).toBeNull()
  })

  it('returns null rather than a nonsense limit', () => {
    expect(readMaxTextureSize(null)).toBeNull()
    expect(readMaxTextureSize({})).toBeNull()
    expect(readMaxTextureSize(fakeGlRenderer(0))).toBeNull()
    expect(readMaxTextureSize(fakeGlRenderer(Number.NaN))).toBeNull()
    expect(readMaxTextureSize(fakeGlRenderer('4096'))).toBeNull()
  })
})

describe('setMaxTextureSize', () => {
  afterEach(() => setMaxTextureSize(null))

  it('starts unknown, so nothing is blocked before a renderer exists', () => {
    expect(getMaxTextureSize()).toBeNull()
  })

  it('round-trips a real limit and forgets it again on teardown', () => {
    setMaxTextureSize(4096)
    expect(getMaxTextureSize()).toBe(4096)
    setMaxTextureSize(null)
    expect(getMaxTextureSize()).toBeNull()
  })

  it('refuses a nonsense limit instead of storing it', () => {
    setMaxTextureSize(0)
    expect(getMaxTextureSize()).toBeNull()
    setMaxTextureSize(Number.NaN)
    expect(getMaxTextureSize()).toBeNull()
  })
})

describe('checkTextureFit', () => {
  it('passes an image within the limit', () => {
    expect(checkTextureFit(2000, 1500, 4096)).toBeNull()
    expect(checkTextureFit(4096, 4096, 4096)).toBeNull()
  })

  it('fails an image over the limit on either axis', () => {
    expect(checkTextureFit(4097, 100, 4096)).not.toBeNull()
    expect(checkTextureFit(100, 4097, 4096)).not.toBeNull()
  })

  it('names the actual size and the actual limit', () => {
    const error = checkTextureFit(12000, 9000, 4096)
    expect(error?.detail).toContain('12000x9000')
    expect(error?.detail).toContain('4096x4096')
  })

  it('reports the GPU cost, which is unrelated to the compressed file size', () => {
    // 12000*9000*4 bytes = 412 MB, regardless of how small the PNG is.
    expect(checkTextureFit(12000, 9000, 4096)?.detail).toContain('412 MB')
  })

  it('stays silent when the limit is unknown rather than inventing a failure', () => {
    // A null limit means WebGL never reported one; blocking here would break
    // devices we simply could not probe.
    expect(checkTextureFit(99999, 99999, null)).toBeNull()
    expect(checkTextureFit(99999, 99999, 0)).toBeNull()
    expect(checkTextureFit(99999, 99999, Number.NaN)).toBeNull()
  })

  it('stays silent on degenerate image dimensions', () => {
    expect(checkTextureFit(0, 0, 4096)).toBeNull()
    expect(checkTextureFit(Number.NaN, 100, 4096)).toBeNull()
  })
})

describe('estimateTextureBytes', () => {
  it('assumes 4 bytes per pixel', () => {
    expect(estimateTextureBytes(100, 100)).toBe(40000)
  })

  it('returns zero for degenerate sizes instead of NaN', () => {
    expect(estimateTextureBytes(0, 100)).toBe(0)
    expect(estimateTextureBytes(-5, 100)).toBe(0)
    expect(estimateTextureBytes(Number.NaN, 100)).toBe(0)
  })
})

describe('formatBytes', () => {
  it('scales through the units', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
    expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe('2.0 GB')
  })

  it('drops the decimal once the number is large enough to not need it', () => {
    expect(formatBytes(20 * 1024 * 1024)).toBe('20 MB')
  })

  it('handles zero and nonsense', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(-1)).toBe('0 B')
    expect(formatBytes(Number.NaN)).toBe('0 B')
  })
})

describe('describeError', () => {
  it('unwraps the common shapes', () => {
    expect(describeError(new Error('boom'))).toBe('boom')
    expect(describeError('boom')).toBe('boom')
    expect(describeError({ weird: true })).toBe('Unknown error')
    expect(describeError(undefined)).toBe('Unknown error')
  })
})
