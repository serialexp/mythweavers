import { createStore } from 'solid-js/store'
import { getHealth } from '../client/config'
import { authStore } from './authStore'

interface ServerState {
  isAvailable: boolean
  isChecking: boolean
  lastChecked: Date | null
  error: string | null
}

const [state, setState] = createStore<ServerState>({
  isAvailable: true, // Assume available initially
  isChecking: false,
  lastChecked: null,
  error: null
})

export const serverStore = {
  get state() {
    return state
  },

  get isAvailable() {
    return state.isAvailable
  },

  get isChecking() {
    return state.isChecking
  },

  async checkHealth(): Promise<boolean> {
    // Don't automatically mark server as unavailable for local mode
    // The server might still be available, we just aren't using it for this story
    console.log('[ServerStore] Starting health check...')

    // Skip health check on login/reset-password pages
    const path = window.location.pathname
    if (path === '/login' || path === '/reset-password') {
      console.log('[ServerStore] Skipping health check on auth page:', path)
      return true
    }

    setState('isChecking', true)
    setState('error', null)

    try {
      const result = await getHealth()
      console.log('[ServerStore] Health check result:', result)

      const isAvailable = !!result.data
      setState('isAvailable', isAvailable)
      setState('lastChecked', new Date())

      if (!isAvailable) {
        setState('error', 'Server is not available')
      }

      return isAvailable
    } catch (error) {
      console.error('[ServerStore] Health check failed:', error)
      setState('isAvailable', false)
      setState('error', error instanceof Error ? error.message : 'Unknown error')
      setState('lastChecked', new Date())
      return false
    } finally {
      setState('isChecking', false)
    }
  },

  // Periodically check server health
  startHealthCheck(intervalMs: number = 30000): () => void {
    console.log('[ServerStore] Starting periodic health checks with interval:', intervalMs)
    // Do an initial check
    this.checkHealth()
    
    // Set up periodic checks
    const interval = setInterval(() => {
      console.log('[ServerStore] Running periodic health check...')
      this.checkHealth()
    }, intervalMs)
    
    // Return cleanup function
    return () => {
      console.log('[ServerStore] Stopping periodic health checks')
      clearInterval(interval)
    }
  }
}