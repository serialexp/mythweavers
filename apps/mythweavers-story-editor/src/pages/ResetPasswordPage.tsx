import { Alert, Button, Card, CardBody, CardTitle, FormField, Input, Spinner } from '@mythweavers/ui'
import { useNavigate, useSearchParams } from '@solidjs/router'
import { Component, Show, createSignal, onMount } from 'solid-js'

export const ResetPasswordPage: Component = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [newPassword, setNewPassword] = createSignal('')
  const [confirmPassword, setConfirmPassword] = createSignal('')
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal('')
  const [validating, setValidating] = createSignal(true)
  const [tokenValid, setTokenValid] = createSignal(false)
  const [userInfo, setUserInfo] = createSignal<{ email: string; username: string } | null>(null)
  const [success, setSuccess] = createSignal(false)

  onMount(async () => {
    const token = searchParams.token
    if (!token) {
      setError('No reset token provided')
      setValidating(false)
      return
    }

    try {
      const response = await fetch(`http://localhost:3001/auth/validate-reset-token/${token}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Invalid token')
      }

      setTokenValid(true)
      setUserInfo({ email: data.email, username: data.username })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired token')
    } finally {
      setValidating(false)
    }
  })

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setError('')

    if (newPassword() !== confirmPassword()) {
      setError('Passwords do not match')
      return
    }

    if (newPassword().length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    setLoading(true)

    try {
      const token = searchParams.token
      const response = await fetch('http://localhost:3001/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          newPassword: newPassword(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password')
      }

      setSuccess(true)
      // Redirect to home page after 3 seconds
      setTimeout(() => {
        navigate('/')
      }, 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
        'min-height': '100vh',
        background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%)',
        padding: '1rem',
      }}
    >
      <Card style={{ width: '100%', 'max-width': '400px' }}>
        <CardBody gap="md">
          <Show when={validating()}>
            <div style={{ 'text-align': 'center', padding: '2rem' }}>
              <Spinner size="md" />
              <p style={{ 'margin-top': '1rem', color: 'var(--text-secondary)' }}>Validating reset token...</p>
            </div>
          </Show>

          <Show when={!validating() && !tokenValid()}>
            <div style={{ 'text-align': 'center' }}>
              <CardTitle as="h2" style={{ color: 'var(--danger-color)', 'margin-bottom': '1rem' }}>
                Invalid Reset Link
              </CardTitle>
              <p style={{ color: 'var(--text-secondary)', 'margin-bottom': '1.5rem' }}>{error()}</p>
              <Button onClick={() => navigate('/')}>Back to Home</Button>
            </div>
          </Show>

          <Show when={!validating() && tokenValid() && !success()}>
            <form onSubmit={handleSubmit}>
              <CardTitle as="h2" style={{ 'margin-bottom': '0.5rem' }}>
                Reset Password
              </CardTitle>

              <Show when={userInfo()}>
                <p
                  style={{
                    color: 'var(--text-secondary)',
                    'margin-bottom': '1.5rem',
                    'font-size': '0.9rem',
                  }}
                >
                  Resetting password for:{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>{userInfo()!.username}</strong>
                </p>
              </Show>

              <Show when={error()}>
                <Alert variant="error" style={{ 'margin-bottom': '1rem' }}>
                  {error()}
                </Alert>
              </Show>

              <FormField label="New Password" style={{ 'margin-bottom': '1rem' }}>
                <Input
                  type="password"
                  value={newPassword()}
                  onInput={(e) => setNewPassword(e.currentTarget.value)}
                  required
                  disabled={loading()}
                  placeholder="Enter new password (min. 8 characters)"
                />
              </FormField>

              <FormField label="Confirm Password" style={{ 'margin-bottom': '1.5rem' }}>
                <Input
                  type="password"
                  value={confirmPassword()}
                  onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                  required
                  disabled={loading()}
                  placeholder="Confirm new password"
                />
              </FormField>

              <Button type="submit" fullWidth disabled={loading() || !newPassword() || !confirmPassword()}>
                {loading() ? 'Resetting...' : 'Reset Password'}
              </Button>
            </form>
          </Show>

          <Show when={success()}>
            <div style={{ 'text-align': 'center' }}>
              <CardTitle as="h2" style={{ color: 'var(--success-color)', 'margin-bottom': '1rem' }}>
                Password Reset Successful!
              </CardTitle>
              <p style={{ color: 'var(--text-secondary)' }}>
                Your password has been reset successfully. Redirecting to home page...
              </p>
            </div>
          </Show>
        </CardBody>
      </Card>
    </div>
  )
}
