import { query } from '@solidjs/router'
import { useSession } from 'vinxi/http'

// Define the session data type
export type UserSession = {
  id: string
  name: string
  email?: string
  avatarUrl?: string
  token?: string
}

// Define the session data shape
type SessionData = {
  user: UserSession | null
  redirectTo?: string
}

// Create a server function to access the user session
export async function useUserSession() {
  'use server'
  return useSession<SessionData>({
    password: process.env.SESSION_SECRET ?? 'areallylongsecretthatyoushouldreplace',
  })
}

// Create a user session
export async function createUserSession(user: UserSession, redirectTo = '/') {
  'use server'
  const session = await useUserSession()
  await session.update({ user, redirectTo })
}

// Get the current user from session
export async function getUserFromSession() {
  'use server'
  const session = await useUserSession()
  return session.data.user
}

// Require a user to be logged in
export async function requireUserSession(redirectTo = '/login') {
  'use server'
  const session = await useUserSession()
  const user = session.data.user

  if (!user) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${redirectTo}`,
      },
    })
  }

  return user
}

// Destroy user session (logout)
export async function destroyUserSession(redirectTo = '/') {
  'use server'
  const session = await useUserSession()
  return session.update({ user: null, redirectTo })
}

// Define the user session query (shared between client and server)
const fetchUserSession = async () => {
  'use server'
  return getUserFromSession()
}

export const getUserSessionQuery = query(fetchUserSession, 'userSession')
