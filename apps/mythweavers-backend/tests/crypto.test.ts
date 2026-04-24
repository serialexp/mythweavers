import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { decryptSecret, encryptSecret, isSecretEncryptionAvailable } from '../src/lib/crypto.js'

/**
 * Unit tests for the AES-256-GCM secret encryption helper used by Royal Road
 * credential storage. Exercises round-trip, output opacity, ciphertext freshness
 * (different IV per call), and tamper detection.
 */

const TEST_ENC_KEY = 'abcdefghijklmnopqrstuvwxyz012345ABCDEFGHIJK='

describe('crypto.ts', () => {
  const originalEncKey = process.env.ROYAL_ROAD_ENC_KEY

  beforeAll(() => {
    process.env.ROYAL_ROAD_ENC_KEY = TEST_ENC_KEY
  })

  afterAll(() => {
    if (originalEncKey === undefined) {
      delete process.env.ROYAL_ROAD_ENC_KEY
    } else {
      process.env.ROYAL_ROAD_ENC_KEY = originalEncKey
    }
  })

  test('round-trips a secret', () => {
    const ciphertext = encryptSecret('hunter2')
    expect(decryptSecret(ciphertext)).toBe('hunter2')
  })

  test('ciphertext does not contain the plaintext', () => {
    const plaintext = 'correct horse battery staple'
    const ciphertext = encryptSecret(plaintext)
    expect(ciphertext).not.toContain(plaintext)
  })

  test('produces a fresh ciphertext each call (unique IV)', () => {
    const a = encryptSecret('same-secret')
    const b = encryptSecret('same-secret')
    expect(a).not.toBe(b)
    expect(decryptSecret(a)).toBe('same-secret')
    expect(decryptSecret(b)).toBe('same-secret')
  })

  test('tampered ciphertext fails to decrypt', () => {
    const ciphertext = encryptSecret('secret')
    // Flip one base64 character in the ciphertext body (past IV+authTag).
    const tampered =
      ciphertext.slice(0, -2) + (ciphertext.slice(-2, -1) === 'A' ? 'B' : 'A') + ciphertext.slice(-1)
    expect(() => decryptSecret(tampered)).toThrow()
  })

  test('isSecretEncryptionAvailable reflects env var state', () => {
    expect(isSecretEncryptionAvailable()).toBe(true)
  })
})
