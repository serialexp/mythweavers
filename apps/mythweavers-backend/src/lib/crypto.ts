/**
 * Symmetric encryption helpers for secrets-at-rest (AES-256-GCM).
 *
 * Used to encrypt Royal Road passwords before writing them to the DB. The
 * key is loaded once from ROYAL_ROAD_ENC_KEY; it must be a 32-byte base64
 * string (i.e. 44 characters). Generate with:
 *
 *   openssl rand -base64 32
 *
 * Ciphertext format (base64 encoded): iv (12 bytes) || authTag (16 bytes) || ciphertext.
 * We keep the layout stable so values can be re-read across server restarts.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96 bits — GCM-recommended
const AUTH_TAG_LENGTH = 16
const KEY_LENGTH = 32

let cachedKey: Buffer | null = null

/**
 * Resolve the encryption key. Throws if the env var is missing or malformed.
 * Cached after first read so repeated calls are cheap.
 */
function getKey(): Buffer {
  if (cachedKey) return cachedKey
  const raw = process.env.ROYAL_ROAD_ENC_KEY
  if (!raw) {
    throw new Error(
      'ROYAL_ROAD_ENC_KEY env var is not set. Generate one with `openssl rand -base64 32`.',
    )
  }
  const key = Buffer.from(raw, 'base64')
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `ROYAL_ROAD_ENC_KEY must decode to ${KEY_LENGTH} bytes, got ${key.length}. ` +
        'Generate with `openssl rand -base64 32`.',
    )
  }
  cachedKey = key
  return key
}

/**
 * Encrypt a UTF-8 string. Returns a base64-encoded `iv || authTag || ciphertext`.
 */
export function encryptSecret(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64')
}

/**
 * Decrypt a value produced by `encryptSecret`. Throws on tampered/corrupt input.
 */
export function decryptSecret(encoded: string): string {
  const key = getKey()
  const buf = Buffer.from(encoded, 'base64')
  if (buf.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Encrypted payload is too short to be valid.')
  }
  const iv = buf.subarray(0, IV_LENGTH)
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

/**
 * Returns true when ROYAL_ROAD_ENC_KEY is configured and decodes to the
 * expected length. Routes can gate RR functionality on this without throwing.
 */
export function isSecretEncryptionAvailable(): boolean {
  try {
    getKey()
    return true
  } catch {
    return false
  }
}
