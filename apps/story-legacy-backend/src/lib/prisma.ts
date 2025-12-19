import { PrismaClient } from '../generated/prisma'

// Create a single instance of PrismaClient to be reused across the application
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
})

// Initialize SQLite with safe settings
async function initializeSQLite() {
  try {
    // Use DELETE journal mode for maximum safety (no WAL)
    await prisma.$queryRawUnsafe('PRAGMA journal_mode = DELETE')

    // Use FULL synchronous mode for maximum data integrity
    await prisma.$queryRawUnsafe('PRAGMA synchronous = FULL')

    // Set busy timeout to 30 seconds - CLI will wait for server locks to release
    await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 30000')
  } catch (error) {
    console.error('Failed to apply SQLite settings:', error)
  }
}

// Initialize on startup
initializeSQLite()

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect()
})
