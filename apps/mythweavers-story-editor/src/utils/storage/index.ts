import { IndexedDBProvider } from './IndexedDBProvider'
import { StorageProvider } from './types'

// Storage keys that should remain in localStorage
const LOCAL_STORAGE_KEYS = [
  // Settings
  'story-settings',
  'story-model',
  'story-setting',
  'story-context-size',
  'story-chars-per-token',
  'story-provider',
  'story-openrouter-api-key',
  'story-anthropic-api-key',
  'story-use-smart-context',
  'story-person',
  'story-tense',
  'story-auto-generate',
  'story-paragraphs-per-turn',
  // Other system keys
  'ollama-models',
  'story-detected-limit',
  // Migration status keys
  'story-storage-migrated',
  'story-storage-migration-status',
  'story-storage-migration-info',
]

class StorageManager {
  private storageProvider: StorageProvider | null = null
  private initialized = false
  private initPromise: Promise<void> | null = null

  /**
   * Initialize the storage provider and perform migrations
   */
  async initialize(): Promise<void> {
    if (this.initialized) return
    if (this.initPromise) return this.initPromise

    this.initPromise = this._initialize()
    await this.initPromise
    this.initialized = true
  }

  private async _initialize(): Promise<void> {
    // Create IndexedDB provider
    this.storageProvider = new IndexedDBProvider({
      name: 'StoryWriterDB',
      version: 1,
    })

    // Perform migration from localStorage
    await this.migrateFromLocalStorage()
  }

  /**
   * Migrate data from localStorage to IndexedDB
   */
  private async migrateFromLocalStorage(): Promise<void> {
    try {
      // Check if migration has already been completed
      const migrationStatus = localStorage.getItem('story-storage-migration-status')
      if (migrationStatus === 'completed') return

      // Check if migration is in progress or done
      const migrationDone = localStorage.getItem('story-storage-migrated')
      if (migrationDone === 'true') {
        console.log('Migration already performed, awaiting user confirmation to cleanup localStorage')
        return
      }

      console.log('Starting localStorage to IndexedDB migration...')

      // Get all localStorage keys
      const allKeys = Object.keys(localStorage)
      const keysToMigrate = allKeys.filter(
        (key) => !LOCAL_STORAGE_KEYS.includes(key) && !key.includes('storage-migration'),
      )

      let migratedCount = 0
      const migrationErrors: string[] = []

      // Migrate each key
      for (const key of keysToMigrate) {
        try {
          const value = localStorage.getItem(key)
          if (value) {
            // Parse the value to store as object in IndexedDB
            let parsedValue
            try {
              parsedValue = JSON.parse(value)

              // Special handling for saved stories to ensure they have storageMode
              if (key.startsWith('story-saved-') && typeof parsedValue === 'object') {
                // If no storageMode is set, determine based on serverId
                if (!parsedValue.storageMode) {
                  parsedValue.storageMode = parsedValue.serverId ? 'server' : 'local'
                }
              }

              // Special handling for story index
              if (key === 'story-index' && Array.isArray(parsedValue)) {
                parsedValue = parsedValue.map((story) => ({
                  ...story,
                  storageMode: story.storageMode || (story.serverId ? 'server' : 'local'),
                }))
              }
            } catch {
              // If not JSON, store as string
              parsedValue = value
            }

            await this.storageProvider!.set(key, parsedValue)
            migratedCount++
            // DO NOT remove from localStorage yet - wait for user confirmation
          }
        } catch (error) {
          console.error(`Failed to migrate key ${key}:`, error)
          migrationErrors.push(key)
        }
      }

      // Mark migration as done (but not cleaned up)
      localStorage.setItem('story-storage-migrated', 'true')
      localStorage.setItem(
        'story-storage-migration-info',
        JSON.stringify({
          date: new Date().toISOString(),
          keysToMigrate: keysToMigrate.length,
          migratedCount,
          errors: migrationErrors,
        }),
      )

      console.log(`Migration completed: ${migratedCount}/${keysToMigrate.length} keys migrated`)
      if (migrationErrors.length > 0) {
        console.error('Failed to migrate keys:', migrationErrors)
      }
    } catch (error) {
      console.error('Migration failed:', error)
      // Don't throw - allow app to continue with localStorage fallback
    }
  }

