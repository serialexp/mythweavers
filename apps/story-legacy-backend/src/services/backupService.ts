import * as fs from 'node:fs'
import * as path from 'node:path'
import * as cron from 'node-cron'
import { logger } from '../lib/logger'

const log = logger.child({ module: 'backup' })

interface BackupConfig {
  sourcePath: string
  backupDir: string
  retention: {
    hourly: number // Keep last N hourly backups
    daily: number // Keep last N daily backups
    weekly: number // Keep last N weekly backups
  }
}

export class BackupService {
  private config: BackupConfig
  private tasks: cron.ScheduledTask[] = []

  constructor(config: BackupConfig) {
    this.config = config
    this.ensureBackupDirectories()
  }

  private ensureBackupDirectories() {
    const dirs = ['hourly', 'daily', 'weekly']
    dirs.forEach((dir) => {
      const fullPath = path.join(this.config.backupDir, dir)
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true })
        log.info(`Created backup directory: ${fullPath}`)
      }
    })
  }

  private getBackupFilename(type: 'hourly' | 'daily' | 'weekly'): string {
    const now = new Date()
    const timestamp = now.toISOString().replace(/[:.]/g, '-')

    switch (type) {
      case 'hourly':
        // Include hour in filename
        return `backup-${timestamp.substring(0, 13)}.db`
      case 'daily':
        // Only include date
        return `backup-${timestamp.substring(0, 10)}.db`
      case 'weekly': {
        // Include week number
        const weekNum = this.getWeekNumber(now)
        return `backup-${now.getFullYear()}-W${weekNum}.db`
      }
      default:
        return `backup-${timestamp}.db`
    }
  }

  private getWeekNumber(date: Date): string {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000
    const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)
    return weekNumber.toString().padStart(2, '0')
  }

  private async createBackup(type: 'hourly' | 'daily' | 'weekly'): Promise<void> {
    try {
      // Check if source database exists
      if (!fs.existsSync(this.config.sourcePath)) {
        log.warn(`Source database not found: ${this.config.sourcePath}`)
        return
      }

      const backupDir = path.join(this.config.backupDir, type)
      const backupFile = path.join(backupDir, this.getBackupFilename(type))

      // Check if backup already exists (important for daily/weekly)
      if (fs.existsSync(backupFile)) {
        log.debug(`Backup already exists: ${backupFile}`)
        return
      }

      // Create backup by copying the file
      // Using streams to handle large files efficiently
      const readStream = fs.createReadStream(this.config.sourcePath)
      const writeStream = fs.createWriteStream(backupFile)

      await new Promise<void>((resolve, reject) => {
        readStream.on('error', reject)
        writeStream.on('error', reject)
        writeStream.on('finish', () => resolve())
        readStream.pipe(writeStream)
      })

      const stats = fs.statSync(backupFile)
      log.info(`Created ${type} backup: ${backupFile} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`)

      // Clean up old backups
      await this.cleanupOldBackups(type)
    } catch (error) {
      log.error({ error, type }, `Failed to create ${type} backup`)
    }
  }

  private async cleanupOldBackups(type: 'hourly' | 'daily' | 'weekly'): Promise<void> {
    try {
      const backupDir = path.join(this.config.backupDir, type)
      const maxBackups = this.config.retention[type]

      // Get all backup files in the directory
      const files = fs
        .readdirSync(backupDir)
        .filter((file) => file.endsWith('.db'))
        .map((file) => ({
          name: file,
          path: path.join(backupDir, file),
          mtime: fs.statSync(path.join(backupDir, file)).mtime,
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime()) // Sort by modification time, newest first

      // Remove old backups if we have more than the retention limit
      if (files.length > maxBackups) {
        const filesToDelete = files.slice(maxBackups)

        for (const file of filesToDelete) {
          fs.unlinkSync(file.path)
          log.info(`Deleted old ${type} backup: ${file.name}`)
        }
      }
    } catch (error) {
      log.error({ error, type }, `Failed to cleanup ${type} backups`)
    }
  }

  public start(): void {
    log.info('Starting backup service with schedule:')
    log.info('- Hourly backups at :00 (keeping last 24)')
    log.info('- Daily backups at 02:00 (keeping last 7)')
    log.info('- Weekly backups on Sunday at 03:00 (keeping last 4)')

    // Run initial backup on start
    this.createBackup('hourly').catch((err) => log.error({ error: err }, 'Initial backup failed'))

    // Schedule hourly backups (at minute 0 of every hour)
    const hourlyTask = cron.schedule('0 * * * *', () => {
      this.createBackup('hourly')
    })

    // Schedule daily backups (at 2 AM every day)
    const dailyTask = cron.schedule('0 2 * * *', () => {
      this.createBackup('daily')
    })

    // Schedule weekly backups (at 3 AM every Sunday)
    const weeklyTask = cron.schedule('0 3 * * 0', () => {
      this.createBackup('weekly')
    })

    this.tasks = [hourlyTask, dailyTask, weeklyTask]

    // Start all scheduled tasks
    this.tasks.forEach((task) => task.start())
  }

  public stop(): void {
    log.info('Stopping backup service')
    this.tasks.forEach((task) => task.stop())
  }

  // Manual backup method
  public async backup(type: 'hourly' | 'daily' | 'weekly' = 'hourly'): Promise<void> {
    await this.createBackup(type)
  }

  // List all backups
  public listBackups(): { hourly: string[]; daily: string[]; weekly: string[] } {
    const result: { hourly: string[]; daily: string[]; weekly: string[] } = {
      hourly: [],
      daily: [],
      weekly: [],
    }
    ;(['hourly', 'daily', 'weekly'] as const).forEach((type) => {
      const backupDir = path.join(this.config.backupDir, type)
      if (fs.existsSync(backupDir)) {
        result[type] = fs
          .readdirSync(backupDir)
          .filter((file) => file.endsWith('.db'))
          .sort()
          .reverse()
      }
    })

    return result
  }

  // Restore from backup
  public async restore(backupPath: string): Promise<void> {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`)
    }

    // Create a backup of current database before restoring
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const currentBackup = `${this.config.sourcePath}.before-restore-${timestamp}`

    if (fs.existsSync(this.config.sourcePath)) {
      fs.copyFileSync(this.config.sourcePath, currentBackup)
      log.info(`Created safety backup before restore: ${currentBackup}`)
    }

    // Restore the backup
    fs.copyFileSync(backupPath, this.config.sourcePath)
    log.info(`Restored database from: ${backupPath}`)
  }
}
