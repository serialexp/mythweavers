import { createStore } from 'solid-js/store'
import { Model } from '../types/core'
import { LLMModel } from '../types/llm'
import { LLMClientFactory } from '../utils/llm'
import { settingsStore } from './settingsStore'

const [modelsState, setModelsState] = createStore({
  availableModels: [] as Model[],
  isLoadingModels: false,
})

export const modelsStore = {
  // Getters
  get availableModels() {
    return modelsState.availableModels
  },
  get isLoadingModels() {
    return modelsState.isLoadingModels
  },

  // Actions
  setAvailableModels: (models: Model[]) => setModelsState('availableModels', models),
  setIsLoadingModels: (loading: boolean) => setModelsState('isLoadingModels', loading),

  fetchModels: async () => {
    setModelsState('isLoadingModels', true)
    try {
      console.log('Fetching models for provider:', settingsStore.provider)
      const client = LLMClientFactory.getClient(settingsStore.provider)
      console.log('Got client:', client)
      const response = await client.list()
      console.log('Model response:', response)
      const llmModels: LLMModel[] = response.models || []

      // Convert LLMModel to Model format
      const models: Model[] = llmModels.map((llmModel) => ({
        name: llmModel.name,
        size: llmModel.size || 0,
        digest: llmModel.digest || '',
        modified_at: llmModel.modified_at || new Date().toISOString(),
        context_length: llmModel.context_length,
        description: llmModel.description,
        pricing: llmModel.pricing,
      }))

      setModelsState('availableModels', models)

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
