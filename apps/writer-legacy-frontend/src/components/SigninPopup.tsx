import { useNavigate } from '@solidjs/router'
import { FiEdit2, FiLogOut } from 'solid-icons/fi'
import { Show, createSignal } from 'solid-js'
import { addNotification } from '../lib/stores/notifications'
import { setTokenForServer, settingsState } from '../lib/stores/settings'
import { setSignedInUser, userState } from '../lib/stores/user'
import type { UserState } from '../lib/stores/user'
import { reloadTrpc, trpc } from '../lib/trpc'

export const SigninPanel = () => {
  const _navigate = useNavigate()
  const [activeTab, setActiveTab] = createSignal('signin')
  const [signInEmail, setSignInEmail] = createSignal('')
  const [signInPassword, setSignInPassword] = createSignal('')
  const [name, _setName] = createSignal('')
  const [email, setEmail] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [_isRegistered, _setIsRegistered] = createSignal(false)
  const [signInError, setSignInError] = createSignal<string | null>(null)
  const [registerError, setRegisterError] = createSignal<string | null>(null)
  const [showClientNamePrompt, setShowClientNamePrompt] = createSignal(false)
  const [clientName, setClientName] = createSignal('')
  const [clientNameError, setClientNameError] = createSignal<string | null>(null)
  const [isEditingDeviceName, setIsEditingDeviceName] = createSignal(false)
  const [deviceName, setDeviceName] = createSignal('')
  const [deviceNameError, setDeviceNameError] = createSignal<string | null>(null)
  const [isUploading, setIsUploading] = createSignal(false)
  const [isEditingName, setIsEditingName] = createSignal(false)
  const [userName, setUserName] = createSignal('')
  const [userNameError, setUserNameError] = createSignal<string | null>(null)

  const handleSignInSubmit = (event: SubmitEvent) => {
    event.preventDefault()
    setSignInError(null)
    trpc.login
      .mutate({
        email: signInEmail(),
        password: signInPassword(),
      })
      .then(async (result) => {
        if (result) {
          // Set the token in the serverAuths array instead of using clientToken
          setTokenForServer(settingsState.serverUrl, result)

          // Reload the TRPC client to use the new token
          reloadTrpc()

          // Wait a moment to ensure the TRPC client is reloaded
          setTimeout(async () => {
            try {
              // Now try to get the user info
              const res = await trpc.whoAmI.query()
              // Use proper type for user data
              setSignedInUser(res as UserState['signedInUser'])

              // Show the client name prompt after successful sign-in
              setShowClientNamePrompt(true)
            } catch (error) {
              console.error('Error fetching user info:', error)
              setSignInError('Failed to fetch user information. Please try again.')
            }
          }, 100)
        }
      })
      .catch((error) => {
        setSignInError(error.message || 'Failed to sign in. Please check your credentials.')
      })
  }

  const handleRegisterSubmit = (event: SubmitEvent) => {
    event.preventDefault()
    setRegisterError(null)
    trpc.register
      .mutate({
        email: email(),
        name: name(),
        password: password(),
      })
      .then(async (_result) => {
        // After successful registration, automatically log in
        try {
          const loginResult = await trpc.login.mutate({
            email: email(),
            password: password(),
          })

          if (loginResult) {
            setTokenForServer(settingsState.serverUrl, loginResult)
            reloadTrpc()

            // Wait a moment to ensure the TRPC client is reloaded
            setTimeout(async () => {
              try {
                const res = await trpc.whoAmI.query()
                setSignedInUser(res as UserState['signedInUser'])
                setShowClientNamePrompt(true)
              } catch (error) {
                console.error('Error fetching user info:', error)
                setSignInError('Failed to fetch user information. Please try again.')
              }
            }, 100)
          }
        } catch (error) {
          console.error('Auto-login after registration failed:', error)
          setSignInError('Registration successful. Please sign in manually.')
        }
      })
      .catch((error) => {
        setRegisterError(error.message || 'Failed to register. Please try again.')
      })
  }

  const handleClientNameSubmit = (event: SubmitEvent) => {
    event.preventDefault()
    setClientNameError(null)

    if (!clientName().trim()) {
      setClientNameError('Please enter a client name')
      return
    }

    trpc.updateClientName
      .mutate({
        description: clientName(),
      })
      .then(() => {
        // Refresh user data to get the updated client name
        trpc.whoAmI.query().then((res) => {
          if (res) {
            setSignedInUser(res as UserState['signedInUser'])
          }
        })
        // Hide the client name prompt
        setShowClientNamePrompt(false)
      })
      .catch((error) => {
        setClientNameError(error.message || 'Failed to update client name. Please try again.')
      })
  }

  const handleDeviceNameSubmit = (event: SubmitEvent) => {
    event.preventDefault()
    setDeviceNameError(null)

    if (!deviceName().trim()) {
      setDeviceNameError('Please enter a device name')
      return
    }

    trpc.updateClientName
      .mutate({
        description: deviceName(),
      })
      .then(() => {
        setIsEditingDeviceName(false)
        // Refresh user data to get the updated device name
        trpc.whoAmI.query().then((res) => {
          if (res) {
            // Use proper type for user data
            setSignedInUser(res as UserState['signedInUser'])
          }
        })
      })
      .catch((error) => {
        setDeviceNameError(error.message || 'Failed to update device name. Please try again.')
      })
  }

  const handleNameSubmit = (event: SubmitEvent) => {
    event.preventDefault()
    setUserNameError(null)

    if (!userName().trim()) {
      setUserNameError('Please enter a name')
      return
    }

    trpc.updateName
      .mutate({
        name: userName(),
      })
      .then(() => {
        setIsEditingName(false)
        // Refresh user data to get the updated name
        trpc.whoAmI.query().then((res) => {
          if (res) {
            setSignedInUser(res as UserState['signedInUser'])
          }
        })
      })
      .catch((error) => {
        setUserNameError(error.message || 'Failed to update name. Please try again.')
      })
  }

  const handleLogout = () => {
    trpc.logout
      .mutate()
      .then(() => {
        setSignedInUser(undefined)
        addNotification({
          title: 'Logged out',
          message: 'You have been successfully logged out',
          type: 'success',
        })
      })
      .catch((error) => {
        console.error('Logout error:', error)
        addNotification({
          title: 'Logout failed',
          message: error instanceof Error ? error.message : 'Failed to log out',
          type: 'error',
        })
      })
  }

  const handleAvatarUpload = async (e: Event) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    try {
      setIsUploading(true)

      // Convert file to base64
      const reader = new FileReader()
      reader.readAsDataURL(file)

      reader.onload = async () => {
        try {
          const base64Data = reader.result as string
          // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
          const base64String = base64Data.split(',')[1]

          // Upload the image using the uploadUserImage procedure
          const result = await trpc.uploadUserImage.mutate({
            path: file.name,
            dataBase64: base64String,
          })

          // Update the avatar URL
          await trpc.updateAvatar.mutate({ avatarUrl: result.fullUrl })

          // Refresh user data to show the new avatar
          const userData = await trpc.whoAmI.query()
          setSignedInUser(userData)
        } catch (error) {
          console.error('Avatar upload error:', error)
          addNotification({
            title: 'Upload failed',
            message: error instanceof Error ? error.message : 'Failed to upload avatar',
            type: 'error',
          })
        } finally {
          setIsUploading(false)
        }
      }

      reader.onerror = () => {
        console.error('Error reading file')
        addNotification({
          title: 'Upload failed',
          message: 'Error reading file',
          type: 'error',
        })
        setIsUploading(false)
      }
    } catch (error) {
      console.error('Avatar upload error:', error)
      addNotification({
        title: 'Upload failed',
        message: error instanceof Error ? error.message : 'Failed to upload avatar',
        type: 'error',
      })
      setIsUploading(false)
    }
  }

  return (
    <div class="flex min-h-screen items-center w-full justify-center bg-base-200">
      <div class="card w-full max-w-md bg-base-100">
        <div class="card-body">
          <h2 class="card-title">Welcome to Writer</h2>

          <Show when={userState.signedInUser}>
            <div class="mb-6 flex flex-col items-center space-y-4">
              <div class="avatar">
                <div class="w-24 rounded-full">
                  <img
                    src={userState.signedInUser?.avatarUrl || undefined}
                    alt={userState.signedInUser?.name || 'User'}
                  />
                </div>
              </div>
              <div class="flex flex-col items-center space-y-2">
                <div class="flex items-center gap-2">
                  <h3 class="text-lg font-medium">{userState.signedInUser?.name || 'No name set'}</h3>
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs"
                    onClick={() => {
                      setUserName(userState.signedInUser?.name || '')
                      setIsEditingName(true)
                    }}
                  >
                    <FiEdit2 class="w-4 h-4" />
                  </button>
                </div>
                <p class="text-sm text-base-content/70">{userState.signedInUser?.email}</p>
                <div class="flex items-center gap-2">
                  <p class="text-sm text-base-content/70">Device: {userState.signedInUser?.clientName || 'Not set'}</p>
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs"
                    onClick={() => {
                      setDeviceName(userState.signedInUser?.clientName || '')
                      setIsEditingDeviceName(true)
                    }}
                  >
                    <FiEdit2 class="w-4 h-4" />
                  </button>
                </div>
              </div>
              <Show when={isEditingName()}>
                <form onSubmit={handleNameSubmit} class="w-full space-y-2">
                  <input
                    type="text"
                    class="input input-bordered w-full"
                    value={userName()}
                    onInput={(e) => setUserName(e.currentTarget.value)}
                    placeholder="Enter your name"
                  />
                  <Show when={userNameError()}>
                    <p class="text-error text-sm">{userNameError()}</p>
                  </Show>
                  <div class="flex gap-2">
                    <button type="submit" class="btn btn-primary btn-sm flex-1">
                      Save
                    </button>
                    <button type="button" class="btn btn-ghost btn-sm" onClick={() => setIsEditingName(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              </Show>
              <Show when={isEditingDeviceName()}>
                <form onSubmit={handleDeviceNameSubmit} class="w-full space-y-2">
                  <input
                    type="text"
                    class="input input-bordered w-full"
                    value={deviceName()}
                    onInput={(e) => setDeviceName(e.currentTarget.value)}
                    placeholder="Enter device name"
                  />
                  <Show when={deviceNameError()}>
                    <p class="text-error text-sm">{deviceNameError()}</p>
                  </Show>
                  <div class="flex gap-2">
                    <button type="submit" class="btn btn-primary btn-sm flex-1">
                      Save
                    </button>
                    <button type="button" class="btn btn-ghost btn-sm" onClick={() => setIsEditingDeviceName(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              </Show>
              <div class="flex flex-col items-center space-y-2">
                <label for="avatar" class="label">
                  <span class="label-text">Change Avatar</span>
                </label>
                <input
                  id="avatar"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  disabled={isUploading()}
                  class="file-input file-input-bordered w-full max-w-xs"
                />
              </div>
              <div class="w-full mt-4">
                <button type="button" class="btn btn-outline btn-error w-full" onClick={handleLogout}>
                  <FiLogOut class="w-4 h-4 mr-2" />
                  Sign Out
                </button>
              </div>
            </div>
          </Show>

          <Show when={!userState.signedInUser}>
            <p class="text-sm text-base-content/70">Sign in or create an account to get started</p>
            <div class="tabs tabs-boxed w-full">
              <button
                type="button"
                class={`tab ${activeTab() === 'signin' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('signin')}
              >
                Sign In
              </button>
              <button
                type="button"
                class={`tab ${activeTab() === 'register' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('register')}
              >
                Register
              </button>
            </div>

            <Show when={activeTab() === 'signin'}>
              <form onSubmit={handleSignInSubmit} class="space-y-4">
                <div class="form-control w-full">
                  <label for="email" class="label">
                    <span class="label-text">Email</span>
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="Enter your email"
                    class="input input-bordered w-full"
                    value={signInEmail()}
                    onInput={(e) => setSignInEmail(e.currentTarget.value)}
                  />
                </div>
                <div class="form-control w-full">
                  <label for="password" class="label">
                    <span class="label-text">Password</span>
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    placeholder="Enter your password"
                    class="input input-bordered w-full"
                    value={signInPassword()}
                    onInput={(e) => setSignInPassword(e.currentTarget.value)}
                  />
                </div>
                <Show when={signInError()}>
                  <div class="alert alert-error">
                    <span>{signInError()}</span>
                  </div>
                </Show>
                <button type="submit" class="btn btn-primary w-full">
                  Sign In
                </button>
              </form>
            </Show>

            <Show when={activeTab() === 'register'}>
              <form onSubmit={handleRegisterSubmit} class="space-y-4">
                <div class="form-control w-full">
                  <label for="register-email" class="label">
                    <span class="label-text">Email</span>
                  </label>
                  <input
                    id="register-email"
                    name="email"
                    type="email"
                    required
                    placeholder="Enter your email"
                    class="input input-bordered w-full"
                    value={email()}
                    onInput={(e) => setEmail(e.currentTarget.value)}
                  />
                </div>
                <div class="form-control w-full">
                  <label for="register-password" class="label">
                    <span class="label-text">Password</span>
                  </label>
                  <input
                    id="register-password"
                    name="password"
                    type="password"
                    required
                    placeholder="Enter your password"
                    class="input input-bordered w-full"
                    value={password()}
                    onInput={(e) => setPassword(e.currentTarget.value)}
                  />
                </div>
                <Show when={registerError()}>
                  <div class="alert alert-error">
                    <span>{registerError()}</span>
                  </div>
                </Show>
                <button type="submit" class="btn btn-primary w-full">
                  Register
                </button>
              </form>
            </Show>
          </Show>

          <Show when={showClientNamePrompt()}>
            <form onSubmit={handleClientNameSubmit} class="mt-4 space-y-4">
              <div class="form-control w-full">
                <label for="client-name" class="label">
                  <span class="label-text">Device Name</span>
                </label>
                <input
                  id="client-name"
                  class="input input-bordered w-full"
                  value={clientName()}
                  onInput={(e) => setClientName(e.currentTarget.value)}
                  placeholder="Enter a name for this device"
                />
                <Show when={clientNameError()}>
                  <div class="alert alert-error mt-2">
                    <span>{clientNameError()}</span>
                  </div>
                </Show>
              </div>
              <div class="flex space-x-2">
                <button type="submit" class="btn btn-primary flex-1">
                  Save
                </button>
                <button type="button" class="btn btn-outline flex-1" onClick={() => setShowClientNamePrompt(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </Show>
        </div>
      </div>
    </div>
  )
}
