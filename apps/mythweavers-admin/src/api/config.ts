/**
 * Admin API Client Configuration
 *
 * Same pattern as the story editor: configure the generated client, then
 * re-export the SDK functions so every consumer imports from here.
 *
 * IMPORTANT: Must import and configure client BEFORE importing SDK functions.
 */

// Import client first
import { client } from "../api-client/client.gen"

// Configure the client base URL IMMEDIATELY
export const getApiBaseUrl = (): string => {
  // Check for runtime config (Docker deployments)
  if (typeof window !== "undefined" && (window as unknown as Record<string, unknown>).RUNTIME_CONFIG) {
    const config = (window as unknown as Record<string, unknown>).RUNTIME_CONFIG as {
      BACKEND_URL?: string
    }
    if (config.BACKEND_URL) return config.BACKEND_URL
  }

  // Check for build-time environment variable
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL as string
  }

  // Default to current hostname with API port
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location
    return `${protocol}//${hostname}:3201`
  }

  // Fallback for SSR
  return "http://localhost:3201"
}

// Set config BEFORE importing SDK
client.setConfig({
  baseUrl: getApiBaseUrl(),
  credentials: "include",
})

// NOW re-export SDK functions (they will use the configured client)
export * from "../api-client/sdk.gen"
export * from "../api-client/types.gen"
