import { describe, expect, test } from 'bun:test'
import { type HashableMessage, computePrefixHashes, sharedPrefixLength } from '../src/lib/prefix-hash.js'

const msg = (role: string, content: string, breakpoint = false): HashableMessage =>
  breakpoint ? { role, content, cache_control: { type: 'ephemeral' } } : { role, content }

describe('computePrefixHashes', () => {
  test('produces one hash per message', () => {
    const { hashes } = computePrefixHashes([msg('system', 'a'), msg('user', 'b'), msg('assistant', 'c')])
    expect(hashes).toHaveLength(3)
    for (const h of hashes) expect(h).toMatch(/^[0-9a-f]{32}$/)
  })

  test('is deterministic', () => {
    const input = [msg('system', 'sys'), msg('user', 'hi')]
    expect(computePrefixHashes(input)).toEqual(computePrefixHashes(input))
  })

  test('shared leading messages produce identical leading hashes', () => {
    const base = [msg('system', 'world bible'), msg('user', 'turn 1'), msg('assistant', 'reply 1')]
    const a = computePrefixHashes([...base, msg('user', 'turn 2a')])
    const b = computePrefixHashes([...base, msg('user', 'turn 2b')])

    // Everything up to the divergence matches...
    expect(a.hashes.slice(0, 3)).toEqual(b.hashes.slice(0, 3))
    // ...and the divergent tail differs.
    expect(a.hashes[3]).not.toBe(b.hashes[3])
    expect(sharedPrefixLength(a, b)).toBe(3)
  })

  test('a change in an early message invalidates every later hash (cache-miss semantics)', () => {
    const a = computePrefixHashes([msg('system', 'S'), msg('user', 'u1'), msg('assistant', 'a1')])
    const b = computePrefixHashes([msg('system', 'S-EDITED'), msg('user', 'u1'), msg('assistant', 'a1')])
    expect(a.hashes[0]).not.toBe(b.hashes[0])
    expect(a.hashes[1]).not.toBe(b.hashes[1])
    expect(a.hashes[2]).not.toBe(b.hashes[2])
    expect(sharedPrefixLength(a, b)).toBe(0)
  })

  test('role is part of the fingerprint', () => {
    const a = computePrefixHashes([msg('user', 'same content')])
    const b = computePrefixHashes([msg('assistant', 'same content')])
    expect(a.hashes[0]).not.toBe(b.hashes[0])
  })

  test('NUL-separator prevents role/content boundary collisions', () => {
    // ("ab","") vs ("a","b") must not collide.
    const a = computePrefixHashes([msg('ab', '')])
    const b = computePrefixHashes([msg('a', 'b')])
    expect(a.hashes[0]).not.toBe(b.hashes[0])
  })

  test('records breakpoint indices from cache_control', () => {
    const { breakpoints } = computePrefixHashes([
      msg('system', 'sys', true),
      msg('user', 'u1'),
      msg('assistant', 'a1', true),
      msg('user', 'u2'),
    ])
    expect(breakpoints).toEqual([0, 2])
  })

  test('no breakpoints when no cache_control present', () => {
    const { breakpoints } = computePrefixHashes([msg('system', 'sys'), msg('user', 'u1')])
    expect(breakpoints).toEqual([])
  })

  test('empty message list yields empty result', () => {
    expect(computePrefixHashes([])).toEqual({ hashes: [], breakpoints: [] })
  })
})
