import { StorageConfig, StorageProvider } from './types'

export class IndexedDBProvider implements StorageProvider {
  private dbName: string
  private version: number
  private storeName = 'keyValueStore'
  private db: IDBDatabase | null = null

  constructor(config: StorageConfig) {
    this.dbName = config.name
    this.version = config.version || 1
  }

  private async openDB(): Promise<IDBDatabase> {
    if (this.db) return this.db

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error}`))
      }

      request.onsuccess = () => {
        this.db = request.result
        resolve(this.db)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName)
        }
      }
    })
  }

  async get<T>(key: string): Promise<T | null> {
    const db = await this.openDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.get(key)

      request.onsuccess = () => {
        resolve(request.result || null)
      }

      request.onerror = () => {
        reject(new Error(`Failed to get key ${key}: ${request.error}`))
      }
    })
  }

  async set<T>(key: string, value: T): Promise<void> {
    const db = await this.openDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.put(value, key)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(new Error(`Failed to set key ${key}: ${request.error}`))
      }
    })
  }

  async remove(key: string): Promise<void> {
    const db = await this.openDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.delete(key)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(new Error(`Failed to delete key ${key}: ${request.error}`))
      }
    })
  }

  async clear(): Promise<void> {
    const db = await this.openDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.clear()

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(new Error(`Failed to clear storage: ${request.error}`))
      }
    })
  }

  async getKeys(): Promise<string[]> {
    const db = await this.openDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.getAllKeys()

      request.onsuccess = () => {
        resolve(request.result.map((key) => String(key)))
      }

      request.onerror = () => {
        reject(new Error(`Failed to get keys: ${request.error}`))
      }
    })
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key)
    return value !== null
  }

  async getMany<T>(keys: string[]): Promise<(T | null)[]> {
    const db = await this.openDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const results: (T | null)[] = []
      let completed = 0

      keys.forEach((key, index) => {
        const request = store.get(key)

        request.onsuccess = () => {
          results[index] = request.result || null
          completed++
          if (completed === keys.length) {
            resolve(results)
          }
        }

        request.onerror = () => {
          reject(new Error(`Failed to get key ${key}: ${request.error}`))
        }
      })

      if (keys.length === 0) {
        resolve([])
      }
    })
  }

  async setMany(entries: Array<{ key: string; value: any }>): Promise<void> {
    const db = await this.openDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)

      transaction.oncomplete = () => {
        resolve()
      }

      transaction.onerror = () => {
        reject(new Error(`Failed to set multiple values: ${transaction.error}`))
      }

      entries.forEach(({ key, value }) => {
        store.put(value, key)
      })
    })
  }
}
