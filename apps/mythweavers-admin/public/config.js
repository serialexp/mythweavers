// Runtime configuration for the admin frontend
window.RUNTIME_CONFIG = {
  BACKEND_URL:
    window.BACKEND_URL ||
    (() => {
      const hostname = window.location.hostname
      const protocol = window.location.protocol
      return `${protocol}//${hostname}:3201`
    })(),
}
