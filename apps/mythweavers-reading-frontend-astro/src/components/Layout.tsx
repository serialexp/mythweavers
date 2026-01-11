import { IconButton, LinkButton, NavBar, NavBarActions, NavBarBrand, NavBarNav, NavLink, ThemeProvider, useTheme } from '@mythweavers/ui'
import type { ParentComponent } from 'solid-js'
import * as styles from './Layout.css'
import UserStatus, { type UserSession } from './UserStatus'

// Editor URL - uses localhost in dev, production URL otherwise
const getEditorUrl = () => {
  if (typeof window !== 'undefined' && window.location.host.includes('localhost')) {
    return 'http://localhost:3203'
  }
  return import.meta.env.PUBLIC_EDITOR_URL || 'https://write.mythweavers.io'
}

// Inner layout that uses theme context
const LayoutInner: ParentComponent<{ user?: UserSession | null }> = (props) => {
  const { resolvedTheme, setTheme } = useTheme()

  const toggleTheme = () => {
    setTheme(resolvedTheme() === 'starlight' ? 'chronicle' : 'starlight')
  }

  const isDark = () => resolvedTheme() === 'chronicle'

  return (
    <div class={isDark() ? styles.darkTheme : styles.lightTheme}>
      <div class={styles.pageWrapper}>
        <NavBar variant="elevated" position="sticky">
          <NavBarBrand href="/">
            <img
              src="/mythweavers-48x32.png"
              srcset="/mythweavers-48x32.png 1x, /mythweavers-48x32@2x.png 2x"
              alt="MythWeavers"
              width={48}
              height={32}
              style={{ 'margin-right': '8px' }}
            />
            MythWeavers
          </NavBarBrand>

          <NavBarNav>
            <NavLink href="/">Home</NavLink>
            <NavLink href="/stories">Stories</NavLink>
          </NavBarNav>

          <NavBarActions>
            <LinkButton href={getEditorUrl()} variant="primary" size="sm">
              Start Writing
            </LinkButton>
            <UserStatus user={props.user} />

            <IconButton
              variant="ghost"
              onClick={toggleTheme}
              aria-label={isDark() ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark() ? '☀️' : '🌙'}
            </IconButton>
          </NavBarActions>
        </NavBar>

        <main
          class={styles.mainContent}
          style={{
            'background-image': isDark() ? 'url(/bg-dark.png)' : 'url(/bg-light.png)',
            'background-attachment': 'fixed',
            'background-size': 'cover',
          }}
        >
          {props.children}
        </main>
      </div>
    </div>
  )
}

// Exported Layout wraps with ThemeProvider
export const Layout: ParentComponent<{
  user?: UserSession | null
  initialTheme?: 'chronicle' | 'starlight'
}> = (props) => {
  return (
    <ThemeProvider defaultTheme="system" serverResolvedTheme={props.initialTheme}>
      <LayoutInner user={props.user}>{props.children}</LayoutInner>
    </ThemeProvider>
  )
}
