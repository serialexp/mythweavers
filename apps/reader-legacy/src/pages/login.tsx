import { useQueryClient } from '@tanstack/react-query'
import { getQueryKey } from '@trpc/react-query'
import { useForm } from 'react-hook-form'
import { useLocation } from 'wouter'
import { trpc } from '../utils/trpc'

export const LoginPage = () => {
  const { register, handleSubmit } = useForm<{
    email: string
    password: string
  }>()
  const queryClient = useQueryClient()
  const [_location, navigate] = useLocation()

  const login = trpc.sessionLogin.useMutation()
  const onSubmit = async (data: { email: string; password: string }) => {
    try {
      const sessionToken = await login.mutateAsync(data)
      if (sessionToken) {
        localStorage.setItem('sessionToken', sessionToken)
        queryClient.invalidateQueries({
          queryKey: getQueryKey(trpc.whoAmI),
        })
        navigate('/')
      } else {
        alert('Login failed')
      }
    } catch (error) {
      console.error('Login error', error)
      alert('An error occurred during login')
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="max-w-md mx-auto p-4 bg-white dark:bg-gray-700 shadow-md rounded"
    >
      <p className="mb-4">If you don't have an account yet, first download Writer and create one from the interface.</p>
      <input
        type="email"
        {...register('email')}
        placeholder="Email"
        required
        className="w-full p-2 mb-4 border border-gray-300 rounded"
      />
      <input
        type="password"
        {...register('password')}
        placeholder="Password"
        required
        className="w-full p-2 mb-4 border border-gray-300 rounded"
      />
      <button type="submit" className="w-full p-2 bg-blue-500 text-white rounded hover:bg-blue-600">
        Login
      </button>
    </form>
  )
}
