/**
 * Failure reporting for the map canvas.
 *
 * Every failure path here used to end in a silent return or an unhandled
 * promise rejection, which the user experienced as an empty black rectangle
 * with no explanation. These helpers turn each one into something specific
 * enough to act on.
 */

export interface MapError {
  title: string
  detail: string
}

let maxTextureSize: number | null = null

const isUsableLimit = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

/**
 * Reads the texture limit out of a renderer that is already running.
 *
 * Deliberately *not* probed from a throwaway canvas. A probe has to hand its
 * context back with `WEBGL_lose_context.loseContext()`, and Firefox logs that
 * as "WebGL context was lost." -- character for character what a real GPU
 * context loss prints. A diagnostic that forges the signature of the failure
 * it exists to diagnose is worse than no diagnostic. A probe also occupies one
 * of the browser's per-page WebGL contexts, which on mobile can be as few as
 * eight, so it competes for the exact resource the map needs.
 *
 * Duck-typed rather than typed against PIXI.WebGLRenderer so that a plain
 * object can stand in for a GPU in tests.
 */
export function readMaxTextureSize(renderer: unknown): number | null {
  if (!renderer || typeof renderer !== 'object') return null

  const gl = (renderer as { gl?: WebGLRenderingContext }).gl
  if (gl && typeof gl.getParameter === 'function') {
    try {
      const value = gl.getParameter(gl.MAX_TEXTURE_SIZE)
      if (isUsableLimit(value)) return value
    } catch {
      // A lost context throws here; fall through to the WebGPU path and null.
    }
  }

  // WebGPU spells the same limit differently. Pixi prefers WebGL by default,
  // but the preference is a hint and the fallback is real.
  const gpuLimit = (renderer as { gpu?: { device?: { limits?: { maxTextureDimension2D?: number } } } }).gpu?.device
    ?.limits?.maxTextureDimension2D
  return isUsableLimit(gpuLimit) ? gpuLimit : null
}

/**
 * The largest texture edge this GPU accepts, or null if nothing has reported
 * one yet. Commonly 4096 on older mobile hardware and 8192-16384 on desktop,
 * so a map that renders fine on a laptop can be undrawable on a phone.
 */
export function getMaxTextureSize(): number | null {
  return maxTextureSize
}

/** Records the limit once a renderer exists. Null forgets it again. */
export function setMaxTextureSize(value: number | null): void {
  maxTextureSize = isUsableLimit(value) ? value : null
}

/** Uncompressed RGBA is what actually lands on the GPU, whatever the file size. */
export function estimateTextureBytes(width: number, height: number): number {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 0
  return width * height * 4
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}

/**
 * Whether a map image can actually be uploaded as a texture.
 *
 * Exceeding MAX_TEXTURE_SIZE does not throw -- the upload is dropped and the
 * sprite draws as an untextured black quad, which is indistinguishable from a
 * dead renderer. Checking up front is the only way to say what went wrong.
 */
export function checkTextureFit(width: number, height: number, maxTextureSize: number | null): MapError | null {
  // Unknown limit: don't invent a failure, let the renderer try.
  if (maxTextureSize === null || !Number.isFinite(maxTextureSize) || maxTextureSize <= 0) return null
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null
  if (width <= maxTextureSize && height <= maxTextureSize) return null

  return {
    title: 'This map is too large for this device',
    detail: [
      `The image is ${Math.round(width)}x${Math.round(height)} pixels,`,
      `but this device can only handle textures up to ${maxTextureSize}x${maxTextureSize}.`,
      `Uncompressed it would need about ${formatBytes(estimateTextureBytes(width, height))} of GPU memory.`,
      'Re-upload the map at a smaller size to view it here.',
    ].join(' '),
  }
}

/** Turns whatever a rejected promise carried into something readable. */
export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Unknown error'
}
