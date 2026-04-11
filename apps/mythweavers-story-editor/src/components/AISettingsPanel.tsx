import { ListDetailPanel, type ListDetailPanelRef } from '@mythweavers/ui'
import { BsKey, BsLayers, BsPlug } from 'solid-icons/bs'
import { type Component, type JSX, For, Show, createSignal, onMount } from 'solid-js'
import { modelsStore } from '../stores/modelsStore'
import { settingsStore } from '../stores/settingsStore'
import { currentStoryStore } from '../stores/currentStoryStore'
import { CategoryModelOverrides } from './CategoryModelOverrides'
import { CustomProviders } from './CustomProviders'
import { ModelSelector } from './ModelSelector'
import { ApiKeys } from './ProviderModelSelector'
import { OverlayPanel } from './OverlayPanel'
import * as styles from './Settings.css'
import * as aiStyles from './AISettingsPanel.css'

interface SettingsSection {
  id: string
  name: string
  icon: JSX.Element
}

const AI_SETTINGS_SECTIONS: SettingsSection[] = [
  { id: 'api-keys', name: 'API Keys', icon: <BsKey /> },
  { id: 'models', name: 'Models', icon: <BsLayers /> },
  { id: 'custom-providers', name: 'Custom Providers', icon: <BsPlug /> },
]

type SettingsScope = 'global' | 'story'

