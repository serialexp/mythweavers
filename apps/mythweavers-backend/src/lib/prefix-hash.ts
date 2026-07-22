/**
 * Prompt-cache prefix fingerprinting.
 *
 * Providers (OpenAI automatic prefix caching, Anthropic `cache_control`
 * breakpoints) cache a *prefix* of the prompt and reuse it when a later request
 * begins with the exact same bytes. To debug why cache hits do or don't happen
 * we need to know, after the fact, which requests shared a prompt prefix — and
 * how much of it — WITHOUT retaining the (potentially large, potentially
 * sensitive) message content.
 *
 * We store a chain of *cumulative* hashes: `hashes[i]` folds in every message
 * from 0..i (role + content). Because each hash includes everything before it,
 * two requests share their first `k` messages **iff** their hash lists agree at
 * indices `0..k-1`. Matching is therefore monotone — agree at `i` ⇒ agree at
 * all `j < i` — so the longest shared prefix between any two requests is just
 * the largest index at which their hash lists still match. A single changed
 * byte in message `m` changes `hashes[m]` and every hash after it, exactly like
 * a real cache miss from that point on.
 *
 * Analysis afterwards:
 *   - OpenAI-style (automatic, whole prefix): compare the full `hashes` lists.
 *   - Anthropic-style (explicit breakpoints): compare `hashes` only at the
 *     indices listed in `breakpoints`.
 */

import { createHash } from 'node:crypto'

/** Number of hex chars kept from each SHA-256 digest (16 bytes = 128 bits). */
const HASH_HEX_LEN = 32

export interface PrefixHashes {
  /**
   * Cumulative hash after each message, in order. `hashes[i]` covers the
   * role+content of messages `0..i`. Hex, {@link HASH_HEX_LEN} chars each.
   */
  hashes: string[]
  /**
   * Indices (into `hashes`) of messages that carried a `cache_control`
   * breakpoint — the boundaries an Anthropic-style provider actually caches at.
   */
  breakpoints: number[]
}

/** Minimal shape we need off each message; matches the generate-body schema. */
export interface HashableMessage {
  role: string
  content: string
  cache_control?: unknown
}

/**
 * Compute the cumulative prefix-hash chain and breakpoint list for a request's
 * messages. Pure and deterministic — same input always yields the same output.
 *
 * The hash folds `role` and `content` only; `cache_control` is a breakpoint
 * marker, not part of the bytes a provider caches, so it is tracked separately
 * in {@link PrefixHashes.breakpoints} rather than mixed into the hash.
 */
export function computePrefixHashes(messages: readonly HashableMessage[]): PrefixHashes {
  const hashes: string[] = []
  const breakpoints: number[] = []

  // Chain seed. Each step: hash(prev || role || content). NUL separators keep
  // ("ab","c") distinct from ("a","bc").
  let prev = ''
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]
    const digest = createHash('sha256')
      .update(prev)
      .update('\x00')
      .update(m.role)
      .update('\x00')
      .update(m.content)
      .digest('hex')
      .slice(0, HASH_HEX_LEN)

    hashes.push(digest)
    prev = digest

    if (m.cache_control) breakpoints.push(i)
  }

  return { hashes, breakpoints }
}

/**
 * Length of the shared leading prefix (in messages) between two hash chains —
 * the largest `k` such that `a.hashes[0..k-1]` equals `b.hashes[0..k-1]`.
 * Handy for offline analysis of stored fingerprints.
 */
export function sharedPrefixLength(a: PrefixHashes, b: PrefixHashes): number {
  const n = Math.min(a.hashes.length, b.hashes.length)
  let k = 0
  while (k < n && a.hashes[k] === b.hashes[k]) k++
  return k
}
