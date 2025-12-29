import { Button, Dropdown, DropdownDivider, DropdownItem, HStack, Spinner } from '@mythweavers/ui'
import { type AccessorWithLatest, action, reload, useSubmission } from '@solidjs/router'
import { Show, Suspense, createMemo } from 'solid-js'
import { authApi } from '~/lib/api'
import { type UserSession, destroyUserSession } from '~/lib/session'

const logoutAction = action(async () => {
  'use server'

  try {
    await authApi.logout()
    await destroyUserSession()
    return reload()
  } catch (error: unknown) {
    console.error('Logout action error:', error)
    await destroyUserSession()
    return reload()
  }
}, 'logoutUser')

const UserStatus = (props: {
  user?: AccessorWithLatest<UserSession | undefined | null>
}) => {
  const submission = useSubmission(logoutAction)
  // Memoize user to avoid multiple accessor calls
  const userName = createMemo(() => props.user?.()?.name)

  return (
    <div class="flex-none">
      <Suspense fallback={<Spinner size="sm" />}>
        <Show
          when={userName()}
          fallback={
              <HStack gap="sm">
              <a href="/login">
                <Button variant="ghost" size="sm">
                  Login
                </Button>
              </a>
              <a href="/register">
                <Button variant="primary" size="sm">
                  Register
                </Button>
              </a>
            </HStack>
          }
        >
          <Dropdown alignRight trigger={<Button variant="ghost">{userName() || 'User'}</Button>}>
            <DropdownItem onClick={() => (window.location.href = '/profile')}>Profile</DropdownItem>
            <DropdownItem onClick={() => (window.location.href = '/settings')}>Settings</DropdownItem>
            <DropdownDivider />
            <form method="post" action={logoutAction} style={{ display: 'contents' }}>
              <DropdownItem
                danger
                disabled={submission.pending}
                onClick={() => {
                  const form = document.querySelector('form[action]') as HTMLFormElement
                  form?.requestSubmit()
                }}
              >
                {submission.pending ? 'Logging out...' : 'Logout'}
              </DropdownItem>
            </form>
          </Dropdown>
        </Show>
      </Suspense>
    </div>
  )
}

export default UserStatus
