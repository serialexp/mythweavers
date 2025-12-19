import { Show, createSignal } from 'solid-js'
import { Card, CardBody, Button, FormField, Input, LinkButton, Alert } from '@mythweavers/ui'
import { Layout } from '../Layout'
import { authApi, ApiError } from '../../lib/api'
import * as pageStyles from '../../styles/pages.css'

export interface RegisterPageProps {
  initialTheme?: 'chronicle' | 'starlight'
}

export const RegisterPage = (props: RegisterPageProps) => {
  const [username, setUsername] = createSignal('')
  const [email, setEmail] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [error, setError] = createSignal<string | null>(null)
  const [isLoading, setIsLoading] = createSignal(false)

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const usernameVal = username().trim()
      const emailVal = email().trim()
      const passwordVal = password()

      if (!usernameVal || !emailVal || !passwordVal) {
        setError('Please fill in all fields')
        setIsLoading(false)
        return
      }

      await authApi.register(emailVal, usernameVal, passwordVal)
      // Redirect on success
      window.location.href = '/'
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setError('Username or email already taken')
        } else {
          setError(err.message)
        }
      } else {
        setError('An error occurred. Please try again.')
      }
      setIsLoading(false)
    }
  }

  return (
    <Layout initialTheme={props.initialTheme}>
      <div class={pageStyles.pageContainer}>
        <Card size="sm">
          <CardBody padding="lg" gap="md">
            <h1 class={pageStyles.pageTitle}>Create Account</h1>

            <Show when={error()}>
              <Alert variant="error">{error()}</Alert>
            </Show>

            <form onSubmit={handleSubmit}>
              <FormField label="Username" class={pageStyles.formGroup}>
                <Input
                  id="username"
                  type="text"
                  name="username"
                  value={username()}
                  onInput={(e) => setUsername(e.currentTarget.value)}
                  disabled={isLoading()}
                  required
                />
              </FormField>

              <FormField label="Email" class={pageStyles.formGroup}>
                <Input
                  id="email"
                  type="email"
                  name="email"
                  value={email()}
                  onInput={(e) => setEmail(e.currentTarget.value)}
                  disabled={isLoading()}
                  required
                />
              </FormField>

              <FormField label="Password" class={pageStyles.formGroup}>
                <Input
                  id="password"
                  type="password"
                  name="password"
                  value={password()}
                  onInput={(e) => setPassword(e.currentTarget.value)}
                  disabled={isLoading()}
                  required
                />
              </FormField>

              <Button type="submit" variant="primary" fullWidth disabled={isLoading()}>
                {isLoading() ? 'Creating Account...' : 'Create Account'}
              </Button>
            </form>

            <div class={pageStyles.formDivider}>
              <span class={pageStyles.formDividerLine} />
              <span>OR</span>
              <span class={pageStyles.formDividerLine} />
            </div>

            <div class={pageStyles.textCenter}>
              <p class={pageStyles.mb4}>Already have an account?</p>
              <LinkButton href="/login" variant="secondary" fullWidth>
                Sign In
              </LinkButton>
            </div>
          </CardBody>
        </Card>
      </div>
    </Layout>
  )
}
