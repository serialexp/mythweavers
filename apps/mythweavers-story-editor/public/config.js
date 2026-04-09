// Runtime configuration for the frontend
// This file is served statically and can be modified at runtime
window.RUNTIME_CONFIG = {
  // Default backend URL - can be overridden at runtime
  //
  // Resolution order:
  // 1. window.BACKEND_URL (explicit override)
  // 2. If hostname starts with "write.", swap to "api." (reverse-proxy setup)
  // 3. Same hostname on port 3201 (local / docker-compose setup)
  BACKEND_URL:
    window.BACKEND_URL ||
    (() => {
      const hostname = window.location.hostname
      const protocol = window.location.protocol
      if (hostname.startsWith("write.")) {
        return `${protocol}//api.${hostname.slice("write.".length)}`
      }
      return `${protocol}//${hostname}:3201`
    })(),

  // Stripe publishable key — set via STRIPE_PUBLISHABLE_KEY env var in Docker,
  // or VITE_STRIPE_PUBLISHABLE_KEY at build time for local dev.
  STRIPE_PUBLISHABLE_KEY: "",
}
