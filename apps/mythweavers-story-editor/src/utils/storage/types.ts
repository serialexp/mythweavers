export interface StorageProvider {
  /**
   * Get a value from storage
   */
  get<T>(key: string): Promise<T | null>

  /**
   * Set a value in storage
   */
  set<T>(key: string, value: T): Promise<void>

  /**
   * Remove a key from storage
   */
  remove(key: string): Promise<void>

  /**
   * Clear all data from storage
   */
  clear(): Promise<void>

  /**
   * Get all keys in storage
   */
  getKeys(): Promise<string[]>

  /**
   * Check if a key exists
   */
  has(key: string): Promise<boolean>

  /**
   * Get multiple values at once (for performance)
   */
  getMany<T>(keys: string[]): Promise<(T | null)[]>

  /**
   * Set multiple values at once (for performance)
   */
  setMany(entries: Array<{ key: string; value: any }>): Promise<void>
}

export interface StorageConfig {
  /** Name of the database/storage */
  name: string
  /** Version for migrations */
  version?: number
}
