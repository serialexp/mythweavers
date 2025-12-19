import { useQueryClient } from '@tanstack/react-query'
import { getQueryKey } from '@trpc/react-query'
import { BookStack, EditPencil } from 'iconoir-react'
import { useLocation } from 'wouter'
import { Navitem } from '../ui-components/navitem/navitem'
import { trpc } from '../utils/trpc'

const UserStatus = () => {
  const { data: user, isLoading, error } = trpc.whoAmI.useQuery()
  const queryClient = useQueryClient()
  const signoutMutation = trpc.sessionSignout.useMutation()
  const [, navigate] = useLocation()

  if (isLoading) {
    return <p>Loading...</p>
  }

  if (error) {
    console.error('Error fetching user:', error)
    return <p>Error loading user information.</p>
  }

  return (
    <div className="flex items-center space-x-4 ml-auto">
      <div className="form-control">
        <input
          type="text"
          placeholder="Search"
          className="input input-bordered w-24 md:w-auto"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.currentTarget.value.trim()) {
              navigate(`/search?q=${encodeURIComponent(e.currentTarget.value.trim())}`)
              e.currentTarget.value = ''
            }
          }}
        />
      </div>
      {user ? (
        <>
          <ul className="menu menu-horizontal flex-nowrap gap-2 px-1">
            <li>
              <Navitem to="/library">
                <BookStack />
              </Navitem>
            </li>
            <li>
              <Navitem to="/my-fiction">
                <EditPencil />
              </Navitem>
            </li>
          </ul>
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar">
              <div className="w-10 rounded-full">
                <img alt="Tailwind CSS Navbar component" src={user.avatarUrl} />
              </div>
            </div>
            <ul className="menu menu-sm dropdown-content bg-base-100 rounded-box z-[1] mt-3 w-52 p-2 shadow">
              {user.role === 'admin' && (
                <li>
                  <Navitem to="/admin">Admin</Navitem>
                </li>
              )}
              <li>
                <Navitem to="/profile">Profile</Navitem>
              </li>
              <li>
                <Navitem to="/settings">Settings</Navitem>
              </li>
              <li>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await signoutMutation.mutateAsync()
                      queryClient.invalidateQueries({
                        queryKey: getQueryKey(trpc.whoAmI),
                      })
                    } catch (error) {
                      console.error('Error signing out:', error)
                    }
                  }}
                >
                  Logout
                </button>
              </li>
            </ul>
          </div>
        </>
      ) : (
        <ul className="menu menu-horizontal px-1">
          <li>
            <Navitem to="/login">Login</Navitem>
          </li>
        </ul>
      )}
    </div>
  )
}

export default UserStatus