  /**
   * Clean up localStorage after successful migration
   */
  async cleanupAfterMigration(): Promise<{ success: boolean; message: string }> {
    try {
      const migrationDone = localStorage.getItem('story-storage-migrated')
      if (migrationDone !== 'true') {
        return { success: false, message: 'Migration has not been performed yet' }
      }

      const migrationStatus = localStorage.getItem('story-storage-migration-status')
      if (migrationStatus === 'completed') {
        return { success: false, message: 'Migration cleanup already completed' }
      }

      // Get migration info
      // Migration info was already used during initialization

      // Remove migrated keys from localStorage
      const allKeys = Object.keys(localStorage)
      const keysToRemove = allKeys.filter(
        (key) => !LOCAL_STORAGE_KEYS.includes(key) && !key.includes('storage-migration'),
      )

      let removedCount = 0
      for (const key of keysToRemove) {
        try {
          localStorage.removeItem(key)
          removedCount++
        } catch (error) {
          console.error(`Failed to remove key ${key}:`, error)
        }
      }

      // Mark cleanup as complete
      localStorage.setItem('story-storage-migration-status', 'completed')

      const message = `Successfully cleaned up ${removedCount} keys from localStorage`
      console.log(message)

      return { success: true, message }
    } catch (error) {
      console.error('Cleanup failed:', error)
      return { success: false, message: `Cleanup failed: ${error}` }
    }
  }

  /**
   * Get migration status information
   */
  getMigrationStatus(): {
    migrated: boolean
    cleanedUp: boolean
    info: any
  } {
    const migrated = localStorage.getItem('story-storage-migrated') === 'true'
    const cleanedUp = localStorage.getItem('story-storage-migration-status') === 'completed'
    const infoStr = localStorage.getItem('story-storage-migration-info')
    const info = infoStr ? JSON.parse(infoStr) : null

    return { migrated, cleanedUp, info }
  }

  /**
   * Get a value from storage
   * Checks localStorage first for specific keys, then IndexedDB
   */
  async get<T>(key: string): Promise<T | null> {
    await this.initialize()

    // Check if this key should be in localStorage
    if (LOCAL_STORAGE_KEYS.includes(key)) {
      try {
        const value = localStorage.getItem(key)
        return value ? JSON.parse(value) : null
      } catch {
        return null
      }
    }

    // Otherwise, get from IndexedDB
    return this.storageProvider!.get<T>(key)
  }

  /**
   * Set a value in storage
   * Routes to localStorage or IndexedDB based on key
   */
  async set<T>(key: string, value: T): Promise<void> {
    await this.initialize()

    // Check if this key should be in localStorage
    if (LOCAL_STORAGE_KEYS.includes(key)) {
      try {
        localStorage.setItem(key, JSON.stringify(value))
        return
      } catch (error) {
        if (error instanceof Error && error.name === 'QuotaExceededError') {
          throw new Error('localStorage quota exceeded')
        }
        throw error
      }
    }

    // Otherwise, set in IndexedDB
    try {
      console.log('[StorageManager.set] Saving to IndexedDB:', { key, valueType: typeof value })
      return await this.storageProvider!.set(key, value)
    } catch (error) {
      console.error('[StorageManager.set] Failed to save to IndexedDB:', error)
      console.error('[StorageManager.set] Error details:', {
        key,
        valueType: typeof value,
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
        isDOMException: error instanceof DOMException,
      })
      throw error
    }
  }

  /**
   * Remove a key from storage
   */
  async remove(key: string): Promise<void> {
    await this.initialize()

    // Check if this key should be in localStorage
    if (LOCAL_STORAGE_KEYS.includes(key)) {
      localStorage.removeItem(key)
      return
    }

    // Otherwise, remove from IndexedDB
    return this.storageProvider!.remove(key)
  }

  /**
   * Get all keys from IndexedDB
   */
  async getKeys(): Promise<string[]> {
    await this.initialize()
    return this.storageProvider!.getKeys()
  }

  /**
   * Check if a key exists
   */
  async has(key: string): Promise<boolean> {
    await this.initialize()

    // Check localStorage first
    if (LOCAL_STORAGE_KEYS.includes(key)) {
      return localStorage.getItem(key) !== null
    }

    // Otherwise, check IndexedDB
    return this.storageProvider!.has(key)
  }

  /**
   * Clear all IndexedDB data (preserves localStorage)
   */
  async clearIndexedDB(): Promise<void> {
    await this.initialize()
    return this.storageProvider!.clear()
  }

  /**
   * Get storage info for display
   */
  async getStorageInfo(): Promise<{
    indexedDBKeys: number
    localStorageKeys: number
    estimatedSize?: number
  }> {
    await this.initialize()

    const indexedDBKeys = await this.storageProvider!.getKeys()
    const localStorageKeys = Object.keys(localStorage)

    let estimatedSize
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate()
      estimatedSize = estimate.usage
    }

    return {
      indexedDBKeys: indexedDBKeys.length,
      localStorageKeys: localStorageKeys.length,
      estimatedSize,
    }
  }
}

// Export singleton instance
export const storage = new StorageManager()

// Export types
export type { StorageProvider, StorageConfig } from './types'
