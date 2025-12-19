import { Show, createSignal } from 'solid-js'
import { Card, CardBody, Button, FormField, Input, LinkButton, Alert } from '@mythweavers/ui'
import { Layout } from '../Layout'
import { authApi, ApiError } from '../../lib/api'
import * as pageStyles from '../../styles/pages.css'

export interface LoginPageProps {
  initialTheme?: 'chronicle' | 'starlight'
}

export const LoginPage = (props: LoginPageProps) => {
  const [username, setUsername] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [error, setError] = createSignal<string | null>(null)
  const [isLoading, setIsLoading] = createSignal(false)

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const usernameVal = username().trim()
      const passwordVal = password()

      if (!usernameVal || !passwordVal) {
        setError('Please fill in all fields')
        setIsLoading(false)
        return
      }

      await authApi.login(usernameVal, passwordVal)
      // Redirect on success
      window.location.href = '/'
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setError('Invalid email/username or password')
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
            <h1 class={pageStyles.pageTitle}>Sign In</h1>

            <Show when={error()}>
              <Alert variant="error">{error()}</Alert>
            </Show>

            <form onSubmit={handleSubmit}>
              <FormField label="Email or Username" class={pageStyles.formGroup}>
                <Input
                  id="username"
                  type="text"
                  name="username"
                  value={username()}
                  onInput={(e) => setUsername(e.currentTarget.value)}
                  disabled={isLoading()}
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
                />
              </FormField>

              <Button type="submit" variant="primary" fullWidth disabled={isLoading()}>
                {isLoading() ? 'Signing In...' : 'Sign In'}
              </Button>
            </form>

            <div class={pageStyles.formDivider}>
              <span class={pageStyles.formDividerLine} />
              <span>OR</span>
              <span class={pageStyles.formDividerLine} />
            </div>

            <div class={pageStyles.textCenter}>
              <p class={pageStyles.mb4}>Don't have an account?</p>
              <LinkButton href="/register" variant="secondary" fullWidth>
                Create Account
              </LinkButton>
            </div>
          </CardBody>
        </Card>
      </div>
    </Layout>
  )
}
