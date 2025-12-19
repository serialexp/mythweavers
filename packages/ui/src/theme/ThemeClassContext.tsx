import { type Accessor, createContext, useContext } from 'solid-js'

/**
 * Context for passing the current theme class to portals and other components
 * that render outside the normal DOM tree.
 */
const ThemeClassContext = createContext<Accessor<string>>()

/**
 * Get the current theme class from context.
 * Returns undefined if not within a theme provider.
 */
export function useThemeClass(): string | undefined {
  const themeClass = useContext(ThemeClassContext)
  return themeClass?.()
}

export { ThemeClassContext }
