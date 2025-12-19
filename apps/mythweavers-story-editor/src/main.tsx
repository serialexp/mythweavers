import { ThemeProvider } from '@mythweavers/ui'
import { Router } from '@solidjs/router'
import { render } from 'solid-js/web'
import App from './App.tsx'
import { AppErrorBoundary } from './components/ErrorBoundary.tsx'
import { initializeClientLogger } from './utils/clientLogger.ts'
import './index.css'
import './styles/variables.css'

// Initialize client logger to send logs to server
initializeClientLogger()

// Reusable error overlay function
function showErrorOverlay(title: string, sections: Array<{ label?: string; content: string; isStack?: boolean }>) {
  const errorDiv = document.createElement('div')
  errorDiv.style.cssText =
    'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.9); color: #ff6b6b; padding: 20px; font-family: monospace; font-size: 14px; overflow: auto; z-index: 999999;'

  const sectionsHtml = sections
    .map((section) => {
      if (section.isStack && section.content) {
        return `
        <details style="margin-bottom: 15px;">
          <summary style="cursor: pointer; color: #ffa94d; margin-bottom: 10px;">${section.label || 'Stack Trace'}</summary>
          <div style="background: #1a1a1a; padding: 15px; border-radius: 5px;">
            <pre style="white-space: pre-wrap; font-size: 12px; color: #ffa94d;">${section.content}</pre>
          </div>
        </details>
      `
      }
      if (section.content) {
        return `
        <div style="background: #1a1a1a; padding: 15px; border-radius: 5px; margin-bottom: 15px;">
          ${section.label ? `<strong>${section.label}:</strong> ` : ''}${section.content}
        </div>
      `
      }
      return ''
    })
    .join('')

  errorDiv.innerHTML = `
    <h1 style="color: #ff6b6b; margin-bottom: 20px;">⚠️ ${title}</h1>
    ${sectionsHtml}
    <div style="margin-top: 20px; display: flex; gap: 10px;">
      <button onclick="location.reload()" style="padding: 10px 20px; background: #ff6b6b; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px;">
        Reload Page
      </button>
      <button onclick="this.parentElement.parentElement.remove()" style="padding: 10px 20px; background: #868e96; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px;">
        Dismiss
      </button>
    </div>
  `
  document.body.appendChild(errorDiv)
}

// Add global error handler to catch uncaught errors
window.addEventListener('error', (event) => {
  console.error('[Global Error Handler] Uncaught error:', event.error)
  console.error('[Global Error Handler] Stack:', event.error?.stack)
  console.error('[Global Error Handler] Message:', event.message)
  console.error('[Global Error Handler] Filename:', event.filename)
  console.error('[Global Error Handler] Line:', event.lineno, 'Column:', event.colno)

  // Ignore useless "Script error" messages from cross-origin scripts
  if (event.message === 'Script error.' && !event.error?.stack && (!event.filename || event.filename === '')) {
    console.warn('[Global Error Handler] Ignoring useless cross-origin script error')
    event.preventDefault()
    return true
  }

  const sections: Array<{ label?: string; content: string; isStack?: boolean }> = [
    { label: 'Message', content: event.message || 'Unknown error' },
    { label: 'Location', content: `${event.filename || 'Unknown'}:${event.lineno || '?'}:${event.colno || '?'}` },
  ]

  if (event.error?.stack) {
    sections.push({ label: 'Stack Trace', content: event.error.stack, isStack: true })
  }

  showErrorOverlay('Application Error', sections)

  // Prevent default behavior which might cause reload
  event.preventDefault()
  return true
})

// Add unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Global Promise Handler] Unhandled rejection:', event.reason)
  console.error('[Global Promise Handler] Stack:', event.reason?.stack)

  const sections: Array<{ label?: string; content: string; isStack?: boolean }> = [
    { label: 'Reason', content: event.reason?.message || String(event.reason) || 'Unknown' },
  ]

  if (event.reason?.stack) {
    sections.push({ label: 'Stack Trace', content: event.reason.stack, isStack: true })
  }

  showErrorOverlay('Unhandled Promise Rejection', sections)

  // Prevent default behavior
  event.preventDefault()
})

// Log that we're starting the app
console.log('Starting Story App...')

// Debug: Test if console.log was overridden
console.log('This should be sent to server if logger is working')

// Unregister any existing service workers
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister()
      console.log('Unregistered service worker:', registration.scope)
    }
  })
}

console.log('About to render app...')

// Fallback: Check if anything rendered after 500ms
const renderCheck = setTimeout(() => {
  const root = document.getElementById('root')
  if (!root || root.children.length === 0 || root.textContent?.trim() === '') {
    console.error('RENDER CHECK: Nothing rendered after 500ms!')

    // Get the error if it was stored by ErrorBoundary
    const error = (window as any).__lastRenderError

    const sections: Array<{ label?: string; content: string; isStack?: boolean }> = [
      {
        content:
          '<strong>The application failed to render.</strong><br/><p style="margin-top: 10px; color: #ffa94d;">The ErrorBoundary caught an error but failed to display the fallback UI.</p>',
      },
    ]

    if (error) {
      sections.push({
        label: 'Error Message',
        content: `<pre style="white-space: pre-wrap; margin-top: 10px; color: #fff;">${error.message || error.toString()}</pre>`,
      })
      if (error.stack) {
        sections.push({ label: 'Stack Trace', content: error.stack, isStack: true })
      }
    } else {
      sections.push({
        content: '<p>No error details available. Check the browser console for more information.</p>',
      })
    }

    showErrorOverlay('Application Error', sections)
  } else {
    console.log('RENDER CHECK: Content rendered successfully')
  }
}, 500)

try {
  render(() => {
    console.log('Inside render function...')
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
  console.log('Render completed')
} catch (error) {
  clearTimeout(renderCheck) // Cancel the check if we caught error immediately
  console.error('CAUGHT ERROR IN RENDER:', error)

  const sections: Array<{ label?: string; content: string; isStack?: boolean }> = [
    { label: 'Message', content: error instanceof Error ? error.message : String(error) },
  ]

  if (error instanceof Error && error.stack) {
    sections.push({ label: 'Stack Trace', content: error.stack, isStack: true })
  }

  showErrorOverlay('Render Error', sections)
}
