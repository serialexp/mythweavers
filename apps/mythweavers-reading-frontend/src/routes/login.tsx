import { Alert, Button, Card, CardBody, FormField, Input, LinkButton } from '@mythweavers/ui'
import { Meta, Title } from '@solidjs/meta'
import { action, redirect, useSubmission } from '@solidjs/router'
import { Show, createSignal } from 'solid-js'
import { Layout } from '~/components/Layout'
import { authApi } from '~/lib/api'
import { createUserSession } from '~/lib/session'
import * as pageStyles from '~/styles/pages.css'

const loginAction = action(async (formData: FormData) => {
  'use server'

  try {
    const result = await authApi.login(formData.get('email') as string, formData.get('password') as string)

    if (result?.success && result.user) {
      await createUserSession(
        {
          id: result.user.id.toString(),
          name: result.user.username,
          email: result.user.email,
        },
        '/',
      )
    }
    return redirect('/')
  } catch (error: unknown) {
    console.error('Login action error:', error)
    if (error instanceof Response && error.status === 302) {
      throw error
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An error occurred during login.',
    }
  }
}, 'loginUser')

export default function Login() {
  const submission = useSubmission(loginAction)
  const [localError, _setLocalError] = createSignal<string | null>(null)

  return (
    <Layout>
      <Title>MythWeavers - Sign In</Title>
      <Meta name="description" content="Sign in to your MythWeavers account" />

      <div class={pageStyles.pageContainer}>
        <Card size="sm">
          <CardBody padding="lg" gap="md">
            <h1 class={pageStyles.pageTitle}>Sign In</h1>

            <Show when={localError() || submission.result?.error}>
              <Alert variant="error">
                {localError() || submission.result?.error}
              </Alert>
            </Show>

            <form action={loginAction} method="post">
              <FormField label="Email or Username" class={pageStyles.formGroup}>
                <Input id="email" type="text" name="email" />
              </FormField>

              <FormField label="Password" class={pageStyles.formGroup}>
                <Input id="password" type="password" name="password" />
              </FormField>

              <Button type="submit" variant="primary" fullWidth disabled={submission.pending}>
                {submission.pending ? 'Signing in...' : 'Sign In'}
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
