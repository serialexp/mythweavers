/**
 * OAuth consent screen.
 *
 * The backend's GET /oauth/authorize validates the request, stores it, and
 * bounces the browser here with a request_id. Everything the user needs to
 * judge the request comes from GET /oauth/consent/:requestId — in particular
 * the redirect URI, which is how someone tells "my own CLI on localhost" from
 * an attacker's server.
 *
 * On a decision the backend returns a redirect_to rather than a 302, because
 * this submit is a cross-origin fetch: a 302 would be followed transparently
 * and turn the client's callback into a CORS request, which fails after the
 * code has already been spent.
 */

import { Alert, Button, Card, CardBody, CardDescription, CardTitle, Container, Stack, Text } from '@mythweavers/ui'
import { useNavigate, useSearchParams } from '@solidjs/router'
import { For, Show, createResource, createSignal } from 'solid-js'
import { getOauthConsentByRequestId, postOauthConsentByRequestId } from '../client/config'
import { authStore } from '../stores/authStore'
import * as styles from './OAuthConsentPage.css'

export default function OAuthConsentPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = createSignal<string>()
  const [submitting, setSubmitting] = createSignal<'approve' | 'deny'>()

  const requestId = () => (typeof params.request_id === 'string' ? params.request_id : '')

  const loginUrl = () => `/login?redirect=${encodeURIComponent(`/oauth/consent?request_id=${requestId()}`)}`

  // Only fetch once the session is known to be good: the endpoint is
  // cookie-authenticated, and a 401 here would look like an expired request.
  const [request] = createResource(
    () => (authStore.isAuthenticated && requestId() ? requestId() : null),
    async (id: string) => {
      const { data } = await getOauthConsentByRequestId({ path: { requestId: id } })
      return data ?? null
    },
  )

  const decide = async (decision: 'approve' | 'deny') => {
    setError()
    setSubmitting(decision)
    try {
      const { data } = await postOauthConsentByRequestId({
        path: { requestId: requestId() },
        body: { decision },
      })
      if (!data?.redirect_to) {
        setError('The authorization server did not return a destination. Start over from your app.')
        return
      }
      // A full navigation, not a router navigate: the destination belongs to
      // the client app (usually a loopback URL), not to this SPA.
      window.location.href = data.redirect_to
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to record your decision')
    } finally {
      setSubmitting()
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
              Authorize access
            </CardTitle>
            <CardDescription>An application is asking to use your MythWeavers account.</CardDescription>
          </Stack>

          <Show
            when={requestId()}
            fallback={
              <Alert variant="error" title="Missing request">
                This page was opened without an authorization request. Start again from the application you are
                connecting.
              </Alert>
            }
          >
            <Show when={!authStore.isLoading} fallback={<Text color="muted">Checking your session…</Text>}>
              <Show
                when={authStore.isAuthenticated && !authStore.isOfflineMode}
                fallback={
                  <Stack gap="md">
                    <Alert variant="info" title="Sign in required">
                      Sign in to your MythWeavers account to review this request.
                    </Alert>
                    <Button variant="primary" fullWidth onClick={() => navigate(loginUrl())}>
                      Sign in
                    </Button>
                  </Stack>
                }
              >
                <Show when={!request.loading} fallback={<Text color="muted">Loading request…</Text>}>
                  <Show
                    when={request()}
                    fallback={
                      <Alert variant="error" title="Request unavailable">
                        This authorization request has expired or was already answered. Start again from the application
                        you are connecting.
                      </Alert>
                    }
                  >
                    {(details) => (
                      <Stack gap="lg">
                        <Stack gap="xs">
                          <Text weight="semibold" size="lg">
                            {details().client_name}
                          </Text>
                          <Text color="muted" size="sm">
                            wants to access your account as {authStore.user?.username ?? 'you'}
                          </Text>
                        </Stack>

                        <Stack gap="sm">
                          <Text weight="semibold" size="sm">
                            It will be able to:
                          </Text>
                          <ul class={styles.scopeList}>
                            <For each={details().scopes}>
                              {(scope) => (
                                <li class={styles.scopeItem}>
                                  <span class={styles.scopeDescription}>{scope.description}</span>
                                  <code class={styles.scopeCode}>{scope.scope}</code>
                                </li>
                              )}
                            </For>
                          </ul>
                        </Stack>

                        {/* The redirect URI is the user's only real evidence about
                            who they are talking to — show it verbatim. */}
                        <Stack gap="xs">
                          <Text weight="semibold" size="sm">
                            Tokens will be sent to:
                          </Text>
                          <code class={styles.redirectUri}>{details().redirect_uri}</code>
                          <Text color="muted" size="sm">
                            Only approve if you recognise this address. A local address means an app running on this
                            computer.
                          </Text>
                        </Stack>

                        <Stack direction="horizontal" gap="md">
                          <Button
                            variant="ghost"
                            fullWidth
                            disabled={submitting() !== undefined}
                            onClick={() => decide('deny')}
                          >
                            {submitting() === 'deny' ? 'Cancelling…' : 'Cancel'}
                          </Button>
                          <Button
                            variant="primary"
                            fullWidth
                            disabled={submitting() !== undefined}
                            onClick={() => decide('approve')}
                          >
                            {submitting() === 'approve' ? 'Authorizing…' : 'Authorize'}
                          </Button>
                        </Stack>
                      </Stack>
                    )}
                  </Show>
                </Show>
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
        </CardBody>
      </Card>
    </Container>
  )
}
