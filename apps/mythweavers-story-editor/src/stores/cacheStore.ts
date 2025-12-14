import { createStore } from 'solid-js/store'

interface CacheEntry {
  id: string
  content: string
  createdAt: Date
  lastPingedAt: Date
  messageCount: number
}

const [cacheState, setCacheState] = createStore({
  activeCaches: [] as CacheEntry[],
  keepAliveInterval: null as NodeJS.Timeout | null,
  isKeepAliveEnabled: true,
  // Cumulative token and cost statistics for the session
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalCacheWriteTokens: 0,
  totalCacheReadTokens: 0,
  totalInputCost: 0,
  totalOutputCost: 0,
  totalCacheWriteCost: 0,
  totalCacheReadCost: 0,
  totalCost: 0, // Total actual cost
  totalNormalCost: 0, // What it would have cost without caching
  isCacheRefreshing: false
})

// Cache now lasts for 1 hour with TTL
const CACHE_EXPIRY = 60 * 60 * 1000 // 1 hour in milliseconds

export const cacheStore = {
  // Getters
  get activeCaches() { return cacheState.activeCaches },
  get isKeepAliveEnabled() { return cacheState.isKeepAliveEnabled },

  // Actions
  setKeepAliveEnabled: (enabled: boolean) => setCacheState('isKeepAliveEnabled', enabled),

  // Add a cache entry when we send a cacheable request
  addCacheEntry: (id: string, content: string, messageCount: number) => {
    const now = new Date()
    setCacheState('activeCaches', caches => [
      ...caches.filter(c => c.id !== id), // Remove old entry if exists
      {
        id,
        content,
        createdAt: now,
        lastPingedAt: now,
        messageCount
      }
    ])
  },

  // Remove expired caches
  cleanupExpiredCaches: () => {
    const now = new Date()
    setCacheState('activeCaches', caches => 
      caches.filter(cache => {
        const timeSinceLastPing = now.getTime() - cache.lastPingedAt.getTime()
        return timeSinceLastPing < CACHE_EXPIRY
      })
    )
  },

  // Update ping time for a cache
  updateCachePingTime: (id: string) => {
    setCacheState('activeCaches', caches => 
      caches.map(cache => 
        cache.id === id 
          ? { ...cache, lastPingedAt: new Date() }
          : cache
      )
    )
  },

  // Get caches that need pinging - no longer needed with 1-hour TTL
  getCachesNeedingPing: () => {
    // With 1-hour TTL, we don't need to ping caches anymore
    return []
  },

  // Clear all caches
  clearAllCaches: () => {
    setCacheState('activeCaches', [])
  },

  // Token and cost statistics getters
  get totalInputTokens() { return cacheState.totalInputTokens },
  get totalOutputTokens() { return cacheState.totalOutputTokens },
  get totalCacheWriteTokens() { return cacheState.totalCacheWriteTokens },
  get totalCacheReadTokens() { return cacheState.totalCacheReadTokens },
  get totalInputCost() { return cacheState.totalInputCost },
  get totalOutputCost() { return cacheState.totalOutputCost },
  get totalCacheWriteCost() { return cacheState.totalCacheWriteCost },
  get totalCacheReadCost() { return cacheState.totalCacheReadCost },
  get totalCost() { return cacheState.totalCost },
  get totalNormalCost() { return cacheState.totalNormalCost },
  get totalSavings() { 
    // Savings = (what we would have paid normally) - (what we actually paid)
    return cacheState.totalNormalCost - cacheState.totalCost
  },
  get isCacheRefreshing() { return cacheState.isCacheRefreshing },

  // Token and cost statistics setters - now accumulates
  updateTokenStats: (stats: { 
    inputTokens?: number,
    outputTokens?: number,
    cacheWriteTokens?: number,
    cacheReadTokens?: number,
    inputBasePrice?: number, // Base price per input token
    outputBasePrice?: number // Base price per output token
  }) => {
    console.log('updateTokenStats called with:', stats)
    let actualCost = 0
    let normalCost = 0
    
    // Handle regular input tokens (not cached)
    if (stats.inputTokens !== undefined && stats.inputBasePrice !== undefined) {
      const inputCost = stats.inputTokens * stats.inputBasePrice
      setCacheState('totalInputTokens', c => c + stats.inputTokens!)
      setCacheState('totalInputCost', c => c + inputCost)
      actualCost += inputCost
      normalCost += inputCost
    }
    
    // Handle output tokens
    if (stats.outputTokens !== undefined && stats.outputBasePrice !== undefined) {
      const outputCost = stats.outputTokens * stats.outputBasePrice
      setCacheState('totalOutputTokens', c => c + stats.outputTokens!)
      setCacheState('totalOutputCost', c => c + outputCost)
      actualCost += outputCost
      normalCost += outputCost // Output cost is the same regardless of caching
    }
    
    // Handle cache write tokens
    if (stats.cacheWriteTokens !== undefined && stats.inputBasePrice !== undefined) {
      // Cache write costs 2x base price
      const writeCost = stats.cacheWriteTokens * stats.inputBasePrice * 2
      setCacheState('totalCacheWriteTokens', c => c + stats.cacheWriteTokens!)
      setCacheState('totalCacheWriteCost', c => c + writeCost)
      actualCost += writeCost
      // Add what it would have cost as regular input tokens
      normalCost += stats.cacheWriteTokens * stats.inputBasePrice
    }
    
    // Handle cache read tokens
    if (stats.cacheReadTokens !== undefined && stats.inputBasePrice !== undefined) {
      // Cache read costs 0.1x base price
      const readCost = stats.cacheReadTokens * stats.inputBasePrice * 0.1
      setCacheState('totalCacheReadTokens', c => c + stats.cacheReadTokens!)
      setCacheState('totalCacheReadCost', c => c + readCost)
      actualCost += readCost
      // Add what it would have cost as regular input tokens
      normalCost += stats.cacheReadTokens * stats.inputBasePrice
    }
    
    // Update totals
    console.log('Calculated costs:', { actualCost, normalCost })
    if (actualCost > 0) {
      setCacheState('totalCost', c => c + actualCost)
    }
    if (normalCost > 0) {
      setCacheState('totalNormalCost', c => c + normalCost)
    }
    console.log('Updated totalCost to:', cacheState.totalCost + actualCost)
  },

  setIsCacheRefreshing: (refreshing: boolean) => {
    setCacheState('isCacheRefreshing', refreshing)
  },

  // Initialize the keep-alive timer (to be called from within a component)
  initializeKeepAlive: () => {
    // This will be called from App.tsx inside a createEffect
  }
}