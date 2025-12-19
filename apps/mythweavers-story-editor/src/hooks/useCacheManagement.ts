import { createEffect, onCleanup } from 'solid-js'
import { cacheStore } from '../stores/cacheStore'

export const useCacheManagement = () => {
  // Cache management is simplified with 1-hour TTL
  // We no longer need to ping the cache every 5 minutes

  createEffect(() => {
    console.log('Cache management initialized - using 1-hour TTL')

    // Clean up any old cache entries periodically (every 5 minutes)
    const interval = setInterval(
      () => {
        cacheStore.cleanupExpiredCaches()
      },
      5 * 60 * 1000,
    )

    onCleanup(() => {
      clearInterval(interval)
    })
  })

  return {
    // Additional cache-related functions can be exposed here if needed
  }
}
