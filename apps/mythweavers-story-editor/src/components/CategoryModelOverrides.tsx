import { Component, For, Show, createSignal } from 'solid-js'
import { modelsStore } from '../stores/modelsStore'
import { settingsStore } from '../stores/settingsStore'
import { currentStoryStore } from '../stores/currentStoryStore'
import { effectiveSettings } from '../stores/effectiveSettingsStore'
import type { LLMProvider } from '../types/llm'
import {
  GENERATION_CATEGORIES,
  isCategoryOverrideActive,
  type CategoryOverride,
  type GenerationCategory,
} from '../utils/llm/resolveModel'
import { ModelSelector } from './ModelSelector'
import * as overrideStyles from './CategoryModelOverrides.css'

/**
 * Sentinel for the "inherit from global" option in the thinking budget
 * dropdown. We can't use the empty string (some providers parse it as 0)
 * and 0 is a valid explicit value ("Off"), so we use a string sentinel
 * that's converted back to undefined on save.
 */
const INHERIT = 'inherit'

/** Options mirror the global thinking budget dropdown in AISettingsPanel. */
const THINKING_BUDGET_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Off' },
  { value: 1024, label: '1024 tokens' },
  { value: 2048, label: '2048 tokens' },
  { value: 4096, label: '4096 tokens' },
  { value: 8192, label: '8192 tokens' },
  { value: 16384, label: '16384 tokens' },
]

/**
 * Per-category max-output-tokens override. Mirrors the global TokenSelector
 * presets so users see a familiar set of buckets, and lets them, e.g.,
 * give analysis a tight cap without affecting writing.
 */
const MAX_TOKENS_OPTIONS: { value: number; label: string }[] = [
  { value: 1024, label: '1024 tokens' },
  { value: 2048, label: '2048 tokens' },
  { value: 4096, label: '4096 tokens' },
  { value: 8192, label: '8192 tokens' },
  { value: 16384, label: '16384 tokens' },
  { value: 32768, label: '32768 tokens' },
]

function describeThinkingBudget(v: number | null | undefined): string {
  if (v == null) return 'inherited'
  if (v === 0) return 'Off'
  return `${v} tokens`
}

function describeMaxTokens(v: number | null | undefined): string {
  if (v == null) return 'inherited'
  return `${v} tokens`
}

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

