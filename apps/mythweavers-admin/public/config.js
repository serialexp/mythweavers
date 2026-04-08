// Runtime configuration for the admin frontend
window.RUNTIME_CONFIG = {
  BACKEND_URL:
    window.BACKEND_URL ||
    (() => {
      const hostname = window.location.hostname
      const protocol = window.location.protocol
      // Reverse-proxy convention: admin.example.com → api.example.com
      if (hostname.startsWith("admin.")) {
        return `${protocol}//api.${hostname.slice("admin.".length)}`
      }
      return `${protocol}//${hostname}:3201`
    })(),
}
