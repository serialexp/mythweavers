/**
 * Unified Backend API Client Configuration
 *
 * This file wraps the auto-generated API client with configuration.
 * IMPORTANT: Must import and configure client BEFORE importing SDK functions.
 */

// Import client first
import { client } from '../api-client/client.gen.js'

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

  // Default to localhost
  return 'http://localhost:3201'
}

// Set config BEFORE importing SDK
client.setConfig({
  baseUrl: getApiBaseUrl(),
  // Include credentials (cookies) in all requests
  credentials: 'include',
})

console.log('[API Client] Configured with baseUrl:', getApiBaseUrl())

// NOW import and re-export SDK functions (they will use the configured client)
export * from '../api-client/sdk.gen.js'
export * from '../api-client/types.gen.js'
