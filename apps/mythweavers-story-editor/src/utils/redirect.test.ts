/**
 * The post-login redirect guard.
 *
 * `/login?redirect=…` is reachable by anyone, and the OAuth consent flow sends
 * users through it, so an unvalidated value here would let an attacker bounce a
 * freshly signed-in user anywhere. The subtle case is "//evil.example": it
 * starts with a slash but browsers read it as a protocol-relative absolute URL.
 */

import { describe, expect, test } from 'vitest'
import { safeRedirectTarget } from './redirect'

describe('safeRedirectTarget', () => {
  test('keeps same-origin paths, including the OAuth consent destination', () => {
    expect(safeRedirectTarget('/oauth/consent?request_id=abc')).toBe('/oauth/consent?request_id=abc')
    expect(safeRedirectTarget('/device?code=ABCD')).toBe('/device?code=ABCD')
    expect(safeRedirectTarget('/story/123')).toBe('/story/123')
  })

  test('rejects protocol-relative URLs', () => {
    expect(safeRedirectTarget('//evil.example')).toBe('/stories')
    expect(safeRedirectTarget('//evil.example/path')).toBe('/stories')
  })

  test('rejects absolute URLs and non-path values', () => {
    expect(safeRedirectTarget('https://evil.example')).toBe('/stories')
    expect(safeRedirectTarget('javascript:alert(1)')).toBe('/stories')
    expect(safeRedirectTarget('stories')).toBe('/stories')
    expect(safeRedirectTarget('')).toBe('/stories')
  })

  test('falls back when the parameter is absent or repeated', () => {
    expect(safeRedirectTarget(undefined)).toBe('/stories')
    // Solid's useSearchParams hands back an array when a key repeats.
    expect(safeRedirectTarget(['/usage', '/other'])).toBe('/usage')
    expect(safeRedirectTarget(['//evil.example'])).toBe('/stories')
  })
})
