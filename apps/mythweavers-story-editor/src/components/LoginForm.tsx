import { Alert, Button, Card, CardBody, FormField, Input } from '@mythweavers/ui'
import { Component, Show, createSignal } from 'solid-js'
import { postAuthLogin, postAuthRegister } from '../client/config'
import { ForgotPassword } from './ForgotPassword'

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
          setError('Registration failed')
        }
      } else {
        if (!username() || !password()) {
          setError('Username and password are required')
          setIsLoading(false)
          return
        }

        const result = await postAuthLogin({
          body: {
            username: username(),
            password: password(),
          },
        })

        if (result.data) {
          props.onSuccess(result.data.user)
        } else if (result.error) {
          setError(result.error.error || 'Login failed')
        } else {
          setError('Login failed')
        }
      }
    } catch (err) {
      console.error('Auth error:', err)
      setError('An unexpected error occurred')
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
    <div
      style={{
        display: 'flex',
        'flex-direction': 'column',
        'align-items': 'center',
        'justify-content': 'center',
        'min-height': '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Card variant="elevated" style={{ width: '100%', 'max-width': '400px' }}>
        <CardBody padding="lg">
          <form onSubmit={handleSubmit}>
            <h2
              style={{
                'text-align': 'center',
                'margin-bottom': '2rem',
                color: 'var(--text-primary)',
                'font-size': '1.5rem',
              }}
            >
              {isRegistering() ? 'Create Account' : 'Welcome Back'}
            </h2>

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

            <div
              style={{
                'text-align': 'center',
                'margin-top': '1rem',
                color: 'var(--text-secondary)',
                display: 'flex',
                'align-items': 'center',
                'justify-content': 'center',
                gap: '0.25rem',
              }}
            >
              {isRegistering() ? 'Already have an account?' : "Don't have an account?"}
              <Button type="button" variant="ghost" size="sm" onClick={switchMode} disabled={isLoading()}>
                {isRegistering() ? 'Login' : 'Register'}
              </Button>
            </div>

            <div
              style={{
                position: 'relative',
                'text-align': 'center',
                margin: '1.5rem 0',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '0',
                  right: '0',
                  height: '1px',
                  background: 'var(--border-color)',
                }}
              />
              <span
                style={{
                  background: 'var(--bg-primary)',
                  padding: '0 1rem',
                  position: 'relative',
                  color: 'var(--text-muted)',
                  'font-size': '0.875rem',
                }}
              >
                OR
              </span>
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
