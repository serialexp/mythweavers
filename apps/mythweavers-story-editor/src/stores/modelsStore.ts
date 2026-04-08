import { createStore } from 'solid-js/store'
import { Model } from '../types/core'
import { LLMModel, LLMProvider } from '../types/llm'
import { LLMClientFactory } from '../utils/llm'
import { settingsStore } from './settingsStore'

const [modelsState, setModelsState] = createStore({
  availableModels: [] as Model[],
  isLoadingModels: false,
  modelsByProvider: {} as Partial<Record<LLMProvider, Model[]>>,
  loadingProviders: {} as Partial<Record<LLMProvider, boolean>>,
})

function convertLLMModels(llmModels: LLMModel[]): Model[] {
  return llmModels.map((llmModel) => ({
    name: llmModel.name,
    size: llmModel.size || 0,
    digest: llmModel.digest || '',
    modified_at: llmModel.modified_at || new Date().toISOString(),
    context_length: llmModel.context_length,
    description: llmModel.description,
    pricing: llmModel.pricing,
  }))
}

export const modelsStore = {
  // Getters
  get availableModels() {
    return modelsState.availableModels
  },
  get isLoadingModels() {
    return modelsState.isLoadingModels
  },
  get modelsByProvider() {
    return modelsState.modelsByProvider
  },

  /** Check whether a specific provider's models are currently loading. */
  isProviderLoading(provider: LLMProvider): boolean {
    return modelsState.loadingProviders[provider] ?? false
  },

  /** Get cached models for a provider (or empty array). */
  getModelsForProvider(provider: LLMProvider): Model[] {
    return modelsState.modelsByProvider[provider] ?? []
  },

  // Actions
  setAvailableModels: (models: Model[]) => setModelsState('availableModels', models),
  setIsLoadingModels: (loading: boolean) => setModelsState('isLoadingModels', loading),

  /**
   * Fetch and cache models for a specific provider.
   * Does not affect the default model selection — use this for override UIs.
   */
  fetchModelsForProvider: async (provider: LLMProvider): Promise<Model[]> => {
    // Return cached if available
    const cached = modelsState.modelsByProvider[provider]
    if (cached && cached.length > 0) return cached

    setModelsState('loadingProviders', provider, true)
    try {
      const client = LLMClientFactory.getClient(provider)
      const response = await client.list()
      const models = convertLLMModels(response.models || [])
      setModelsState('modelsByProvider', provider, models)
      return models
    } catch (error) {
      console.error(`Failed to fetch models for ${provider}:`, error)
      return []
    } finally {
      setModelsState('loadingProviders', provider, false)
    }
  },

  /** Force-refresh models for a provider (ignores cache). */
  refreshModelsForProvider: async (provider: LLMProvider): Promise<Model[]> => {
    setModelsState('loadingProviders', provider, true)
    try {
      const client = LLMClientFactory.getClient(provider)
      const response = await client.list()
      const models = convertLLMModels(response.models || [])
      setModelsState('modelsByProvider', provider, models)
      return models
    } catch (error) {
      console.error(`Failed to fetch models for ${provider}:`, error)
      return []
    } finally {
      setModelsState('loadingProviders', provider, false)
    }
  },

  fetchModels: async () => {
    setModelsState('isLoadingModels', true)
    try {
      console.log('Fetching models for provider:', settingsStore.provider)
      const client = LLMClientFactory.getClient(settingsStore.provider)
      console.log('Got client:', client)
      const response = await client.list()
      console.log('Model response:', response)
      const llmModels: LLMModel[] = response.models || []
      const models = convertLLMModels(llmModels)

      setModelsState('availableModels', models)

      // Also cache in modelsByProvider
      const provider = settingsStore.provider as LLMProvider
      setModelsState('modelsByProvider', provider, models)

      // Restore saved model selection if it exists in the available models
      const savedModel = localStorage.getItem('story-model')
      if (savedModel && models.some((model) => model.name === savedModel)) {
        settingsStore.setModel(savedModel)
      } else if (models.length > 0 && !settingsStore.model) {
        // If no saved model or saved model not found, select the first available model
        settingsStore.setModel(models[0].name)
      }
    } catch (error) {
      console.error('Failed to fetch models:', error)
      setModelsState('availableModels', [])
    } finally {
      setModelsState('isLoadingModels', false)
    }
  },
}
