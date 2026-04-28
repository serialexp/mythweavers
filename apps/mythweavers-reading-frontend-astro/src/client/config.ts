/**
 * Unified Backend API Client Configuration
 *
 * Wraps the auto-generated SDK with our base-URL + credentials policy.
 * IMPORTANT: client must be configured BEFORE importing SDK functions.
 */

// Import client first
import { client } from '../api-client/client.gen.js'

/**
 * Resolve the backend origin used by all SDK calls.
 *
 *  - Server (SSR): `API_URL` env var, defaulting to localhost:3201.
 *  - Browser, localhost: also localhost:3201.
 *  - Browser, production: `PUBLIC_API_URL` build-time env, falling back to
 *    `https://api.mythweavers.io`.
 */
export const getApiBaseUrl = (): string => {
  if (typeof window === 'undefined') {
    // Dynamic access keeps Vite from inlining at build time.
    const env = globalThis.process?.env
    return env?.API_URL || 'http://localhost:3201'
  }
  if (window.location.host.includes('localhost')) {
    return 'http://localhost:3201'
  }
  return import.meta.env.PUBLIC_API_URL || 'https://api.mythweavers.io'
}

// Configure BEFORE re-exporting SDK functions.
client.setConfig({
  baseUrl: getApiBaseUrl(),
  credentials: 'include',
})

// Re-export SDK + types so callers have a single import surface.
export * from '../api-client/sdk.gen.js'
export * from '../api-client/types.gen.js'
