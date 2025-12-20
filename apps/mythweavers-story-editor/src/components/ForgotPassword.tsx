import { Alert, Button, FormField, Input, Modal } from '@mythweavers/ui'
import { Show, createSignal } from 'solid-js'
import { apiClient } from '../utils/apiClient'
import * as styles from './ForgotPassword.css'

interface ForgotPasswordProps {
  onClose: () => void
  onBackToLogin: () => void
}

export function ForgotPassword(props: ForgotPasswordProps) {
  const [email, setEmail] = createSignal('')
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal('')
  const [success, setSuccess] = createSignal(false)

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await apiClient.requestPasswordReset(email())

      if (!result.success) {
        throw new Error(result.error || 'Failed to request password reset')
      }

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={true} onClose={props.onClose} title={success() ? 'Check Your Email' : 'Forgot Password'} size="sm">
      <Show
        when={!success()}
        fallback={
          <div style={{ 'text-align': 'center' }}>
            <Alert variant="success" style={{ 'margin-bottom': '1rem' }}>
              If an account exists with the email address you provided, we've sent password reset instructions to that
              email.
            </Alert>
            <p class={styles.description}>Please check your inbox and follow the link to reset your password.</p>
            <Button onClick={props.onBackToLogin}>Back to Login</Button>
          </div>
        }
      >
        <form onSubmit={handleSubmit}>
          <p class={styles.description}>
            Enter your email address and we'll send you a link to reset your password.
          </p>

          <Show when={error()}>
            <Alert variant="error" style={{ 'margin-bottom': '1rem' }}>
              {error()}
            </Alert>
          </Show>

          <FormField label="Email" required>
            <Input
              type="email"
              id="email"
              value={email()}
              onInput={(e) => setEmail(e.currentTarget.value)}
              required
              disabled={loading()}
              placeholder="Enter your email"
            />
          </FormField>

          <Button type="submit" fullWidth disabled={loading() || !email()} style={{ 'margin-bottom': '0.5rem' }}>
            {loading() ? 'Sending...' : 'Send Reset Link'}
          </Button>

          <Button type="button" variant="ghost" fullWidth onClick={props.onBackToLogin}>
            Back to Login
          </Button>
        </form>
      </Show>
    </Modal>
  )
}
