import { createSignal } from 'solid-js';
import { isServer } from 'solid-js/web';
import { trpc } from '../trpc';

// User type (simplified for now)
export interface User {
  id: string;
  username: string;
  email?: string;
  avatarUrl?: string;
}

// Authentication state
const [currentUser, setCurrentUser] = createSignal<User | null>(null);
const [isLoading, setIsLoading] = createSignal(true);
const [error, setError] = createSignal<string | null>(null);

// Check authentication status on startup
export const initAuth = async () => {
  if (isServer) return;
  
  setIsLoading(true);
  setError(null);
  
  try {
    const token = localStorage.getItem('sessionToken');
    
    if (token) {
      const user = await trpc.whoAmI.query();
      if (user) {
        setCurrentUser(user);
      } else {
        // Invalid token
        localStorage.removeItem('sessionToken');
        setCurrentUser(null);
      }
    } else {
      setCurrentUser(null);
    }
  } catch (err) {
    console.error('Error checking authentication status:', err);
    setError('Failed to authenticate');
    setCurrentUser(null);
  } finally {
    setIsLoading(false);
  }
};

// Login function
export const login = async (username: string, password: string): Promise<boolean> => {
  setIsLoading(true);
  setError(null);
  
  try {
    const result = await trpc.sessionLogin.mutate({ username, password });
    
    if (result?.token) {
      localStorage.setItem('sessionToken', result.token);
      setCurrentUser(result.user);
      return true;
    } else {
      setError('Invalid username or password');
      return false;
    }
  } catch (err) {
    console.error('Login error:', err);
    setError('Login failed');
    return false;
  } finally {
    setIsLoading(false);
  }
};

// Logout function
export const logout = async (): Promise<void> => {
  try {
    await trpc.sessionSignout.mutate();
  } catch (err) {
    console.error('Logout error:', err);
  } finally {
    localStorage.removeItem('sessionToken');
    setCurrentUser(null);
  }
};

// Export signals
export { currentUser, isLoading, error };