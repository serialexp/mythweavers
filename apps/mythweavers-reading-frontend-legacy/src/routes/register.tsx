import { Alert, Button, FormField, Input, LinkButton, Spinner } from '@mythweavers/ui'
import { Meta, Title } from '@solidjs/meta'
import { action, createAsync, redirect, useSubmission } from '@solidjs/router'
import { Show } from 'solid-js'
import { Layout } from '~/components/Layout'
import { authApi } from '~/lib/api'
import { createUserSession, getUserSessionQuery } from '~/lib/session'
import * as pageStyles from '~/styles/pages.css'

const registerAction = action(async (formData: FormData) => {
  'use server'

  const email = formData.get('email') as string
  const username = formData.get('username') as string
  const password = formData.get('password') as string

  if (!email || !username || !password) {
    return { success: false, error: 'All fields are required' }
  }

  try {
    const result = await authApi.register(email, username, password)

    if (result?.success && result.user) {
      await createUserSession(
        {
          id: result.user.id.toString(),
          name: result.user.username,
          email: result.user.email,
        },
        '/',
      )
      throw redirect('/')
    }
    return { success: false, error: 'Registration failed unexpectedly' }
  } catch (error: unknown) {
    console.error('Registration action error:', error)
    if (error instanceof Response && error.status === 302) {
      throw error
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An error occurred during registration.',
    }
  }
}, 'registerUser')

export default function Register() {
  const submission = useSubmission(registerAction)
  const user = createAsync(() => getUserSessionQuery())

  return (
    <Layout user={user}>
      <Title>Register - Reader</Title>
      <Meta name="description" content="Create a new Reader account" />

      <div class={pageStyles.centerContainer}>
        <div class={pageStyles.formCard}>
          <h1 class={pageStyles.formTitle}>Create Account</h1>

          <Show when={submission.error || submission.result?.error}>
            <Alert variant="error" class={pageStyles.mb4}>
              {submission.error?.message || submission.result?.error}
            </Alert>
          </Show>

          <form action={registerAction} method="post">
            <FormField label="Username" class={pageStyles.formGroup}>
              <Input id="username" type="text" name="username" disabled={submission.pending} required />
            </FormField>

            <FormField label="Email" class={pageStyles.formGroup}>
              <Input id="email" type="email" name="email" disabled={submission.pending} required />
            </FormField>

            <FormField label="Password" class={pageStyles.formGroup}>
              <Input id="password" type="password" name="password" disabled={submission.pending} required />
            </FormField>

            <Button type="submit" variant="primary" fullWidth disabled={submission.pending}>
              <Show when={submission.pending}>
                <Spinner size="sm" />
              </Show>
              Create Account
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
        </div>
      </div>
    </Layout>
  )
}
