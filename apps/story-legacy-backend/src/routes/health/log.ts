import fs from 'node:fs'
import path from 'node:path'
import { Router } from 'express'
import { createLogger } from '../../lib/logger'

const router = Router()
const log = createLogger('client-logs')

// Create log file path
const logFilePath = path.join(process.cwd(), 'client-logs.txt')

// Logging endpoint to capture client-side logs
router.all('/log', (req, res) => {
  // Handle GET requests for testing
  if (req.method === 'GET') {
    log.debug('GET request received - endpoint is working')
    res.json({
      status: 'ok',
      message: 'Log endpoint is working. Use POST to send logs.',
      timestamp: new Date().toISOString(),
    })
  }

  // Handle POST requests for actual logging
  if (req.method === 'POST') {
    const { level, message, data, timestamp } = req.body

    // Log to pino based on the client's log level
    const logData = { timestamp, clientData: data }
    switch (level?.toLowerCase()) {
      case 'error':
        log.error(logData, `[CLIENT] ${message}`)
        break
      case 'warn':
      case 'warning':
        log.warn(logData, `[CLIENT] ${message}`)
        break
      case 'info':
        log.info(logData, `[CLIENT] ${message}`)
        break
      case 'debug':
        log.debug(logData, `[CLIENT] ${message}`)
        break
      default:
        log.info(logData, `[CLIENT] ${message}`)
    }

    // Also write to file for persistent storage
    const logMessage = `[CLIENT ${level?.toUpperCase() || 'LOG'}] ${timestamp}: ${message}`
    if (data) {
      const dataStr = JSON.stringify(data, null, 2)
      fs.appendFileSync(logFilePath, `${logMessage}\n[CLIENT DATA]: ${dataStr}\n`)
    } else {
      fs.appendFileSync(logFilePath, `${logMessage}\n`)
    }

    res.status(200).json({ received: true })
  }

  // Handle other methods
  res.status(405).json({ error: 'Method not allowed' })
})

export default router
