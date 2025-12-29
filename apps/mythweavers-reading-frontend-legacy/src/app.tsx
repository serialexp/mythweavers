import { ThemeProvider } from '@mythweavers/ui'
import { chronicleTheme, starlightTheme } from '@mythweavers/ui/theme'
import { MetaProvider } from '@solidjs/meta'
import { Router } from '@solidjs/router'
import { FileRoutes } from '@solidjs/start/router'
import { Suspense } from 'solid-js'
import { getRequestEvent, isServer } from 'solid-js/web'
import './app.css'

function getInitialTheme(): 'chronicle' | 'starlight' | undefined {
  if (isServer) {
    // On server, read from request cookies
    try {
      const event = getRequestEvent()
      const cookieHeader = event?.request?.headers?.get('cookie') ?? ''
      const match = cookieHeader.match(/writer-ui-theme=(chronicle|starlight)/)
      if (match) {
        return match[1] as 'chronicle' | 'starlight'
      }
      return 'starlight' // Default
    } catch {
      return 'starlight'
    }
  }
  // On client, detect from the class that entry-server.tsx applied to <html>
  if (document.documentElement.classList.contains(chronicleTheme)) {
    return 'chronicle'
  }
  if (document.documentElement.classList.contains(starlightTheme)) {
    return 'starlight'
  }
  return undefined
}

export default function App() {
  const initialTheme = getInitialTheme()

  return (
    <ThemeProvider defaultTheme="system" serverResolvedTheme={initialTheme}>
      <MetaProvider>
        <Router root={(props) => <Suspense>{props.children}</Suspense>}>
          <FileRoutes />
        </Router>
      </MetaProvider>
    </ThemeProvider>
  )
}
