import { createStore } from 'solid-js/store'
import { getAuthSession, postAuthLogout } from '../client/config'

interface User {
  id: number
  email: string
  username: string
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  isOfflineMode: boolean
  lastLoginTime: number | null
}

// Check localStorage for offline mode on initialization
const storedOfflineMode = localStorage.getItem('offlineMode') === 'true'

const [authState, setAuthState] = createStore<AuthState>({
  user: null,
  isAuthenticated: storedOfflineMode,
  isLoading: !storedOfflineMode, // Don't show loading if already in offline mode
  isOfflineMode: storedOfflineMode,
  lastLoginTime: null,
})

export const authStore = {
  get user() {
    return authState.user
  },
  get isAuthenticated() {
    return authState.isAuthenticated
  },
  get isLoading() {
    return authState.isLoading
  },
  get isOfflineMode() {
    return authState.isOfflineMode
  },

  setUser(user: User | null) {
    console.log('[authStore] setUser called with:', user)
    // Clear offline mode when a real user logs in
    if (user) {
      localStorage.removeItem('offlineMode')
    }
    setAuthState({
      user,
      isAuthenticated: !!user,
      isLoading: false,
      isOfflineMode: false,
      lastLoginTime: user ? Date.now() : null,
    })
    console.log('[authStore] Auth state updated:', {
      isAuthenticated: !!user,
      isLoading: false,
      lastLoginTime: user ? Date.now() : null,
    })
  },

  setOfflineMode() {
    localStorage.setItem('offlineMode', 'true')
    setAuthState({
      user: null,
      isAuthenticated: true,
      isLoading: false,
      isOfflineMode: true,
    })
  },

  clearLoading() {
    setAuthState('isLoading', false)
  },

  async checkSession() {
    console.log('[authStore] checkSession called')
    // If user just logged in (within last 5 seconds), don't overwrite their auth state
    if (authState.lastLoginTime && Date.now() - authState.lastLoginTime < 5000) {
      console.log('[authStore] Skipping session check - user logged in recently (within 5s)')
      setAuthState('isLoading', false)
      return true
    }

    // If we're already authenticated (just logged in), don't re-check
    if (authState.isAuthenticated && authState.user && !authState.isOfflineMode) {
      setAuthState('isLoading', false)
      return true
    }

    // If we're in offline mode, don't check the session
    const isOffline = localStorage.getItem('offlineMode') === 'true'
    if (isOffline || authState.isOfflineMode) {
      setAuthState({
        user: null,
        isAuthenticated: true,
        isLoading: false,
        isOfflineMode: true,
      })
      return true
    }

    setAuthState('isLoading', true)
    try {
      const result = await getAuthSession()
      const authenticated = result.data?.authenticated ?? false
      const user = result.data?.user ?? null

      if (authenticated) {
        localStorage.removeItem('offlineMode')
      }
      setAuthState({
        user: authenticated ? user : null,
        isAuthenticated: authenticated,
        isLoading: false,
        isOfflineMode: false,
      })
      return authenticated
    } catch (error) {
      console.error('Session check failed:', error)
      // Keep offline mode if it was set
      const isOffline = localStorage.getItem('offlineMode') === 'true'
      setAuthState({
        user: null,
        isAuthenticated: isOffline,
        isLoading: false,
        isOfflineMode: isOffline,
      })
      return isOffline
    }
  },

  async logout() {
    try {
      // Only call logout API if not in offline mode
      if (!authState.isOfflineMode) {
        await postAuthLogout()
      }
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      localStorage.removeItem('offlineMode')
      setAuthState({
        user: null,
        isAuthenticated: false,
        isOfflineMode: false,
      })
      // Navigation will be handled by the component that calls logout
    }
  },
}