const CATEGORY_ORDER: GenerationCategory[] = [
  'writing',
  'analysis',
  'deep-analysis',
  'rewriting',
  'meta',
]

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
  // Thinking budget: 'inherit' sentinel means "fall back to global", number
  // (including 0) is an explicit override.
  const [editThinkingBudget, setEditThinkingBudget] = createSignal<
    number | typeof INHERIT
  >(INHERIT)
  const [editMaxTokens, setEditMaxTokens] = createSignal<
    number | typeof INHERIT
  >(INHERIT)

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
    // Pre-fill provider/model from the existing override if it has them, else
    // from the effective defaults so the user can flip on a model override
    // without re-entering the current values.
    const initialProvider = (existing?.provider ?? effectiveSettings.provider) as LLMProvider
    const initialModel = existing?.model ?? effectiveSettings.model ?? ''
    setEditProvider(initialProvider)
    setEditModel(initialModel)
    setEditThinkingBudget(
      existing?.thinkingBudget != null ? existing.thinkingBudget : INHERIT,
    )
    setEditMaxTokens(
      existing?.maxTokens != null ? existing.maxTokens : INHERIT,
    )
    setEditingCategory(category)

    // Ensure models are loaded for the selected provider
    modelsStore.fetchModelsForProvider(initialProvider)
  }

  const handleProviderChange = (provider: LLMProvider) => {
    setEditProvider(provider)
    setEditModel('') // Clear model when provider changes
    modelsStore.fetchModelsForProvider(provider)
  }

  const buildOverridePayload = (
    category: GenerationCategory,
  ): CategoryOverride | null => {
    // The model override is opt-in: only persist provider+model if the user
    // actually picked a model. If they only changed the thinking budget,
    // leave provider/model unset so the category inherits.
    const provider = editProvider()
    const model = editModel()
    const tb = editThinkingBudget()
    const mt = editMaxTokens()

    const overrides = getOverrides()
    const existing = overrides[category]
    const previouslyHadModel = !!(existing?.provider && existing?.model)

    const payload: CategoryOverride = {}
    if (model) {
      payload.provider = provider
      payload.model = model
    } else if (previouslyHadModel) {
      // The user opened an existing model override and cleared the model
      // (provider switch with no model selected yet). Drop the model fields
      // entirely rather than persisting half a model.
    }
    if (tb !== INHERIT) {
      payload.thinkingBudget = tb
    }
    if (mt !== INHERIT) {
      payload.maxTokens = mt
    }

    return isCategoryOverrideActive(payload) ? payload : null
  }

  const handleSave = (category: GenerationCategory) => {
    const payload = buildOverridePayload(category)
    if (isStoryScope()) {
      const current = currentStoryStore.aiOverrides?.categoryOverrides ?? {}
      const updated = { ...current }
      if (payload) {
        updated[category] = payload
      } else {
        delete updated[category]
      }
      if (Object.keys(updated).length === 0) {
        currentStoryStore.setAIOverride('categoryOverrides', null)
      } else {
        currentStoryStore.setAIOverride('categoryOverrides', updated)
      }
    } else {
      settingsStore.setCategoryOverride(category, payload)
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
    // Provider+model are linked — only show the override's provider when the
    // override actually carries a model.
    return override?.provider && override?.model
      ? override.provider
      : effectiveSettings.provider
  }

  const getEffectiveModel = (category: GenerationCategory) => {
    const overrides = getOverrides()
    const override = overrides[category]
    return override?.provider && override?.model
      ? override.model
      : effectiveSettings.model ?? 'none'
  }

  const getEffectiveThinkingBudget = (category: GenerationCategory) => {
    const overrides = getOverrides()
    const override = overrides[category]
    return override?.thinkingBudget != null
      ? override.thinkingBudget
      : (effectiveSettings.thinkingBudget ?? 0)
  }

  const getEffectiveMaxTokens = (category: GenerationCategory) => {
    const overrides = getOverrides()
    const override = overrides[category]
    return override?.maxTokens != null
      ? override.maxTokens
      : effectiveSettings.maxTokens
  }

  // For story scope: check if the override is inherited from global
  const isInheritedFromGlobal = (category: GenerationCategory) => {
    if (!isStoryScope()) return false
    const storyOverrides = currentStoryStore.aiOverrides?.categoryOverrides
    if (!storyOverrides) return true
    return !isCategoryOverrideActive(storyOverrides[category])
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
            const hasActiveOverride = () => isCategoryOverrideActive(override())
            const isEditing = () => editingCategory() === category

            return (
              <div class={overrideStyles.categoryCard}>
                <div class={overrideStyles.categoryHeader}>
                  <div class={overrideStyles.categoryInfo}>
                    <div class={overrideStyles.categoryLabel}>
                      {meta().label}
                      <Show when={hasActiveOverride()}>
                        {' '}
                        <span class={overrideStyles.overrideBadge}>override</span>
                      </Show>
                      <Show when={isStoryScope() && isInheritedFromGlobal(category) && isCategoryOverrideActive(settingsStore.categoryOverrides[category])}>
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
                    <div class={overrideStyles.currentModel}>
                      <span class={overrideStyles.currentModelLabel}>Thinking:</span>{' '}
                      {describeThinkingBudget(getEffectiveThinkingBudget(category))}
                      <Show when={override()?.thinkingBudget == null}>
                        <span style={{ opacity: 0.6, 'margin-left': '0.4em' }}>
                          (inherited)
                        </span>
                      </Show>
                    </div>
                    <div class={overrideStyles.currentModel}>
                      <span class={overrideStyles.currentModelLabel}>Max tokens:</span>{' '}
                      {describeMaxTokens(getEffectiveMaxTokens(category))}
                      <Show when={override()?.maxTokens == null}>
                        <span style={{ opacity: 0.6, 'margin-left': '0.4em' }}>
                          (inherited)
                        </span>
                      </Show>
                    </div>
                  </div>
                  <div class={overrideStyles.actions}>
                    <Show when={!isEditing()}>
                      <button
                        class={overrideStyles.actionButton}
                        onClick={() => startEditing(category)}
                      >
                        {hasActiveOverride() ? 'Edit' : 'Override'}
                      </button>
                      <Show when={hasActiveOverride()}>
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

                    <div class={overrideStyles.formRow}>
                      <label class={overrideStyles.formLabel}>Thinking Budget</label>
                      <select
                        class={overrideStyles.select}
                        value={editThinkingBudget() === INHERIT ? INHERIT : String(editThinkingBudget())}
                        onChange={(e) => {
                          const v = e.currentTarget.value
                          setEditThinkingBudget(v === INHERIT ? INHERIT : Number(v))
                        }}
                      >
                        <option value={INHERIT}>
                          Inherit (currently {describeThinkingBudget(effectiveSettings.thinkingBudget ?? 0)})
                        </option>
                        <For each={THINKING_BUDGET_OPTIONS}>
                          {(opt) => <option value={String(opt.value)}>{opt.label}</option>}
                        </For>
                      </select>
                    </div>

                    <div class={overrideStyles.formRow}>
                      <label class={overrideStyles.formLabel}>Max Tokens</label>
                      <select
                        class={overrideStyles.select}
                        value={editMaxTokens() === INHERIT ? INHERIT : String(editMaxTokens())}
                        onChange={(e) => {
                          const v = e.currentTarget.value
                          setEditMaxTokens(v === INHERIT ? INHERIT : Number(v))
                        }}
                      >
                        <option value={INHERIT}>
                          Inherit (currently {describeMaxTokens(effectiveSettings.maxTokens)})
                        </option>
                        <For each={MAX_TOKENS_OPTIONS}>
                          {(opt) => <option value={String(opt.value)}>{opt.label}</option>}
                        </For>
                      </select>
                    </div>

                    <div class={overrideStyles.actions}>
                      <button
                        class={overrideStyles.actionButton}
                        onClick={() => handleSave(category)}
                        disabled={
                          !editModel() &&
                          editThinkingBudget() === INHERIT &&
                          editMaxTokens() === INHERIT
                        }
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
