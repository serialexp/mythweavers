import { createSignal } from 'solid-js'
import { isServer } from 'solid-js/web'
import { type User, authApi } from '../api'

// Re-export User type for convenience
export type { User }

// Authentication state
const [currentUser, setCurrentUser] = createSignal<User | null>(null)
const [isLoading, setIsLoading] = createSignal(true)
const [error, setError] = createSignal<string | null>(null)

// Check authentication status on startup
export const initAuth = async () => {
  if (isServer) return

  setIsLoading(true)
  setError(null)

  try {
    const result = await authApi.getSession()
    if (result.authenticated && result.user) {
      setCurrentUser(result.user)
    } else {
      setCurrentUser(null)
    }
  } catch (err) {
    console.error('Error checking authentication status:', err)
    setError('Failed to authenticate')
    setCurrentUser(null)
  } finally {
    setIsLoading(false)
  }
}

// Login function
export const login = async (username: string, password: string): Promise<boolean> => {
  setIsLoading(true)
  setError(null)

  try {
    const result = await authApi.login(username, password)

    if (result?.success && result.user) {
      setCurrentUser(result.user)
      return true
    }
    setError('Invalid username or password')
    return false
  } catch (err: any) {
    console.error('Login error:', err)
    setError(err.message || 'Login failed')
    return false
  } finally {
    setIsLoading(false)
  }
}

// Register function
export const register = async (email: string, username: string, password: string): Promise<boolean> => {
  setIsLoading(true)
  setError(null)

  try {
    const result = await authApi.register(email, username, password)

    if (result?.success && result.user) {
      setCurrentUser(result.user)
      return true
    }
    setError('Registration failed')
    return false
  } catch (err: any) {
    console.error('Register error:', err)
    setError(err.message || 'Registration failed')
    return false
  } finally {
    setIsLoading(false)
  }
}

// Logout function
export const logout = async (): Promise<void> => {
  try {
    await authApi.logout()
  } catch (err) {
    console.error('Logout error:', err)
  } finally {
    setCurrentUser(null)
  }
}

// Export signals
export { currentUser, isLoading, error }
