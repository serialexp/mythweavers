import { createServer } from 'node:http'
import * as path from 'node:path'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { httpLogger, logger } from './lib/logger'
import { prisma } from './lib/prisma'
import routes from './routes'
import { BackupService } from './services/backupService'
import { initializeEmbeddingCleanup } from './services/embeddingCleanupService'
import { initializeWebSocket } from './websocket'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001
const log = logger.child({ module: 'server' })

// Create HTTP server
const server = createServer(app)

// Initialize WebSocket server
initializeWebSocket(server)

// Initialize embedding cleanup service
initializeEmbeddingCleanup()

// Add request logging middleware (before other middleware)
app.use(httpLogger)

// Configure CORS
const defaultOrigins = [
  'http://localhost:3003',
  'http://localhost:5173',
  'http://127.0.0.1:3003',
  'http://127.0.0.1:5173',
  'http://home.serial-experiments.com:3003',
  'https://home.serial-experiments.com:3003',
  'http://home.serial-experiments.com',
  'https://home.serial-experiments.com',
]

const corsOptions = {
  origin:
    process.env.CORS_ORIGIN === '*'
      ? true // Allow all origins
      : process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(',') // Use provided origins
        : defaultOrigins, // Use default development origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}

// Log CORS configuration
log.info(
  {
    corsOrigin: process.env.CORS_ORIGIN || 'defaults',
    allowedOrigins: corsOptions.origin === true ? '*' : corsOptions.origin,
  },
  'CORS configuration',
)

app.use(cors(corsOptions))
app.use(cookieParser())
app.use(express.json({ limit: '20mb' }))

// Mount all routes
app.use(routes)

// Catch-all 404 handler - must be after all other routes
app.use((req, res) => {
  log.warn({ method: req.method, url: req.url }, 'Route not found')
  res.status(404).json({
    error: 'Route not found',
    method: req.method,
    url: req.url,
    message: 'The requested API endpoint does not exist',
  })
})

// Initialize backup service if database exists
let backupService: BackupService | null = null

const initializeBackupService = () => {
  // DATABASE_URL is relative to the prisma directory
  const dbUrl = process.env.DATABASE_URL || 'file:./stories.db'
  const dbRelativePath = dbUrl.replace('file:', '')
  // Resolve the path relative to the prisma directory
  const dbPath = path.resolve(__dirname, '../prisma', dbRelativePath)
  const backupDir = process.env.BACKUP_DIR || path.join(path.dirname(dbPath), 'backups')

  backupService = new BackupService({
    sourcePath: dbPath,
    backupDir: backupDir,
    retention: {
      hourly: Number.parseInt(process.env.BACKUP_RETENTION_HOURLY || '24'), // Keep last 24 hours
      daily: Number.parseInt(process.env.BACKUP_RETENTION_DAILY || '7'), // Keep last 7 days
      weekly: Number.parseInt(process.env.BACKUP_RETENTION_WEEKLY || '4'), // Keep last 4 weeks
    },
  })

  // Only start scheduled backups if explicitly enabled
  if (process.env.ENABLE_BACKUPS === 'true') {
    backupService.start()
    log.info('Automatic backups enabled')
  } else {
    log.info('Automatic backups disabled (set ENABLE_BACKUPS=true to enable)')
  }
}

// Start server
server.listen(PORT as number, '0.0.0.0', () => {
  log.info({ port: PORT }, `Story backend server running on http://0.0.0.0:${PORT}`)
  log.info(`Accessible at http://localhost:${PORT} and http://<your-ip>:${PORT}`)

  // Initialize backup service after server starts
  try {
    initializeBackupService()
  } catch (error) {
    log.error({ error }, 'Failed to initialize backup service')
  }
})

// Graceful shutdown
process.on('SIGINT', async () => {
  log.info('Shutting down server...')

  // Stop backup service
  if (backupService) {
    backupService.stop()
  }

  // Disconnect Prisma
  await prisma.$disconnect()

  log.info('Server shutdown complete')
  process.exit()
})
