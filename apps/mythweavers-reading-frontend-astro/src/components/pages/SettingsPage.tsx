import { Show, createSignal } from 'solid-js'
import { Button, Card, CardBody, CardTitle, LinkButton } from '@mythweavers/ui'
import { Layout } from '../Layout'
import { ApiError, settingsApi, type User } from '../../lib/api'
import * as pageStyles from '../../styles/pages.css'

export interface SettingsPageProps {
  user: User | null
  initialTheme?: 'chronicle' | 'starlight'
}

export const SettingsPage = (props: SettingsPageProps) => {
  const [currentPassword, setCurrentPassword] = createSignal('')
  const [newPassword, setNewPassword] = createSignal('')
  const [confirmPassword, setConfirmPassword] = createSignal('')
  const [error, setError] = createSignal<string | null>(null)
  const [success, setSuccess] = createSignal<string | null>(null)
  const [submitting, setSubmitting] = createSignal(false)

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (newPassword().length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }
    if (newPassword() !== confirmPassword()) {
      setError('New password and confirmation do not match.')
      return
    }

    setSubmitting(true)
    try {
      await settingsApi.changePassword(currentPassword(), newPassword())
      setSuccess('Password updated.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.status === 401 ? 'Current password is incorrect.' : err.message)
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle = {
    padding: '0.5rem 0.75rem',
    'border-radius': '6px',
    border: '1px solid var(--color-border-default__1wxbrr2j)',
    'background-color': 'var(--color-bg-elevated__1wxbrr2c)',
    color: 'var(--color-text-primary__1wxbrr27)',
    width: '100%',
  } as const

  return (
    <Layout initialTheme={props.initialTheme} user={props.user}>
      <div class={pageStyles.pageContainer}>
        <Card>
          <CardBody padding="lg" gap="md">
            <CardTitle size="lg">Settings</CardTitle>

            <Show
              when={props.user}
              fallback={
                <div>
                  <p class={pageStyles.textSecondary}>You need to log in to manage your settings.</p>
                  <LinkButton href="/login" variant="primary">
                    Log in
                  </LinkButton>
                </div>
              }
            >
              <div>
                <h2 class={pageStyles.sectionTitle}>Change password</h2>
                <form
                  onSubmit={handleSubmit}
                  style={{
                    display: 'flex',
                    'flex-direction': 'column',
                    gap: '0.75rem',
                    'max-width': '420px',
                  }}
                >
                  <label style={{ display: 'flex', 'flex-direction': 'column', gap: '0.25rem' }}>
                    <span class={pageStyles.textSecondary} style={{ 'font-size': '0.85rem' }}>
                      Current password
                    </span>
                    <input
                      type="password"
                      value={currentPassword()}
                      onInput={(e) => setCurrentPassword(e.currentTarget.value)}
                      required
                      style={inputStyle}
                    />
                  </label>
                  <label style={{ display: 'flex', 'flex-direction': 'column', gap: '0.25rem' }}>
                    <span class={pageStyles.textSecondary} style={{ 'font-size': '0.85rem' }}>
                      New password (min 8 chars)
                    </span>
                    <input
                      type="password"
                      value={newPassword()}
                      onInput={(e) => setNewPassword(e.currentTarget.value)}
                      required
                      minLength={8}
                      style={inputStyle}
                    />
                  </label>
                  <label style={{ display: 'flex', 'flex-direction': 'column', gap: '0.25rem' }}>
                    <span class={pageStyles.textSecondary} style={{ 'font-size': '0.85rem' }}>
                      Confirm new password
                    </span>
                    <input
                      type="password"
                      value={confirmPassword()}
                      onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                      required
                      style={inputStyle}
                    />
                  </label>

                  <Show when={error()}>
                    <p style={{ color: 'var(--color-text-danger__1wxbrr2b)', margin: 0 }}>{error()}</p>
                  </Show>
                  <Show when={success()}>
                    <p style={{ color: 'var(--color-text-success__1wxbrr2a)', margin: 0 }}>{success()}</p>
                  </Show>

                  <Button type="submit" variant="primary" disabled={submitting()}>
                    {submitting() ? 'Updating…' : 'Update password'}
                  </Button>
                </form>
              </div>
            </Show>
          </CardBody>
        </Card>
      </div>
    </Layout>
  )
}
