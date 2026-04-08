import { Component, For, Show, createEffect, createSignal, on } from 'solid-js'
import { settingsStore } from '../stores/settingsStore'
import { modelsStore } from '../stores/modelsStore'
import { ModelSelector } from './ModelSelector'
import * as styles from './ProviderModelSelector.css'

/**
 * Reusable provider & model selection component.
 * Reads from and writes to settingsStore and modelsStore directly — no prop drilling.
 *
 * Optionally auto-fetches models on mount and when the provider changes.
 */
interface ProviderModelSelectorProps {
  /**
   * If true, automatically fetches models on mount and when the provider changes.
   * Set to false if the parent already handles model fetching (e.g. the main app).
   * Defaults to false.
   */
  autoFetchModels?: boolean
}

type KeyTabId = 'openrouter' | 'anthropic' | 'openai' | 'cloudflare'

const KEY_TABS: { id: KeyTabId; label: string; placeholder: string }[] = [
  { id: 'openrouter', label: 'OpenRouter', placeholder: 'sk-or-...' },
  { id: 'anthropic', label: 'Anthropic', placeholder: 'sk-ant-...' },
  { id: 'openai', label: 'OpenAI', placeholder: 'sk-...' },
  { id: 'cloudflare', label: 'Cloudflare', placeholder: 'cfut_...' },
]

export const ProviderModelSelector: Component<ProviderModelSelectorProps> = (props) => {
  const [showKey, setShowKey] = createSignal(false)
  const [activeKeyTab, setActiveKeyTab] = createSignal<KeyTabId>('openrouter')

  // Auto-fetch models when provider changes (if enabled)
  if (props.autoFetchModels) {
    createEffect(
      on(
        () => settingsStore.provider,
        () => {
          modelsStore.fetchModels()
        },
      ),
    )
  }

  const getKeyValue = (tab: KeyTabId): string => {
    switch (tab) {
      case 'openrouter': return settingsStore.openrouterApiKey
      case 'anthropic': return settingsStore.anthropicApiKey
      case 'openai': return settingsStore.openaiApiKey
      case 'cloudflare': return settingsStore.cloudflareApiKey
    }
  }

  const setKeyValue = (tab: KeyTabId, value: string) => {
    switch (tab) {
      case 'openrouter': settingsStore.setOpenrouterApiKey(value); break
      case 'anthropic': settingsStore.setAnthropicApiKey(value); break
      case 'openai': settingsStore.setOpenaiApiKey(value); break
      case 'cloudflare': settingsStore.setCloudflareApiKey(value); break
    }
  }

  const isConfigured = (tab: KeyTabId): boolean => {
    if (tab === 'cloudflare') return !!getKeyValue(tab) && !!settingsStore.cloudflareEndpoint
    return !!getKeyValue(tab)
  }

  const handleTabClick = (tab: KeyTabId) => {
    if (activeKeyTab() === tab) return
    setActiveKeyTab(tab)
    setShowKey(false) // Reset visibility when switching tabs
  }

  const tabClass = (tab: KeyTabId) => {
    const active = activeKeyTab() === tab
    const configured = isConfigured(tab)
    if (active && configured) return `${styles.keyTab} ${styles.keyTabActiveConfigured}`
    if (active) return `${styles.keyTab} ${styles.keyTabActive}`
    if (configured) return `${styles.keyTab} ${styles.keyTabConfigured}`
    return styles.keyTab
  }

  const activeTabMeta = () => KEY_TABS.find((t) => t.id === activeKeyTab())!

  return (
    <div class={styles.section}>
      <div class={styles.settingRow}>
        <label class={styles.label}>Provider</label>
        <select
          value={settingsStore.provider}
          onChange={(e) => settingsStore.setProvider(e.target.value)}
          class={styles.select}
        >
          <option value="ollama">Ollama</option>
          <option value="openrouter">OpenRouter</option>
          <option value="anthropic">Anthropic</option>
          <option value="openai">OpenAI</option>
          <option value="cloudflare">Cloudflare Workers AI</option>
          <option value="server">Server</option>
          <For each={settingsStore.customProviders}>
            {(p) => <option value={`custom:${p.id}`}>{p.name}</option>}
          </For>
        </select>
      </div>

      {/* Tabbed API keys */}
      <div class={styles.settingRow}>
        <label class={styles.label}>API Keys</label>
        <div class={styles.keyTabs}>
          <For each={KEY_TABS}>
            {(tab) => (
              <button
                class={tabClass(tab.id)}
                onClick={() => handleTabClick(tab.id)}
              >
                {tab.label}
              </button>
            )}
          </For>
        </div>
        <div class={styles.keyContent}>
          <div class={styles.inputRow}>
            <input
              type={showKey() ? 'text' : 'password'}
              value={getKeyValue(activeKeyTab())}
              onChange={(e) => setKeyValue(activeKeyTab(), e.target.value)}
              class={styles.input}
              placeholder={activeTabMeta().placeholder}
            />
            <button
              onClick={() => setShowKey(!showKey())}
              class={styles.showKeyButton}
              title={showKey() ? 'Hide API key' : 'Show API key'}
            >
              {showKey() ? 'Hide' : 'Show'}
            </button>
          </div>

          {/* Cloudflare needs the endpoint URL with account ID baked in */}
          <Show when={activeKeyTab() === 'cloudflare'}>
            <input
              type="text"
              value={settingsStore.cloudflareEndpoint}
              onChange={(e) => settingsStore.setCloudflareEndpoint(e.target.value)}
              class={styles.input}
              placeholder="https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/ai"
              style={{ 'margin-top': '0.5rem' }}
            />
          </Show>
        </div>
      </div>

      <div class={styles.settingRow}>
        <label class={styles.label}>Default Model</label>
        <ModelSelector
          model={settingsStore.model}
          setModel={settingsStore.setModel}
          availableModels={modelsStore.availableModels}
          isLoadingModels={modelsStore.isLoadingModels}
          onRefreshModels={() => modelsStore.fetchModels()}
        />
      </div>
    </div>
  )
}
