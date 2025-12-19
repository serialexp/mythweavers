import { createStore } from 'solid-js/store'

export interface UserState {
  signedInUser?: {
    name: string | null | undefined
    avatarUrl: string | null | undefined
    id: number
    createdAt: string
    email: string
    clientName: string | null | undefined
  } | null
  authLoading: boolean
}

export const userStateDefault: UserState = {
  signedInUser: null,
  authLoading: true,
}

export const [userState, setUserState] = createStore(userStateDefault)

// This function should only handle setting the user state
export const setSignedInUser = (user: UserState['signedInUser']) => {
  setUserState('signedInUser', user)
  setUserState('authLoading', false)
}

export const resetUserState = () => {
  setUserState(userStateDefault)
}
