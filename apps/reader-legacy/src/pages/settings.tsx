import { useForm } from 'react-hook-form'
import { trpc } from '../utils/trpc'

export const UserSettingsPage = () => {
  const { register, handleSubmit, reset } = useForm<{
    currentPassword: string
    newPassword: string
  }>()

  const updatePasswordMutation = trpc.updatePassword.useMutation()

  const onSubmit = async (data: {
    currentPassword: string
    newPassword: string
  }) => {
    try {
      const result = await updatePasswordMutation.mutateAsync(data)
      if (result.success) {
        alert('Password updated successfully')
        reset()
      } else {
        alert('Failed to update password')
      }
    } catch (error) {
      console.error('Error updating password', error)
      alert('An error occurred while updating the password')
    }
  }

  return (
    <div className="settings-page p-4">
      <h1 className="text-2xl font-bold mb-4">User Settings</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="password-update-form space-y-4">
        <div className="form-group">
          <label htmlFor="currentPassword" className="block text-sm font-medium mb-1">
            Current Password
          </label>
          <input
            type="password"
            id="currentPassword"
            {...register('currentPassword', { required: true })}
            placeholder="Enter current password"
            className="input input-bordered w-full"
          />
        </div>
        <div className="form-group">
          <label htmlFor="newPassword" className="block text-sm font-medium mb-1">
            New Password
          </label>
          <input
            type="password"
            id="newPassword"
            {...register('newPassword', { required: true })}
            placeholder="Enter new password"
            className="input input-bordered w-full"
          />
        </div>
        <button type="submit" className="btn btn-primary w-full">
          Update Password
        </button>
      </form>
    </div>
  )
}

export default UserSettingsPage
