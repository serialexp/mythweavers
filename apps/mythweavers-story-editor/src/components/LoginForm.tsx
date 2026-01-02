import { Alert, Button, Card, CardBody, FormField, Input } from '@mythweavers/ui'
import { Component, Show, createSignal } from 'solid-js'
import { postAuthLogin, postAuthRegister } from '../client/config'
import { getApiBaseUrl } from '../client/config'
import { ForgotPassword } from './ForgotPassword'
import * as styles from './LoginForm.css'

interface LoginFormProps {
  onSuccess: (user: any | { offline: boolean }) => void
}

export const LoginForm: Component<LoginFormProps> = (props) => {
  const [isRegistering, setIsRegistering] = createSignal(false)
  const [showForgotPassword, setShowForgotPassword] = createSignal(false)
  const [email, setEmail] = createSignal('')
  const [username, setUsername] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [confirmPassword, setConfirmPassword] = createSignal('')
  const [error, setError] = createSignal('')
  const [isLoading, setIsLoading] = createSignal(false)
  const [showDebug, setShowDebug] = createSignal(false)
  const [debugInfo, setDebugInfo] = createSignal<any>(null)

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      if (isRegistering()) {
        if (!email() || !username() || !password()) {
          setError('All fields are required')
          setIsLoading(false)
          return
        }

        if (password().length < 8) {
          setError('Password must be at least 8 characters')
          setIsLoading(false)
          return
        }

        if (password() !== confirmPassword()) {
          setError('Passwords do not match')
          setIsLoading(false)
          return
        }

        const result = await postAuthRegister({
          body: {
            email: email(),
            username: username(),
            password: password(),
          },
        })

        if (result.data) {
          props.onSuccess(result.data.user)
        } else if (result.error) {
          setError(result.error.error || 'Registration failed')
        } else {
          setError('Registration failed - no response from server')
        }
      } else {
        if (!username() || !password()) {
          setError('Username and password are required')
          setIsLoading(false)
          return
        }

        let result: any
        let rawResponse: any

        // Also make a raw fetch call to see the actual response
        try {
          const apiUrl = getApiBaseUrl()
          const fetchResponse = await fetch(`${apiUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              username: username(),
              password: password(),
            }),
          })

          const responseText = await fetchResponse.text()
          rawResponse = {
            status: fetchResponse.status,
            statusText: fetchResponse.statusText,
            headers: {
              contentType: fetchResponse.headers.get('content-type'),
              contentLength: fetchResponse.headers.get('content-length'),
            },
            body: responseText,
            ok: fetchResponse.ok,
          }
          console.log('[LoginForm] Raw fetch response:', rawResponse)
        } catch (err) {
          console.error('[LoginForm] Raw fetch failed:', err)
          rawResponse = {
            error: 'Fetch failed',
            message: err instanceof Error ? err.message : String(err),
          }
        }

        try {
          result = await postAuthLogin({
            body: {
              username: username(),
              password: password(),
            },
          })
        } catch (err) {
          // If SDK throws, capture that too
          console.error('[LoginForm] SDK threw error:', err)
          setError('API call failed')
          setDebugInfo({
            apiUrl: getApiBaseUrl(),
            error: 'SDK threw exception',
            errorMessage: err instanceof Error ? err.message : String(err),
            rawFetch: rawResponse,
            timestamp: new Date().toISOString(),
          })
          throw err
        }

        console.log('[LoginForm] API Result:', { data: result.data, error: result.error, status: (result as any).status })

        if (result.data) {
          props.onSuccess(result.data.user)
        } else if (result.error) {
          const errorMsg = typeof result.error === 'object' ? result.error.error : result.error
          setError(errorMsg || 'Login failed')
          setDebugInfo({
            apiUrl: getApiBaseUrl(),
            errorObject: result.error,
            httpStatus: (result as any).status,
            fullResult: result,
            rawFetch: rawResponse,
            timestamp: new Date().toISOString(),
          })
        } else {
          setError('Login failed - no response from server')
          setDebugInfo({
            apiUrl: getApiBaseUrl(),
            error: 'No error or data returned',
            result: result,
            rawFetch: rawResponse,
            timestamp: new Date().toISOString(),
          })
        }
      }
    } catch (err) {
      console.error('Auth error:', err)

      // Provide more descriptive error messages based on error type
      if (err instanceof TypeError) {
        // Network error (e.g., CORS, connection refused, wrong URL)
        const errorMsg = err.message.toLowerCase()
        if (errorMsg.includes('fetch') || errorMsg.includes('network')) {
          setError('Cannot connect to server. Check the API URL and ensure the server is running.')
        } else if (errorMsg.includes('cors')) {
          setError('CORS error - the server rejected the request from this origin')
        } else {
          setError(`Connection error: ${err.message}`)
        }
      } else if (err instanceof Error) {
        setError(`Login error: ${err.message}`)
      } else {
        setError('An unexpected error occurred while logging in')
      }

      // Capture debug info
      setDebugInfo({
        apiUrl: getApiBaseUrl(),
        errorType: err instanceof Error ? err.constructor.name : typeof err,
        errorMessage: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      })
    } finally {
      setIsLoading(false)
    }
  }

  const switchMode = () => {
    setIsRegistering(!isRegistering())
    setError('')
    setEmail('')
    setUsername('')
    setPassword('')
    setConfirmPassword('')
  }

  return (
    <div class={styles.container}>
      <Card variant="elevated" style={{ width: '100%', 'max-width': '400px' }}>
        <CardBody padding="lg">
          <form onSubmit={handleSubmit} class={styles.form}>
            <h2 class={styles.title}>{isRegistering() ? 'Create Account' : 'Welcome Back'}</h2>

            <Show when={error()}>
              <Alert variant="error" style={{ 'margin-bottom': '1rem' }}>
                {error()}
              </Alert>
            </Show>

            <Show when={isRegistering()}>
              <FormField label="Email" required>
                <Input
                  type="email"
                  id="email"
                  value={email()}
                  onInput={(e) => setEmail(e.currentTarget.value)}
                  placeholder="you@example.com"
                  disabled={isLoading()}
                />
              </FormField>
            </Show>

            <FormField label={isRegistering() ? 'Username' : 'Username or Email'} required>
              <Input
                type="text"
                id="username"
                value={username()}
                onInput={(e) => setUsername(e.currentTarget.value)}
                placeholder={isRegistering() ? 'johndoe' : 'johndoe or you@example.com'}
                disabled={isLoading()}
              />
            </FormField>

            <FormField label="Password" required>
              <Input
                type="password"
                id="password"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                placeholder="••••••••"
                disabled={isLoading()}
              />
            </FormField>

            <Show when={isRegistering()}>
              <FormField label="Confirm Password" required>
                <Input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword()}
                  onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                  placeholder="••••••••"
                  disabled={isLoading()}
                />
              </FormField>
            </Show>

            <Button type="submit" variant="primary" fullWidth disabled={isLoading()}>
              {isLoading() ? 'Please wait...' : isRegistering() ? 'Register' : 'Login'}
            </Button>

            <Show when={!isRegistering()}>
              <div style={{ 'text-align': 'center', 'margin-top': '1rem' }}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowForgotPassword(true)}
                  disabled={isLoading()}
                >
                  Forgot Password?
                </Button>
              </div>
            </Show>

            <div class={styles.switchModeText}>
              {isRegistering() ? 'Already have an account?' : "Don't have an account?"}
              <Button type="button" variant="ghost" size="sm" onClick={switchMode} disabled={isLoading()}>
                {isRegistering() ? 'Login' : 'Register'}
              </Button>
            </div>

            <div class={styles.dividerContainer}>
              <div class={styles.dividerLine} />
              <span class={styles.dividerText}>OR</span>
            </div>

            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => props.onSuccess({ offline: true })}
              disabled={isLoading()}
            >
              Continue Offline
            </Button>

            <div style={{ 'margin-top': '1.5rem', 'border-top': '1px solid var(--border-color)', 'padding-top': '1rem' }}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowDebug(!showDebug())}
                style={{ width: '100%', 'text-align': 'center' }}
              >
                {showDebug() ? '▼ Hide' : '▶ Show'} Debug Info
              </Button>

              <Show when={showDebug()}>
                <div
                  style={{
                    'background-color': 'var(--bg-secondary)',
                    padding: '0.75rem',
                    'border-radius': '4px',
                    'margin-top': '0.5rem',
                    'font-family': 'monospace',
                    'font-size': '12px',
                    'white-space': 'pre-wrap',
                    'word-break': 'break-word',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <strong>API URL:</strong> {getApiBaseUrl()}
                  {debugInfo() ? (
                    <>
                      {debugInfo().httpStatus && (
                        <>
                          {'\n'}
                          <strong>HTTP Status:</strong> {debugInfo().httpStatus}
                        </>
                      )}
                      {debugInfo().errorObject && (
                        <>
                          {'\n\n'}
                          <strong>Server Error:</strong> {JSON.stringify(debugInfo().errorObject, null, 2)}
                        </>
                      )}
                      {debugInfo().rawFetch && (
                        <>
                          {'\n\n'}
                          <strong>Raw Fetch Response:</strong>
                          {'\n'}Status: {debugInfo().rawFetch.status} {debugInfo().rawFetch.statusText}
                          {'\n'}Content-Type: {debugInfo().rawFetch.headers?.contentType}
                          {debugInfo().rawFetch.body && (
                            <>
                              {'\n'}Body: {debugInfo().rawFetch.body}
                            </>
                          )}
                          {debugInfo().rawFetch.error && (
                            <>
                              {'\n'}Error: {debugInfo().rawFetch.error} - {debugInfo().rawFetch.message}
                            </>
                          )}
                        </>
                      )}
                      {debugInfo().fullResult && (
                        <>
                          {'\n\n'}
                          <strong>SDK Response:</strong> {JSON.stringify(debugInfo().fullResult, null, 2)}
                        </>
                      )}
                      {debugInfo().errorType && (
                        <>
                          {'\n\n'}
                          <strong>Error Type:</strong> {debugInfo().errorType}
                        </>
                      )}
                      {debugInfo().errorMessage && (
                        <>
                          {'\n'}
                          <strong>Message:</strong> {debugInfo().errorMessage}
                        </>
                      )}
                      {debugInfo().error && (
                        <>
                          {'\n'}
                          <strong>Error:</strong> {debugInfo().error}
                        </>
                      )}
                      {debugInfo().timestamp && (
                        <>
                          {'\n\n'}
                          <strong>Time:</strong> {debugInfo().timestamp}
                        </>
                      )}
                    </>
                  ) : (
                    <div style={{ 'margin-top': '0.5rem', color: 'var(--text-muted)' }}>
                      (Try logging in with wrong credentials to see error details)
                    </div>
                  )}
                </div>
              </Show>
            </div>
          </form>
        </CardBody>
      </Card>

      <Show when={showForgotPassword()}>
        <ForgotPassword
          onClose={() => setShowForgotPassword(false)}
          onBackToLogin={() => setShowForgotPassword(false)}
        />
      </Show>
    </div>
  )
}
