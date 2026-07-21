import {
  Alert,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardTitle,
  Container,
  FormField,
  Input,
  Stack,
  Text,
} from '@mythweavers/ui'
import { useNavigate, useSearchParams } from '@solidjs/router'
import { Show, createSignal } from 'solid-js'
import { postOauthApprove } from '../client/config'
import { authStore } from '../stores/authStore'

export default function DeviceAuthorizationPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [code, setCode] = createSignal(typeof params.code === 'string' ? params.code : '')
  const [message, setMessage] = createSignal<string>()
  const [error, setError] = createSignal<string>()
  const [isSubmitting, setIsSubmitting] = createSignal(false)

  const loginUrl = () => `/login?redirect=${encodeURIComponent(`/device?code=${code()}`)}`

  const authorize = async (event: SubmitEvent) => {
    event.preventDefault()
    setError()
    setMessage()
    setIsSubmitting(true)

    try {
      const { error: responseError } = await postOauthApprove({ body: { user_code: code() } })
      if (responseError) {
        setError(responseError.error)
        return
      }
      setMessage('Device authorized. You can close this page and return to the CLI.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to authorize the CLI')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Container
      size="sm"
      padding="lg"
      center
      style={{ 'min-height': '100vh', display: 'flex', 'align-items': 'center', 'justify-content': 'center' }}
    >
      <Card variant="elevated" size="full">
        <CardBody padding="lg" gap="lg">
          <Stack gap="sm">
            <CardTitle as="h1" size="lg">
              Authorize MythWeavers CLI
            </CardTitle>
            <CardDescription>
              {message()
                ? 'Authorization completed successfully.'
                : 'Confirm the code below to give the command-line app access to your MythWeavers account.'}
            </CardDescription>
          </Stack>

          <Show when={!authStore.isLoading} fallback={<Text color="muted">Checking your session…</Text>}>
            <Show
              when={authStore.isAuthenticated && !authStore.isOfflineMode}
              fallback={
                <Stack gap="md">
                  <Alert variant="info" title="Sign in required">
                    Sign in to your MythWeavers account before authorizing this device.
                  </Alert>
                  <Button variant="primary" fullWidth onClick={() => navigate(loginUrl())}>
                    Sign in
                  </Button>
                </Stack>
              }
            >
              <Show
                when={message()}
                fallback={
                  <form onSubmit={authorize}>
                    <Stack gap="md">
                      <FormField
                        id="device-code"
                        label="Authorization code"
                        required
                        helpText="This code should match the one shown by the CLI."
                      >
                        <Input
                          id="device-code"
                          size="lg"
                          value={code()}
                          onInput={(event) => setCode(event.currentTarget.value.toUpperCase())}
                          autocomplete="one-time-code"
                          required
                        />
                      </FormField>
                      <Button type="submit" variant="primary" size="lg" fullWidth disabled={isSubmitting()}>
                        {isSubmitting() ? 'Authorizing…' : 'Authorize CLI'}
                      </Button>
                    </Stack>
                  </form>
                }
              >
                {(value) => (
                  <Alert variant="success" title="Authorized">
                    {value()}
                  </Alert>
                )}
              </Show>
            </Show>
          </Show>

          <Show when={error()}>
            {(value) => (
              <Alert variant="error" title="Authorization failed">
                {value()}
              </Alert>
            )}
          </Show>

          <Button type="button" variant="ghost" fullWidth onClick={() => window.close()}>
            Close window
          </Button>
        </CardBody>
      </Card>
    </Container>
  )
}
