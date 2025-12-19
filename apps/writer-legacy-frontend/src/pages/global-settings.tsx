import { For, Show, createEffect, createSignal } from 'solid-js'
import { WriteHeaderMenu } from '../components/WriteHeaderMenu.tsx'
import { FormField } from '../components/styled/FormField.tsx'
import { llms } from '../lib/llm/index.ts'
import { getTokenForServer, setSetting, settingsState } from '../lib/stores/settings.ts'
import { setSignedInUser } from '../lib/stores/user.ts'
import { reloadTrpc, trpc } from '../lib/trpc.ts'

const GlobalSettings = () => {
  const [availableModels, setAvailableModels] = createSignal<string[]>([])
  const [isLoading, setIsLoading] = createSignal(false)
  const [activeTab, setActiveTab] = createSignal('ai')
  const [expandedProviders, setExpandedProviders] = createSignal<string[]>([])
  const [expandedPublishers, setExpandedPublishers] = createSignal<string[]>([])
  const [isRefreshing, setIsRefreshing] = createSignal(false)

  const updateModels = async () => {
    const source = settingsState.aiSource
    if (source && source in llms) {
      setIsLoading(true)
      try {
        console.log('updating models for source:', source)
        const models = await llms[source]?.listModels()
        console.log('available models:', models)
        setAvailableModels(models ?? [])

        // Check if current model is valid for this source
        if (models && models.length > 0 && !models.includes(settingsState.aiModel)) {
          console.log('current model not in available models, resetting')
          setSetting('aiModel', '')
        }
      } catch (error) {
        console.error('Error fetching models:', error)
        setAvailableModels([])
      } finally {
        setIsLoading(false)
      }
    } else {
      setAvailableModels([])
    }
  }

  createEffect(async () => {
    const source = settingsState.aiSource
    console.log('aiSource changed to:', source)
    await updateModels()
  })

  const toggleProvider = (provider: string) => {
    if (expandedProviders().includes(provider)) {
      setExpandedProviders(expandedProviders().filter((p) => p !== provider))
    } else {
      setExpandedProviders([...expandedProviders(), provider])
    }
  }

  const togglePublisher = (publisher: string) => {
    if (expandedPublishers().includes(publisher)) {
      setExpandedPublishers(expandedPublishers().filter((p) => p !== publisher))
    } else {
      setExpandedPublishers([...expandedPublishers(), publisher])
    }
  }

  const hasProviderKey = (provider: string) => {
    switch (provider) {
      case 'openai':
        return !!settingsState.openaiKey
      case 'anthropic':
        return !!settingsState.anthropicKey
      case 'groq':
        return !!settingsState.groqKey
      case 'cerebras':
        return !!settingsState.cerebrasKey
      case 'gemini':
        return !!settingsState.geminiKey
      case 'ollama':
        return true // Ollama doesn't require a key
      default:
        return false
    }
  }

  const hasPublisherCredentials = (publisher: string) => {
    switch (publisher) {
      case 'royalroad':
        return !!settingsState.royalRoadEmail && !!settingsState.royalRoadPassword
      default:
        return false
    }
  }

  const refreshBackend = async () => {
    setIsRefreshing(true)
    try {
      // Reload the TRPC client with the current server URL
      reloadTrpc()

      // Check if we have a token for this server
      const token = getTokenForServer(settingsState.serverUrl)
      if (token) {
        // Try to fetch the current user
        try {
          const user = await trpc.whoAmI.query()
          setSignedInUser(user)
        } catch (error) {
          console.error('Error fetching user:', error)
          setSignedInUser(null)
        }
      } else {
        // No token for this server, clear user state
        setSignedInUser(null)
      }
    } finally {
      setIsRefreshing(false)
    }
  }

  const aiProviders = [
    { id: 'openai', name: 'OpenAI', keyField: 'openaiKey' },
    { id: 'anthropic', name: 'Anthropic', keyField: 'anthropicKey' },
    { id: 'groq', name: 'Groq', keyField: 'groqKey' },
    { id: 'cerebras', name: 'Cerebras', keyField: 'cerebrasKey' },
    { id: 'ollama', name: 'Ollama', keyField: '' },
    { id: 'gemini', name: 'Google Gemini', keyField: 'geminiKey' },
  ]

  const publishers = [
    { id: 'royalroad', name: 'Royal Road' },
    // Add more publishers here as they are supported
  ]

  return (
    <div class="flex flex-col h-full overflow-hidden">
      <WriteHeaderMenu />
      <div class="flex-1 flex flex-col p-4 gap-4 overflow-auto">
        {/* Tabs */}
        <div class="tabs tabs-boxed">
          <button
            type="button"
            class={`tab ${activeTab() === 'ai' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('ai')}
          >
            AI Providers
          </button>
          <button
            type="button"
            class={`tab ${activeTab() === 'server' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('server')}
          >
            Backend Server
          </button>
          <button
            type="button"
            class={`tab ${activeTab() === 'publishing' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('publishing')}
          >
            Publishing
          </button>
        </div>

        {/* AI Providers Tab */}
        <Show when={activeTab() === 'ai'}>
          <div class="flex flex-col gap-4">
            <h2 class="text-xl font-bold">AI Provider Settings</h2>

            <div class="flex flex-col gap-2">
              <FormField label="Selected AI Provider" helpText="Which AI provider is used to do completions">
                <select
                  class="select select-bordered"
                  value={settingsState.aiSource}
                  onChange={(e) => {
                    setSetting(
                      'aiSource',
                      e.currentTarget.value as 'openai' | 'groq' | 'anthropic' | 'ollama' | 'cerebras' | 'gemini',
                    )
                  }}
                >
                  <option value={''}>None</option>
                  <For each={aiProviders}>
                    {(provider) => (
                      <option value={provider.id} disabled={!hasProviderKey(provider.id)}>
                        {provider.name} {!hasProviderKey(provider.id) ? '(No API Key)' : ''}
                      </option>
                    )}
                  </For>
                </select>
              </FormField>

              <FormField
                label="Image Generation Provider"
                helpText="Which AI provider is used for image generation (separate from text generation)"
              >
                <select
                  class="select select-bordered"
                  value={settingsState.imageAiSource || ''}
                  onChange={(e) => {
                    setSetting('imageAiSource', e.currentTarget.value as 'openai' | '')
                  }}
                >
                  <option value={''}>None</option>
                  <option value="openai" disabled={!hasProviderKey('openai')}>
                    OpenAI {!hasProviderKey('openai') ? '(No API Key)' : ''}
                  </option>
                </select>
              </FormField>

              <FormField label="AI Model" helpText="Which AI model is used to do completions">
                {!isLoading() && (
                  <select
                    class="select select-bordered"
                    value={settingsState.aiModel}
                    onChange={(e) => {
                      setSetting('aiModel', e.currentTarget.value)
                    }}
                    disabled={isLoading()}
                  >
                    <option value={''}>None</option>
                    <For each={availableModels()}>{(m) => <option value={m}>{m}</option>}</For>
                  </select>
                )}
                {isLoading() && <div class="text-sm text-gray-500 mt-1">Loading models...</div>}
              </FormField>
            </div>

            <div class="divider">Provider API Keys</div>

            <div class="flex flex-col gap-2">
              <For each={aiProviders}>
                {(provider) => (
                  <div class="collapse collapse-arrow bg-base-200">
                    <input
                      type="checkbox"
                      checked={expandedProviders().includes(provider.id)}
                      onChange={() => toggleProvider(provider.id)}
                    />
                    <div class="collapse-title text-xl font-medium">
                      {provider.name} {hasProviderKey(provider.id) ? '✓' : ''}
                    </div>
                    <div class="collapse-content">
                      <FormField
                        label={`${provider.name} API Key`}
                        helpText={`Used for calling ${provider.name} for AI support.`}
                      >
                        <input
                          class="input input-bordered"
                          value={settingsState[provider.keyField as keyof typeof settingsState] as string}
                          onChange={(e) => {
                            setSetting(provider.keyField as keyof typeof settingsState, e.target.value)
                          }}
                          onBlur={() => {
                            updateModels()
                          }}
                          type={provider.keyField ? 'password' : 'text'}
                          disabled={!provider.keyField}
                        />
                      </FormField>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>

        {/* Backend Server Tab */}
        <Show when={activeTab() === 'server'}>
          <div class="flex flex-col gap-4">
            <h2 class="text-xl font-bold">Backend Server Settings</h2>
            <FormField
              label="Server URL"
              helpText="URL for remote functionalities like publishing and synchronization."
            >
              <div class="flex gap-2">
                <input
                  class="input input-bordered flex-1"
                  value={settingsState.serverUrl}
                  onChange={(e) => {
                    setSetting('serverUrl', e.target.value)
                    reloadTrpc()
                  }}
                />
                <button class="btn btn-primary" onClick={refreshBackend} disabled={isRefreshing()} type="button">
                  {isRefreshing() ? <span class="loading loading-spinner" /> : 'Refresh Connection'}
                </button>
              </div>
            </FormField>

            <div class="divider">Server Authentication</div>

            <div class="text-sm">
              <p>
                The app now stores authentication tokens per server URL. When you sign in to a server, your credentials
                will be saved for that specific server.
              </p>
            </div>

            <div class="overflow-x-auto">
              <table class="table table-zebra">
                <thead>
                  <tr>
                    <th>Server URL</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={settingsState.serverAuths}>
                    {(auth) => (
                      <tr>
                        <td>{auth.url}</td>
                        <td>
                          {auth.token ? (
                            <span class="badge badge-success">Authenticated</span>
                          ) : (
                            <span class="badge badge-ghost">Not authenticated</span>
                          )}
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </div>
        </Show>

        {/* Publishing Tab */}
        <Show when={activeTab() === 'publishing'}>
          <div class="flex flex-col gap-4">
            <h2 class="text-xl font-bold">Publishing Settings</h2>
            <div class="text-sm">
              <p>
                Configure credentials for different publishing platforms. These settings are used when publishing your
                stories to various platforms.
              </p>
              <div class="alert alert-info mt-2">
                <span>
                  Your publishing credentials are stored locally on your machine and are only sent to the respective
                  platforms when you explicitly choose to publish content. They are never stored on our servers except
                  temporarily during the actual publishing process.
                </span>
              </div>
            </div>

            <div class="flex flex-col gap-2">
              <For each={publishers}>
                {(publisher) => (
                  <div class="collapse collapse-arrow bg-base-200">
                    <input
                      type="checkbox"
                      checked={expandedPublishers().includes(publisher.id)}
                      onChange={() => togglePublisher(publisher.id)}
                    />
                    <div class="collapse-title text-xl font-medium">
                      {publisher.name} {hasPublisherCredentials(publisher.id) ? '✓' : ''}
                    </div>
                    <div class="collapse-content">
                      {publisher.id === 'royalroad' && (
                        <div class="flex flex-col gap-4">
                          <FormField
                            label="Royal Road Email"
                            helpText="Your username on Royal Road, this is used if you want to publish chapters there."
                          >
                            <input
                              class="input input-bordered"
                              value={settingsState.royalRoadEmail}
                              onChange={(e) => {
                                setSetting('royalRoadEmail', e.target.value)
                              }}
                            />
                          </FormField>
                          <FormField
                            label="Royal Road Password"
                            helpText="Your password on Royal Road, this is used if you want to publish chapters there."
                          >
                            <input
                              class="input input-bordered"
                              value={settingsState.royalRoadPassword}
                              onChange={(e) => {
                                setSetting('royalRoadPassword', e.target.value)
                              }}
                              type="password"
                            />
                          </FormField>
                        </div>
                      )}

                      {!hasPublisherCredentials(publisher.id) && (
                        <div class="alert alert-warning">
                          <span>
                            Please enter your credentials for {publisher.name} to enable publishing to this platform.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </div>
  )
}

export default GlobalSettings
