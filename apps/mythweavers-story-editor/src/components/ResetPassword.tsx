import { Alert, Button, FormField, Input, Modal, Spinner } from '@mythweavers/ui'
import { useSearchParams } from '@solidjs/router'
import { Show, createSignal, onMount } from 'solid-js'
import { apiClient } from '../utils/apiClient'

interface ResetPasswordProps {
  onClose: () => void
  onSuccess: () => void
}

export function ResetPassword(props: ResetPasswordProps) {
  const [searchParams] = useSearchParams()
  const [newPassword, setNewPassword] = createSignal('')
  const [confirmPassword, setConfirmPassword] = createSignal('')
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal('')
  const [validating, setValidating] = createSignal(true)
  const [tokenValid, setTokenValid] = createSignal(false)
  const [userInfo, setUserInfo] = createSignal<{ email: string; username: string } | null>(null)
  const [success, setSuccess] = createSignal(false)

  const getTitle = () => {
    if (validating()) return 'Validating...'
    if (!tokenValid()) return 'Invalid Reset Link'
    if (success()) return 'Password Reset Successful!'
    return 'Reset Password'
  }

  onMount(async () => {
    const token = Array.isArray(searchParams.token) ? searchParams.token[0] : searchParams.token
    if (!token) {
      setError('No reset token provided')
      setValidating(false)
      return
    }

    try {
      const result = await apiClient.validateResetToken(token)

      if (!result.valid) {
        throw new Error(result.error || 'Invalid token')
      }

      setTokenValid(true)
      setUserInfo({ email: result.email!, username: result.username! })
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
      const token = Array.isArray(searchParams.token) ? searchParams.token[0] : searchParams.token
      if (!token) {
        throw new Error('No reset token provided')
      }

      const result = await apiClient.resetPassword(token, newPassword())

      if (!result.success) {
        throw new Error(result.error || 'Failed to reset password')
      }

      setSuccess(true)
      // Wait a bit to show success message before redirecting
      setTimeout(() => {
        props.onSuccess()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={true} onClose={props.onClose} title={getTitle()} size="sm">
      <Show when={validating()}>
        <div style={{ 'text-align': 'center', padding: '2rem' }}>
          <Spinner size="lg" />
          <p style={{ color: 'var(--text-secondary)', 'margin-top': '1rem' }}>Validating reset token...</p>
        </div>
      </Show>

      <Show when={!validating() && !tokenValid()}>
        <div style={{ 'text-align': 'center' }}>
          <Alert variant="error" style={{ 'margin-bottom': '1.5rem' }}>
            {error()}
          </Alert>
          <Button onClick={props.onClose}>Back to Login</Button>
        </div>
      </Show>

      <Show when={!validating() && tokenValid() && !success()}>
        <form onSubmit={handleSubmit}>
          <Show when={userInfo()}>
            <p style={{ color: 'var(--text-secondary)', 'margin-bottom': '1.5rem' }}>
              Resetting password for: <strong style={{ color: 'var(--text-primary)' }}>{userInfo()!.username}</strong>
            </p>
          </Show>

          <Show when={error()}>
            <Alert variant="error" style={{ 'margin-bottom': '1rem' }}>
              {error()}
            </Alert>
          </Show>

          <FormField label="New Password" required>
            <Input
              type="password"
              id="newPassword"
              value={newPassword()}
              onInput={(e) => setNewPassword(e.currentTarget.value)}
              required
              disabled={loading()}
              placeholder="Enter new password (min. 8 characters)"
              minLength={8}
            />
          </FormField>

          <FormField label="Confirm Password" required>
            <Input
              type="password"
              id="confirmPassword"
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
        <div style={{ 'text-align': 'center', padding: '1rem 0' }}>
          <Alert variant="success" style={{ 'margin-bottom': '1rem' }}>
            Your password has been reset successfully.
          </Alert>
          <p style={{ color: 'var(--text-secondary)' }}>Redirecting to login page...</p>
        </div>
      </Show>
    </Modal>
  )
}
