/**
 * Unified Backend API Client Configuration
 *
 * This file wraps the auto-generated API client with configuration.
 * IMPORTANT: Must import and configure client BEFORE importing SDK functions.
 */

// Import client first
import { client } from '../api-client/client.gen.js'

export class ApiRequestError extends Error {
  readonly status?: number
  readonly response?: { status: number }
  readonly details: unknown

  constructor(message: string, status: number | undefined, details: unknown) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.response = status === undefined ? undefined : { status }
    this.details = details
  }
}

const errorMessage = (error: unknown, status?: number): string => {
  if (error instanceof Error) return error.message
  if (typeof error === 'string' && error) return error
  if (error && typeof error === 'object' && 'error' in error && typeof error.error === 'string') return error.error
  return status ? `Request failed with status ${status}` : 'Unable to reach the server'
}

// Configure the client base URL IMMEDIATELY
export const getApiBaseUrl = (): string => {
  // Check for runtime config (Docker deployments)
  if (typeof window !== 'undefined' && (window as any).RUNTIME_CONFIG?.BACKEND_URL) {
    return (window as any).RUNTIME_CONFIG.BACKEND_URL
  }

  // Check for build-time environment variable
  if (import.meta.env.VITE_UNIFIED_API_URL) {
    return import.meta.env.VITE_UNIFIED_API_URL
  }

  // Default: infer API URL from current hostname
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    const protocol = window.location.protocol
    // Reverse-proxy convention: write.example.com → api.example.com
    if (hostname.startsWith('write.')) {
      return `${protocol}//api.${hostname.slice('write.'.length)}`
    }
    return `${protocol}//${hostname}:3201`
  }

  // Fallback for server-side rendering
  return 'http://localhost:3201'
}

// Set config BEFORE importing SDK
client.setConfig({
  baseUrl: getApiBaseUrl(),
  // Include credentials (cookies) in all requests
  credentials: 'include',
  // SaveService relies on rejected promises for retries, authentication errors,
  // conflicts, and user-visible failure reporting. Returning `{ error }` would
  // make unchecked SDK calls look like successful saves.
  throwOnError: true,
})

client.interceptors.error.use((error, response) => {
  if (error instanceof ApiRequestError) return error
  const status = response?.status
  return new ApiRequestError(errorMessage(error, status), status, error)
})

console.log('[API Client] Configured with baseUrl:', getApiBaseUrl())

// NOW import and re-export SDK functions (they will use the configured client)
export * from '../api-client/sdk.gen.js'
export * from '../api-client/types.gen.js'
