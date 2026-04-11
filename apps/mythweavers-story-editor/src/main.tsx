import { ThemeProvider } from '@mythweavers/ui'
import { Router } from '@solidjs/router'
import { render } from 'solid-js/web'
import App from './App.tsx'
import { AppErrorBoundary } from './components/ErrorBoundary.tsx'
import './index.css'
import './styles/variables.css'

// Global error handlers are registered in index.html (before module evaluation)
// to catch errors during module initialization.

// Unregister any existing service workers
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister()
      console.log('Unregistered service worker:', registration.scope)
    }
  })
}

render(() => {
  return (
    <ThemeProvider defaultTheme="chronicle">
      <Router>
        <AppErrorBoundary>
          <App />
        </AppErrorBoundary>
      </Router>
    </ThemeProvider>
  )
}, document.getElementById('root')!)
