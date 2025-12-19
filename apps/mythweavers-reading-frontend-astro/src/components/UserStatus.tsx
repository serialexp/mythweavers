import { Button, Dropdown, DropdownDivider, DropdownItem, HStack } from '@mythweavers/ui'
import { Show, createSignal } from 'solid-js'
import { authApi, type User } from '../lib/api'

// Re-export User type for convenience
export type { User }
export type UserSession = User

const UserStatus = (props: {
  user?: User | null
}) => {
  const [loggingOut, setLoggingOut] = createSignal(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await authApi.logout()
      window.location.href = '/'
    } catch (error) {
      console.error('Logout failed:', error)
      setLoggingOut(false)
    }
  }

  return (
    <div class="flex-none">
      <Show
        when={props.user}
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
        <Dropdown alignRight trigger={<Button variant="ghost">{props.user?.username || 'User'}</Button>}>
          <DropdownItem onClick={() => (window.location.href = '/bookshelf')}>My Bookshelf</DropdownItem>
          <DropdownDivider />
          <DropdownItem danger disabled={loggingOut()} onClick={handleLogout}>
            {loggingOut() ? 'Logging out...' : 'Logout'}
          </DropdownItem>
        </Dropdown>
      </Show>
    </div>
  )
}

export default UserStatus
