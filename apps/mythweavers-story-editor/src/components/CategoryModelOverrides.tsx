import { Component, For, Show, createSignal } from 'solid-js'
import { modelsStore } from '../stores/modelsStore'
import { settingsStore } from '../stores/settingsStore'
import { currentStoryStore } from '../stores/currentStoryStore'
import { effectiveSettings } from '../stores/effectiveSettingsStore'
import type { LLMProvider } from '../types/llm'
import {
  GENERATION_CATEGORIES,
  type GenerationCategory,
} from '../utils/llm/resolveModel'
import { ModelSelector } from './ModelSelector'
import * as overrideStyles from './CategoryModelOverrides.css'

const BUILTIN_PROVIDERS: { value: LLMProvider; label: string }[] = [
  { value: 'ollama', label: 'Ollama' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'server', label: 'Mythweavers' },
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

interface CategoryModelOverridesProps {
  scope?: 'global' | 'story'
}

export const CategoryModelOverrides: Component<CategoryModelOverridesProps> = (props) => {
  const isStoryScope = () => props.scope === 'story' && currentStoryStore.isInitialized

  // Track which category is being edited (null = none)
  const [editingCategory, setEditingCategory] = createSignal<GenerationCategory | null>(null)

  // Temporary state for the form being edited
  const [editProvider, setEditProvider] = createSignal<LLMProvider>('anthropic')
  const [editModel, setEditModel] = createSignal<string>('')

  // Get the overrides for the current scope
  const getOverrides = () => {
    if (isStoryScope()) {
      return currentStoryStore.aiOverrides?.categoryOverrides ?? {}
    }
    return settingsStore.categoryOverrides
  }

  const startEditing = (category: GenerationCategory) => {
    const overrides = getOverrides()
    const existing = overrides[category]
    if (existing) {
      setEditProvider(existing.provider)
      setEditModel(existing.model)
    } else {
      setEditProvider(effectiveSettings.provider as LLMProvider)
      setEditModel(effectiveSettings.model)
    }
    setEditingCategory(category)

    // Ensure models are loaded for the selected provider
    const provider = existing?.provider ?? (effectiveSettings.provider as LLMProvider)
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
      if (isStoryScope()) {
        // Update the story's category overrides
        const current = currentStoryStore.aiOverrides?.categoryOverrides ?? {}
        const updated = { ...current, [category]: { provider, model } }
        currentStoryStore.setAIOverride('categoryOverrides', updated)
      } else {
        settingsStore.setCategoryOverride(category, { provider, model })
      }
    }
    setEditingCategory(null)
  }

  const handleClear = (category: GenerationCategory) => {
    if (isStoryScope()) {
      const current = currentStoryStore.aiOverrides?.categoryOverrides ?? {}
      const updated = { ...current }
      delete updated[category]
      if (Object.keys(updated).length === 0) {
        currentStoryStore.setAIOverride('categoryOverrides', null)
      } else {
        currentStoryStore.setAIOverride('categoryOverrides', updated)
      }
    } else {
      settingsStore.setCategoryOverride(category, null)
    }
    setEditingCategory(null)
  }

  const getEffectiveProvider = (category: GenerationCategory) => {
    const overrides = getOverrides()
    const override = overrides[category]
    return override?.provider ?? effectiveSettings.provider
  }

  const getEffectiveModel = (category: GenerationCategory) => {
    const overrides = getOverrides()
    const override = overrides[category]
    return override?.model ?? effectiveSettings.model ?? 'none'
  }

  // For story scope: check if the override is inherited from global
  const isInheritedFromGlobal = (category: GenerationCategory) => {
    if (!isStoryScope()) return false
    const storyOverrides = currentStoryStore.aiOverrides?.categoryOverrides
    if (!storyOverrides) return true
    return !storyOverrides[category]
  }

  return (
    <div class={overrideStyles.section}>
      <p class={overrideStyles.description}>
        Override the provider and model used for specific types of generation.
        {isStoryScope()
          ? ' These overrides apply only to this story.'
          : ' If not set, the defaults above are used.'}
      </p>

      <div class={overrideStyles.categoryList}>
        <For each={CATEGORY_ORDER}>
          {(category) => {
            const meta = () => GENERATION_CATEGORIES[category]
            const override = () => getOverrides()[category]
            const isEditing = () => editingCategory() === category

            return (
              <div class={overrideStyles.categoryCard}>
                <div class={overrideStyles.categoryHeader}>
                  <div class={overrideStyles.categoryInfo}>
                    <div class={overrideStyles.categoryLabel}>
                      {meta().label}
                      <Show when={override()}>
                        {' '}
                        <span class={overrideStyles.overrideBadge}>override</span>
                      </Show>
                      <Show when={isStoryScope() && isInheritedFromGlobal(category) && settingsStore.categoryOverrides[category]}>
                        {' '}
                        <span class={overrideStyles.overrideBadge} style={{ opacity: 0.5 }}>global</span>
                      </Show>
                    </div>
                    <div class={overrideStyles.categoryDescription}>{meta().description}</div>
                    <div class={overrideStyles.currentModel}>
                      <span class={overrideStyles.currentModelLabel}>Provider:</span> {getEffectiveProvider(category)}
                    </div>
                    <div class={overrideStyles.currentModel}>
                      <span class={overrideStyles.currentModelLabel}>Model:</span> {getEffectiveModel(category)}
                    </div>
                  </div>
                  <div class={overrideStyles.actions}>
                    <Show when={!isEditing()}>
                      <button
                        class={overrideStyles.actionButton}
                        onClick={() => startEditing(category)}
                      >
                        {override() ? 'Edit' : 'Override'}
                      </button>
                      <Show when={override()}>
                        <button
                          class={overrideStyles.clearButton}
                          onClick={() => handleClear(category)}
                        >
                          Clear
                        </button>
                      </Show>
                    </Show>
                  </div>
                </div>

                <Show when={isEditing()}>
                  <div class={overrideStyles.overrideForm}>
                    <div class={overrideStyles.formRow}>
                      <label class={overrideStyles.formLabel}>Provider</label>
                      <select
                        class={overrideStyles.select}
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
                        <span class={overrideStyles.warningText}>
                          No API key configured for {editProvider()}. Add it in
                          API Keys settings.
                        </span>
                      </Show>
                    </div>

                    <div class={overrideStyles.formRow}>
                      <label class={overrideStyles.formLabel}>Model</label>
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

                    <div class={overrideStyles.actions}>
                      <button
                        class={overrideStyles.actionButton}
                        onClick={() => handleSave(category)}
                        disabled={!editModel()}
                      >
                        Save
                      </button>
                      <button
                        class={overrideStyles.actionButton}
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
