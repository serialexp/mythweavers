/**
 * Client-side encryption utilities for protecting API keys before sending to the backend.
 * Uses Web Crypto API: PBKDF2 for key derivation, AES-GCM for encryption.
 */

// --- Types ---

export interface EncryptedSecrets {
  /** Base64-encoded salt (stable per user, generated once) */
  salt: string
  /** Base64-encoded initialization vector (random per encryption) */
  iv: string
  /** Base64-encoded AES-GCM ciphertext */
  ciphertext: string
}

export interface SecretKeys {
  openrouterApiKey?: string
  anthropicApiKey?: string
  openaiApiKey?: string
  cloudflareApiKey?: string
  /** Maps custom provider ID to its API key */
  customProviderKeys?: Record<string, string>
}

// --- Base64 helpers ---

function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let binary = ''
  for (const b of bytes) {
    binary += String.fromCharCode(b)
  }
  return btoa(binary)
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// --- Crypto operations ---

const PBKDF2_ITERATIONS = 600_000
const SALT_LENGTH = 16
const IV_LENGTH = 12

/** Generate a random 16-byte salt. */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
}

/** Derive an AES-GCM-256 key from a password and salt using PBKDF2. */
export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** Encrypt a plaintext string with AES-GCM. Returns base64 IV and ciphertext. */
export async function encrypt(key: CryptoKey, plaintext: string): Promise<{ iv: string; ciphertext: string }> {
  const encoder = new TextEncoder()
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))

  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext),
  )

  return {
    iv: toBase64(iv),
    ciphertext: toBase64(ciphertextBuf),
  }
}

/**
 * Decrypt an AES-GCM ciphertext. Returns the plaintext string.
 * Throws a DOMException if the key is wrong (authentication tag mismatch).
 */
export async function decrypt(key: CryptoKey, iv: string, ciphertext: string): Promise<string> {
  const decoder = new TextDecoder()

  const plaintextBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(iv) as unknown as BufferSource },
    key,
    fromBase64(ciphertext) as unknown as BufferSource,
  )

  return decoder.decode(plaintextBuf)
}

// --- High-level helpers ---

/** Encrypt a SecretKeys object into an EncryptedSecrets blob. */
export async function encryptSecrets(
  key: CryptoKey,
  salt: Uint8Array,
  secrets: SecretKeys,
): Promise<EncryptedSecrets> {
  const plaintext = JSON.stringify(secrets)
  const { iv, ciphertext } = await encrypt(key, plaintext)
  return { salt: toBase64(salt), iv, ciphertext }
}

/**
 * Decrypt an EncryptedSecrets blob back into a SecretKeys object.
 * Throws on wrong password.
 */
export async function decryptSecrets(
  key: CryptoKey,
  encrypted: EncryptedSecrets,
): Promise<SecretKeys> {
  const plaintext = await decrypt(key, encrypted.iv, encrypted.ciphertext)
  return JSON.parse(plaintext) as SecretKeys
}

/** Extract the salt from an EncryptedSecrets blob as a Uint8Array. */
export function extractSalt(encrypted: EncryptedSecrets): Uint8Array {
  return fromBase64(encrypted.salt)
}
