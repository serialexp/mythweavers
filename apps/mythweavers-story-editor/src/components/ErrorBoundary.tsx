import { Component, ErrorBoundary, JSX } from 'solid-js'

interface ErrorBoundaryProps {
  children: JSX.Element
}

export const AppErrorBoundary: Component<ErrorBoundaryProps> = (props) => {
  console.log('AppErrorBoundary rendering...')
  return (
    <ErrorBoundary
      fallback={(err, reset) => {
        console.error('ErrorBoundary caught error:', err)
        console.error('ErrorBoundary fallback rendering...')

        // Store error globally so the render check timeout can access it
        ;(window as any).__lastRenderError = err

        // Log to DOM to verify it's actually rendering
        setTimeout(() => {
          console.error('Checking if error UI is in DOM...')
          const errorDivs = document.querySelectorAll('[data-error-boundary]')
          console.error('Found error boundary divs:', errorDivs.length)
        }, 100)

        return (
          <div
            data-error-boundary="true"
            style={{
              position: 'fixed',
              top: '0',
              left: '0',
              right: '0',
              bottom: '0',
              padding: '20px',
              'background-color': 'rgba(0,0,0,0.9)',
              color: '#ff6b6b',
              'font-family': 'monospace',
              'font-size': '14px',
              overflow: 'auto',
              'z-index': '999999',
            }}
          >
            <h2 style={{ color: '#ff6b6b', 'margin-bottom': '20px' }}>⚠️ Application Error (ErrorBoundary)</h2>
            <div style={{ background: '#1a1a1a', padding: '15px', 'border-radius': '5px', 'margin-bottom': '15px' }}>
              <strong>Message:</strong>
              <pre style={{ 'white-space': 'pre-wrap', 'word-break': 'break-word', 'margin-top': '10px' }}>
                {err.toString()}
              </pre>
            </div>
            <details style={{ 'margin-top': '10px' }}>
              <summary style={{ cursor: 'pointer', 'margin-bottom': '10px' }}>Stack Trace</summary>
              <div style={{ background: '#1a1a1a', padding: '15px', 'border-radius': '5px' }}>
                <pre
                  style={{
                    'white-space': 'pre-wrap',
                    'word-break': 'break-word',
                    'font-size': '0.8em',
                    color: '#ffa94d',
                  }}
                >
                  {err.stack}
                </pre>
              </div>
            </details>
            <div style={{ 'margin-top': '20px', display: 'flex', gap: '10px' }}>
              <button
                onClick={reset}
                style={{
                  padding: '10px 20px',
                  'background-color': '#ff6b6b',
                  color: 'white',
                  border: 'none',
                  'border-radius': '5px',
                  cursor: 'pointer',
                  'font-size': '14px',
                }}
              >
                Try Again
              </button>
              <button
                onClick={() => {
                  const errorDiv = document.querySelector('[data-error-boundary]')
                  if (errorDiv) {
                    ;(errorDiv as HTMLElement).style.display = 'none'
                  }
                }}
                style={{
                  padding: '10px 20px',
                  'background-color': '#868e96',
                  color: 'white',
                  border: 'none',
                  'border-radius': '5px',
                  cursor: 'pointer',
                  'font-size': '14px',
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )
      }}
    >
      {props.children}
    </ErrorBoundary>
  )
}
