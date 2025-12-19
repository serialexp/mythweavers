import pino from 'pino'
import pinoHttp from 'pino-http'

// ABOUTME: Logging configuration for the backend server
// ABOUTME: Uses JSON output; pipe to pino-pretty externally for development

// Create the base logger - always output JSON to stdout
// For pretty logs in development, pipe through pino-pretty externally:
//   npm run dev | pino-pretty
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label }
    },
  },
})

// Create HTTP request logger middleware
export const httpLogger = pinoHttp({
  logger,
  // Customize the request logging
  customLogLevel: (_req, res, err) => {
    if (res.statusCode >= 400 && res.statusCode < 500) {
      return 'warn'
    }
    if (res.statusCode >= 500 || err) {
      return 'error'
    }
    if (res.statusCode >= 300 && res.statusCode < 400) {
      return 'silent'
    }
    return 'info'
  },
  // Customize the success message
  customSuccessMessage: (req, res) => {
    if (res.statusCode === 404) {
      return `404 - ${req.method} ${req.url}`
    }
    return `${req.method} ${req.url} - ${res.statusCode}`
  },
  // Customize the error message
  customErrorMessage: (req, res, err) => `${req.method} ${req.url} - ${res.statusCode} - ${err.message}`,
  // Add custom properties to logs
  customProps: (req, res) => ({
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
  }),
  // Redact sensitive information
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
    remove: true,
  },
  // Don't log these paths (health checks, client logs, etc)
  autoLogging: {
    ignore: (req) => {
      return req.url === '/api/health' || req.url === '/health' || req.url === '/api/log' || req.url === '/log'
    },
  },
})

// Export child logger creators for different modules
export const createLogger = (module: string) => {
  return logger.child({ module })
}

// Shutdown function to flush and close the logger
export const shutdownLogger = async () => {
  await new Promise<void>((resolve) => {
    logger.flush(() => {
      resolve()
    })
  })
}
