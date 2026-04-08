import { Component, For, Show, createSignal } from 'solid-js'
import { modelsStore } from '../stores/modelsStore'
import { settingsStore } from '../stores/settingsStore'
import type { LLMProvider } from '../types/llm'
import {
  GENERATION_CATEGORIES,
  type GenerationCategory,
} from '../utils/llm/resolveModel'
import { ModelSelector } from './ModelSelector'
import * as styles from './CategoryModelOverrides.css'

const BUILTIN_PROVIDERS: { value: LLMProvider; label: string }[] = [
  { value: 'ollama', label: 'Ollama' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'server', label: 'Server' },
]

function getAllProviders(): { value: LLMProvider; label: string }[] {
  const custom = settingsStore.customProviders.map((p) => ({
    value: `custom:${p.id}` as LLMProvider,
    label: p.name,
  }))
  return [...BUILTIN_PROVIDERS, ...custom]
}

/** Check if the required API key is configured for a given provider. */
function hasApiKey(provider: LLMProvider): boolean {
  if (typeof provider === 'string' && provider.startsWith('custom:')) {
    const id = provider.slice('custom:'.length)
    const custom = settingsStore.getCustomProvider(id)
    return !!custom?.apiKey
  }
  switch (provider) {
    case 'openrouter':
      return !!settingsStore.openrouterApiKey
    case 'anthropic':
      return !!settingsStore.anthropicApiKey
    case 'openai':
      return !!settingsStore.openaiApiKey
    case 'ollama':
    case 'server':
      return true // No key needed
    default:
      return true
  }
}

const CATEGORY_ORDER: GenerationCategory[] = ['writing', 'analysis', 'rewriting', 'meta']

export const CategoryModelOverrides: Component = () => {
  // Track which category is being edited (null = none)
  const [editingCategory, setEditingCategory] = createSignal<GenerationCategory | null>(null)

  // Temporary state for the form being edited
  const [editProvider, setEditProvider] = createSignal<LLMProvider>('anthropic')
  const [editModel, setEditModel] = createSignal<string>('')

  const startEditing = (category: GenerationCategory) => {
    const existing = settingsStore.categoryOverrides[category]
    if (existing) {
      setEditProvider(existing.provider)
      setEditModel(existing.model)
    } else {
      setEditProvider(settingsStore.provider as LLMProvider)
      setEditModel(settingsStore.model)
    }
    setEditingCategory(category)

    // Ensure models are loaded for the selected provider
    const provider = existing?.provider ?? (settingsStore.provider as LLMProvider)
    modelsStore.fetchModelsForProvider(provider)
  }

  const handleProviderChange = (provider: LLMProvider) => {
    setEditProvider(provider)
    setEditModel('') // Clear model when provider changes
    modelsStore.fetchModelsForProvider(provider)
  }

  const handleSave = (category: GenerationCategory) => {
    const provider = editProvider()
    const model = editModel()
    if (provider && model) {
      settingsStore.setCategoryOverride(category, { provider, model })
    }
    setEditingCategory(null)
  }

  const handleClear = (category: GenerationCategory) => {
    settingsStore.setCategoryOverride(category, null)
    setEditingCategory(null)
  }

  const getEffectiveModel = (category: GenerationCategory) => {
    const override = settingsStore.categoryOverrides[category]
    if (override?.model) {
      return `${override.model} (${override.provider})`
    }
    return `${settingsStore.model || 'none'} (${settingsStore.provider})`
  }

  return (
    <div class={styles.section}>
      <p class={styles.description}>
        Override the model used for specific types of generation. If not set,
        the default provider and model are used.
      </p>

      <div class={styles.categoryList}>
        <For each={CATEGORY_ORDER}>
          {(category) => {
            const meta = () => GENERATION_CATEGORIES[category]
            const override = () => settingsStore.categoryOverrides[category]
            const isEditing = () => editingCategory() === category

            return (
              <div class={styles.categoryCard}>
                <div class={styles.categoryHeader}>
                  <div class={styles.categoryInfo}>
                    <div class={styles.categoryLabel}>
                      {meta().label}
                      <Show when={override()}>
                        {' '}
                        <span class={styles.overrideBadge}>override</span>
                      </Show>
                    </div>
                    <div class={styles.categoryDescription}>{meta().description}</div>
                    <div class={styles.currentModel}>{getEffectiveModel(category)}</div>
                  </div>
                  <div class={styles.actions}>
                    <Show when={!isEditing()}>
                      <button
                        class={styles.actionButton}
                        onClick={() => startEditing(category)}
                      >
                        {override() ? 'Edit' : 'Override'}
                      </button>
                      <Show when={override()}>
                        <button
                          class={styles.clearButton}
                          onClick={() => handleClear(category)}
                        >
                          Clear
                        </button>
                      </Show>
                    </Show>
                  </div>
                </div>

                <Show when={isEditing()}>
                  <div class={styles.overrideForm}>
                    <div class={styles.formRow}>
                      <label class={styles.formLabel}>Provider</label>
                      <select
                        class={styles.select}
                        value={editProvider()}
                        onChange={(e) =>
                          handleProviderChange(e.target.value as LLMProvider)
                        }
                      >
                        <For each={getAllProviders()}>
                          {(p) => (
                            <option value={p.value}>{p.label}</option>
                          )}
                        </For>
                      </select>
                      <Show when={!hasApiKey(editProvider())}>
                        <span class={styles.warningText}>
                          No API key configured for {editProvider()}. Add it in
                          Provider &amp; Model settings.
                        </span>
                      </Show>
                    </div>

                    <div class={styles.formRow}>
                      <label class={styles.formLabel}>Model</label>
                      <ModelSelector
                        model={editModel()}
                        setModel={setEditModel}
                        availableModels={modelsStore.getModelsForProvider(editProvider())}
                        isLoadingModels={modelsStore.isProviderLoading(editProvider())}
                        onRefreshModels={() =>
                          modelsStore.refreshModelsForProvider(editProvider())
                        }
                      />
                    </div>

                    <div class={styles.actions}>
                      <button
                        class={styles.actionButton}
                        onClick={() => handleSave(category)}
                        disabled={!editModel()}
                      >
                        Save
                      </button>
                      <button
                        class={styles.actionButton}
                        onClick={() => setEditingCategory(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </Show>
              </div>
            )
          }}
        </For>
      </div>
    </div>
  )
}
