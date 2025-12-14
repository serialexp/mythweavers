// Runtime configuration for the frontend
// This file is served statically and can be modified at runtime
window.RUNTIME_CONFIG = {
  // Default backend URL - can be overridden at runtime
  // If BACKEND_URL is not provided, construct it based on current hostname
  //
  // Default behavior:
  // - Uses same hostname as frontend but on port 3201
  // - This works for docker-compose setup where frontend is on :80 and backend on :3201
  // - For production with reverse proxy (e.g., Caddy), set BACKEND_URL explicitly
  //   via environment variable to point to the correct backend URL
  BACKEND_URL: window.BACKEND_URL || (() => {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    // Always use same hostname on port 3201 by default (unified backend)
    // Override with BACKEND_URL env var for different setups
    return `${protocol}//${hostname}:3201`;
  })()
};