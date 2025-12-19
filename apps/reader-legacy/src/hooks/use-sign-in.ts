import { trpc } from '../utils/trpc'

export const useSignIn = () => {
  const { data: user, isLoading, error } = trpc.whoAmI.useQuery()

  return { user, isLoading, error }
}
