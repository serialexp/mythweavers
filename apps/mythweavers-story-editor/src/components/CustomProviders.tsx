import { Component, For, Show, createSignal } from 'solid-js'
import { settingsStore, type CustomProvider } from '../stores/settingsStore'
import * as styles from './CustomProviders.css'

/**
 * UI for managing custom OpenAI-compatible providers.
 * Each custom provider has an ID, display name, endpoint URL, and API key.
 */
export const CustomProviders: Component = () => {
  const [isAdding, setIsAdding] = createSignal(false)
  const [editingId, setEditingId] = createSignal<string | null>(null)

  // Form state
  const [formId, setFormId] = createSignal('')
  const [formName, setFormName] = createSignal('')
  const [formEndpoint, setFormEndpoint] = createSignal('')
  const [formApiKey, setFormApiKey] = createSignal('')
  const [showApiKey, setShowApiKey] = createSignal(false)

  const resetForm = () => {
    setFormId('')
    setFormName('')
    setFormEndpoint('')
    setFormApiKey('')
    setShowApiKey(false)
  }

  const startAdding = () => {
    resetForm()
    setEditingId(null)
    setIsAdding(true)
  }

  const startEditing = (provider: CustomProvider) => {
    setFormId(provider.id)
    setFormName(provider.name)
    setFormEndpoint(provider.endpoint)
    setFormApiKey(provider.apiKey)
    setShowApiKey(false)
    setIsAdding(false)
    setEditingId(provider.id)
  }

  const cancel = () => {
    setIsAdding(false)
    setEditingId(null)
    resetForm()
  }

  const sanitizeId = (input: string): string => {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  const handleSave = () => {
    const id = sanitizeId(formId())
    const name = formName().trim()
    const endpoint = formEndpoint().trim().replace(/\/+$/, '') // Strip trailing slashes
    const apiKey = formApiKey().trim()

    if (!id || !name || !endpoint) return

    settingsStore.addCustomProvider({ id, name, endpoint, apiKey })

    setIsAdding(false)
    setEditingId(null)
    resetForm()
  }

  const handleRemove = (id: string) => {
    settingsStore.removeCustomProvider(id)
    if (editingId() === id) {
      cancel()
    }
  }

  const isFormValid = () => {
    const id = sanitizeId(formId())
    const name = formName().trim()
    const endpoint = formEndpoint().trim()
    if (!id || !name || !endpoint) return false
    // Don't allow duplicate IDs when adding (allow when editing same ID)
    if (isAdding() && settingsStore.customProviders.some((p) => p.id === id)) return false
    return true
  }

  const renderForm = () => (
    <div class={styles.form}>
      <div class={styles.formRow}>
        <label class={styles.label}>ID</label>
        <input
          class={styles.input}
          type="text"
          value={formId()}
          onInput={(e) => setFormId(e.target.value)}
          placeholder="moonshot"
          disabled={!!editingId()}
        />
        <Show when={formId()}>
          <span class={styles.infoText}>
            Provider key: custom:{sanitizeId(formId())}
          </span>
        </Show>
      </div>

      <div class={styles.formRow}>
        <label class={styles.label}>Display Name</label>
        <input
          class={styles.input}
          type="text"
          value={formName()}
          onInput={(e) => setFormName(e.target.value)}
          placeholder="Moonshot AI"
        />
      </div>

      <div class={styles.formRow}>
        <label class={styles.label}>Endpoint URL</label>
        <input
          class={styles.input}
          type="text"
          value={formEndpoint()}
          onInput={(e) => setFormEndpoint(e.target.value)}
          placeholder="https://api.moonshot.cn"
        />
        <span class={styles.infoText}>
          Must be OpenAI-compatible. /v1/chat/completions and /v1/models will be called.
        </span>
      </div>

      <div class={styles.formRow}>
        <label class={styles.label}>API Key</label>
        <div class={styles.inputRow}>
          <input
            class={styles.input}
            type={showApiKey() ? 'text' : 'password'}
            value={formApiKey()}
            onInput={(e) => setFormApiKey(e.target.value)}
            placeholder="sk-..."
          />
          <button
            class={styles.showKeyButton}
            onClick={() => setShowApiKey(!showApiKey())}
          >
            {showApiKey() ? 'Hide' : 'Show'}
          </button>
        </div>
        <span class={styles.infoText}>
          Optional if the endpoint doesn't require authentication.
        </span>
      </div>

      <div class={styles.formActions}>
        <button
          class={styles.actionButton}
          onClick={handleSave}
          disabled={!isFormValid()}
        >
          {editingId() ? 'Update' : 'Add'}
        </button>
        <button class={styles.actionButton} onClick={cancel}>
          Cancel
        </button>
      </div>
    </div>
  )

  return (
    <div class={styles.section}>
      <p class={styles.description}>
        Add OpenAI-compatible providers with custom endpoints. These appear as
        provider options alongside the built-in providers.
      </p>

      <div class={styles.providerList}>
        <For each={settingsStore.customProviders}>
          {(provider) => (
            <Show
              when={editingId() !== provider.id}
              fallback={renderForm()}
            >
              <div class={styles.providerCard}>
                <div class={styles.providerHeader}>
                  <div>
                    <div class={styles.providerName}>{provider.name}</div>
                    <div class={styles.providerEndpoint}>{provider.endpoint}</div>
                  </div>
                  <div class={styles.actions}>
                    <button
                      class={styles.actionButton}
                      onClick={() => startEditing(provider)}
                    >
                      Edit
                    </button>
                    <button
                      class={styles.removeButton}
                      onClick={() => handleRemove(provider.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </Show>
          )}
        </For>
      </div>

      <Show when={isAdding()} fallback={
        <button class={styles.actionButton} onClick={startAdding}>
          + Add Provider
        </button>
      }>
        {renderForm()}
      </Show>
    </div>
  )
}
