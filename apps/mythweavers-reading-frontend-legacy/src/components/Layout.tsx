import { IconButton, NavBar, NavBarActions, NavBarBrand, NavBarNav, NavLink, useTheme } from '@mythweavers/ui'
import { AccessorWithLatest } from '@solidjs/router'
import type { ParentComponent } from 'solid-js'
import type { UserSession } from '~/lib/session'
import * as styles from './Layout.css'
import UserStatus from './UserStatus'

export const Layout: ParentComponent<{
  user?: AccessorWithLatest<UserSession | undefined | null>
}> = (props) => {
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
              src="/mythweavers.png"
              alt="MythWeavers"
              style={{ height: '32px', 'margin-right': '8px' }}
            />
            MythWeavers
          </NavBarBrand>

          <NavBarNav>
            <NavLink href="/">Home</NavLink>
            <NavLink href="/stories">Stories</NavLink>
          </NavBarNav>

          <NavBarActions>
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