const AISettingsContent: Component = () => {
  let panelRef: ListDetailPanelRef | undefined
  const [scope, setScope] = createSignal<SettingsScope>('global')

  onMount(() => {
    panelRef?.select('api-keys')
    // Default to story scope if a story is loaded
    if (currentStoryStore.isInitialized) {
      setScope('story')
    }
  })

  const isStoryScope = () => scope() === 'story' && currentStoryStore.isInitialized
  const hasStory = () => currentStoryStore.isInitialized

  // Handlers for story-level provider/model
  const storyProvider = () => currentStoryStore.aiOverrides?.provider ?? null
  const storyModel = () => currentStoryStore.aiOverrides?.model ?? null

  const handleProviderChange = (provider: string) => {
    if (isStoryScope()) {
      currentStoryStore.setAIOverride('provider', provider)
      currentStoryStore.setAIOverride('model', null) // Clear model when provider changes
    } else {
      settingsStore.setProvider(provider)
    }
  }

  const handleModelChange = (model: string) => {
    if (isStoryScope()) {
      currentStoryStore.setAIOverride('model', model)
    } else {
      settingsStore.setModel(model)
    }
  }

  const clearStoryProviderOverride = () => {
    currentStoryStore.setAIOverride('provider', null)
    currentStoryStore.setAIOverride('model', null)
  }

  const clearStoryModelOverride = () => {
    currentStoryStore.setAIOverride('model', null)
  }

  // maxTokens / thinkingBudget handlers
  const storyMaxTokens = () => currentStoryStore.aiOverrides?.maxTokens ?? null
  const storyThinkingBudget = () => currentStoryStore.aiOverrides?.thinkingBudget ?? null

  const displayMaxTokens = () => {
    if (isStoryScope()) {
      return storyMaxTokens() ?? settingsStore.maxTokens
    }
    return settingsStore.maxTokens
  }

  const displayThinkingBudget = () => {
    if (isStoryScope()) {
      return storyThinkingBudget() ?? settingsStore.thinkingBudget
    }
    return settingsStore.thinkingBudget
  }

  const handleMaxTokensChange = (tokens: number) => {
    if (isStoryScope()) {
      currentStoryStore.setAIOverride('maxTokens', tokens)
    } else {
      settingsStore.setMaxTokens(tokens)
    }
  }

  const handleThinkingBudgetChange = (budget: number) => {
    if (isStoryScope()) {
      currentStoryStore.setAIOverride('thinkingBudget', budget)
    } else {
      settingsStore.setThinkingBudget(budget)
    }
  }

  const clearStoryMaxTokensOverride = () => {
    currentStoryStore.setAIOverride('maxTokens', null)
  }

  const clearStoryThinkingBudgetOverride = () => {
    currentStoryStore.setAIOverride('thinkingBudget', null)
  }

  // Get the displayed provider/model based on current scope
  const displayProvider = () => {
    if (isStoryScope()) {
      return storyProvider() ?? settingsStore.provider
    }
    return settingsStore.provider
  }

  const displayModel = () => {
    if (isStoryScope()) {
      return storyModel() ?? settingsStore.model
    }
    return settingsStore.model
  }

  const ScopeToggle: Component = () => (
    <Show when={hasStory()}>
      <div class={aiStyles.scopeToggle}>
        <button
          class={`${aiStyles.scopeButton} ${scope() === 'global' ? aiStyles.scopeButtonActive : ''}`}
          onClick={() => setScope('global')}
        >
          Global
        </button>
        <button
          class={`${aiStyles.scopeButton} ${scope() === 'story' ? aiStyles.scopeButtonActive : ''}`}
          onClick={() => setScope('story')}
        >
          Story
        </button>
      </div>
      <Show when={isStoryScope()}>
        <p class={aiStyles.scopeHint}>
          Settings here only apply to <strong>{currentStoryStore.name || 'this story'}</strong>.
          Unset fields inherit from your global defaults.
        </p>
      </Show>
    </Show>
  )

  const renderModelsSection = () => (
    <div class={styles.section}>
      <ScopeToggle />

      <div class={styles.settingRow}>
        <label class={styles.label}>
          {isStoryScope() ? 'Provider' : 'Default Provider'}
          <Show when={isStoryScope() && storyProvider()}>
            <button class={aiStyles.clearOverrideButton} onClick={clearStoryProviderOverride}>
              (reset to global)
            </button>
          </Show>
        </label>
        <select
          value={displayProvider()}
          onChange={(e) => handleProviderChange(e.target.value)}
          class={styles.select}
        >
          <option value="ollama">Ollama</option>
          <option value="openrouter">OpenRouter</option>
          <option value="anthropic">Anthropic</option>
          <option value="openai">OpenAI</option>
          <option value="cloudflare">Cloudflare Workers AI</option>
          <option value="server">Mythweavers</option>
          {settingsStore.customProviders.map((p) => (
            <option value={`custom:${p.id}`}>{p.name}</option>
          ))}
        </select>
        <Show when={isStoryScope() && !storyProvider()}>
          <span class={aiStyles.inheritHint}>Inherited from global: {settingsStore.provider}</span>
        </Show>
      </div>

      <div class={styles.settingRow}>
        <label class={styles.label}>
          {isStoryScope() ? 'Model' : 'Default Model'}
          <Show when={isStoryScope() && storyModel()}>
            <button class={aiStyles.clearOverrideButton} onClick={clearStoryModelOverride}>
              (reset to global)
            </button>
          </Show>
        </label>
        <ModelSelector
          model={displayModel()}
          setModel={handleModelChange}
          availableModels={modelsStore.availableModels}
          isLoadingModels={modelsStore.isLoadingModels}
          onRefreshModels={() => modelsStore.fetchModels()}
        />
        <Show when={isStoryScope() && !storyModel()}>
          <span class={aiStyles.inheritHint}>Inherited from global: {settingsStore.model || '(none)'}</span>
        </Show>
      </div>

      <div class={styles.settingRow}>
        <label class={styles.label}>
          Max Tokens
          <Show when={isStoryScope() && storyMaxTokens() !== null}>
            <button class={aiStyles.clearOverrideButton} onClick={clearStoryMaxTokensOverride}>
              (reset to global)
            </button>
          </Show>
        </label>
        <select
          value={displayMaxTokens()}
          onChange={(e) => handleMaxTokensChange(Number(e.target.value))}
          class={styles.select}
        >
          <For each={[512, 1024, 2048, 4096, 8192]}>
            {(value) => <option value={value}>{value} tokens</option>}
          </For>
        </select>
        <Show when={isStoryScope() && storyMaxTokens() === null}>
          <span class={aiStyles.inheritHint}>Inherited from global: {settingsStore.maxTokens}</span>
        </Show>
      </div>

      <div class={styles.settingRow}>
        <label class={styles.label}>
          Thinking Budget
          <Show when={isStoryScope() && storyThinkingBudget() !== null}>
            <button class={aiStyles.clearOverrideButton} onClick={clearStoryThinkingBudgetOverride}>
              (reset to global)
            </button>
          </Show>
        </label>
        <select
          value={displayThinkingBudget()}
          onChange={(e) => handleThinkingBudgetChange(Number(e.target.value))}
          class={styles.select}
        >
          <option value={0}>Off</option>
          <option value={1024}>1024 tokens</option>
          <option value={2048}>2048 tokens</option>
          <option value={4096}>4096 tokens</option>
          <option value={8192}>8192 tokens</option>
          <option value={16384}>16384 tokens</option>
        </select>
        <Show when={isStoryScope() && storyThinkingBudget() === null}>
          <span class={aiStyles.inheritHint}>Inherited from global: {settingsStore.thinkingBudget === 0 ? 'Off' : `${settingsStore.thinkingBudget} tokens`}</span>
        </Show>
      </div>

      <CategoryModelOverrides scope={scope()} />
    </div>
  )

  const renderSectionContent = (sectionId: string) => {
    switch (sectionId) {
      case 'api-keys':
        return <ApiKeys />
      case 'models':
        return renderModelsSection()
      case 'custom-providers':
        return <CustomProviders />
      default:
        return null
    }
  }

  return (
    <ListDetailPanel
      ref={(r) => (panelRef = r)}
      items={AI_SETTINGS_SECTIONS}
      emptyStateMessage="Select a section"
      renderListItem={(section) => (
        <div class={styles.listItem}>
          {section.icon}
          <span>{section.name}</span>
        </div>
      )}
      detailTitle={(section) => section.name}
      renderDetail={(section) => renderSectionContent(section.id)}
    />
  )
}

interface AISettingsPanelProps {
  show: boolean
  onClose: () => void
}

export const AISettingsPanel: Component<AISettingsPanelProps> = (props) => {
  return (
    <OverlayPanel show={props.show} onClose={props.onClose} title="AI Settings">
      <AISettingsContent />
    </OverlayPanel>
  )
}
