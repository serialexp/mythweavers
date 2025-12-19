import {
  type Accessor,
  type ParentComponent,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  useContext,
} from 'solid-js'
import { isServer } from 'solid-js/web'
import { ThemeClassContext } from './ThemeClassContext'
import { chronicleTheme } from './chronicle.css'
import { starlightTheme } from './starlight.css'

export type ThemeName = 'chronicle' | 'starlight' | 'system'

const themes = {
  chronicle: chronicleTheme,
  starlight: starlightTheme,
} as const

interface ThemeContextValue {
  theme: Accessor<ThemeName>
  resolvedTheme: Accessor<'chronicle' | 'starlight'>
  setTheme: (theme: ThemeName) => void
}

const ThemeContext = createContext<ThemeContextValue>()

// Store server theme for SSR fallback
let serverThemeOverride: 'chronicle' | 'starlight' | undefined

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext)
  if (!context) {
    if (isServer) {
      // Return a safe fallback for SSR using server override if available
      return {
        theme: () => 'system',
        resolvedTheme: () => serverThemeOverride ?? 'starlight',
        setTheme: () => {},
      }
    }
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

interface ThemeProviderProps {
  defaultTheme?: ThemeName
  storageKey?: string
  /** Theme resolved on the server (from cookie) - used for SSR */
  serverResolvedTheme?: 'chronicle' | 'starlight'
}

export const ThemeProvider: ParentComponent<ThemeProviderProps> = (props) => {
  const storageKey = props.storageKey ?? 'writer-ui-theme'

  // Set server theme override for SSR
  if (isServer && props.serverResolvedTheme) {
    serverThemeOverride = props.serverResolvedTheme
  }

  // Get initial theme from storage or default
  const getInitialTheme = (): ThemeName => {
    if (typeof window === 'undefined') return props.defaultTheme ?? 'system'
    const stored = localStorage.getItem(storageKey)
    if (stored && (stored === 'chronicle' || stored === 'starlight' || stored === 'system')) {
      return stored
    }
    return props.defaultTheme ?? 'system'
  }

  const [theme, setThemeSignal] = createSignal<ThemeName>(getInitialTheme())

  // Resolve 'system' to actual theme based on prefers-color-scheme
  const getSystemTheme = (): 'chronicle' | 'starlight' => {
    if (typeof window === 'undefined') return props.serverResolvedTheme ?? 'starlight'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'chronicle' : 'starlight'
  }

  // On server, use serverResolvedTheme; on client, resolve based on theme setting
  const getInitialResolvedTheme = (): 'chronicle' | 'starlight' => {
    if (isServer && props.serverResolvedTheme) {
      return props.serverResolvedTheme
    }
    const t = theme()
    if (t === 'system') return getSystemTheme()
    return t as 'chronicle' | 'starlight'
  }

  const [resolvedTheme, setResolvedTheme] = createSignal<'chronicle' | 'starlight'>(
    getInitialResolvedTheme(),
  )

  // Listen for system theme changes
  createEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (theme() === 'system') {
        setResolvedTheme(getSystemTheme())
      }
    }

    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  })

  // Update resolved theme when theme changes
  createEffect(() => {
    const t = theme()
    if (t === 'system') {
      setResolvedTheme(getSystemTheme())
    } else {
      setResolvedTheme(t)
    }
  })

  const setTheme = (newTheme: ThemeName) => {
    setThemeSignal(newTheme)
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, newTheme)
      // Also set cookie for SSR
      document.cookie = `${storageKey}=${newTheme};path=/;max-age=31536000;SameSite=Lax`
    }
  }

  // Apply theme class to root element
  createEffect(() => {
    if (typeof document === 'undefined') return

    const resolved = resolvedTheme()
    const themeClass = themes[resolved]

    // Remove any existing theme classes and add the new one
    document.documentElement.classList.remove(chronicleTheme, starlightTheme)
    document.documentElement.classList.add(themeClass)
  })

  // Memoize the theme class for portals
  const themeClass = createMemo(() => themes[resolvedTheme()])

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      <ThemeClassContext.Provider value={themeClass}>{props.children}</ThemeClassContext.Provider>
    </ThemeContext.Provider>
  )
}
