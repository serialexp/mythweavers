import { createEffect, createSignal } from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'
import { putMyPreferences } from '../client/config'
import { DEFAULT_CHARS_PER_TOKEN, DEFAULT_CONTEXT_SIZE } from '../constants'
import {
  type EncryptedSecrets,
  type SecretKeys,
  deriveKey as cryptoDeriveKey,
  decryptSecrets,
  encryptSecrets,
  extractSalt,
  generateSalt,
} from '../lib/crypto'
import type { CategoryOverrides } from '../utils/llm/resolveModel'

export interface CustomProvider {
  /** Unique ID, e.g. "moonshot" — used as the provider key everywhere */
  id: string
  /** Display name, e.g. "Moonshot AI" */
  name: string
  /** Base URL, e.g. "https://api.moonshot.cn" */
  endpoint: string
  /** API key for this provider */
  apiKey: string
}

const getInitialCustomProviders = (): CustomProvider[] => {
  try {
    const saved = localStorage.getItem('story-custom-providers')
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

const getInitialCategoryOverrides = (): CategoryOverrides => {
  try {
    const saved = localStorage.getItem('story-category-overrides')
    return saved ? JSON.parse(saved) : {}
  } catch {
    return {}
  }
}

// Initialize values from localStorage
const getInitialContextSize = (): number => {
  const saved = localStorage.getItem('story-context-size')
  return saved ? Number.parseInt(saved) : DEFAULT_CONTEXT_SIZE
}

const getInitialCharsPerToken = (): number => {
  const saved = localStorage.getItem('story-chars-per-token')
  return saved ? Number.parseFloat(saved) : DEFAULT_CHARS_PER_TOKEN
}

const [settingsState, setSettingsState] = createStore({
  model: localStorage.getItem('story-model') || '',
  storySetting: localStorage.getItem('story-setting') || '',
  contextSize: getInitialContextSize(),
  charsPerToken: getInitialCharsPerToken(),
  showSettings: false,
  provider: localStorage.getItem('story-provider') || 'ollama',
  openrouterApiKey: localStorage.getItem('story-openrouter-api-key') || '',
  anthropicApiKey: localStorage.getItem('story-anthropic-api-key') || '',
  openaiApiKey: localStorage.getItem('story-openai-api-key') || '',
  cloudflareApiKey: localStorage.getItem('story-cloudflare-api-key') || '',
  cloudflareEndpoint: localStorage.getItem('story-cloudflare-endpoint') || '',
  llamaCppApiKey: localStorage.getItem('story-llamacpp-api-key') || '',
  person: localStorage.getItem('story-person') || 'third',
  tense: localStorage.getItem('story-tense') || 'past',
  autoGenerate: localStorage.getItem('story-auto-generate') === 'true',
  showEventMessages: localStorage.getItem('story-show-event-messages') !== 'false', // Default to true
  thinkingBudget: Number.parseInt(localStorage.getItem('story-thinking-budget') || '0'), // 0 = no budget
  refineClichés: localStorage.getItem('story-refine-cliches') === 'true',
  includeNameSuggestions: localStorage.getItem('story-include-name-suggestions') !== 'false', // Default to true
  maxTokens: Number.parseInt(localStorage.getItem('story-max-tokens') || '4096'),
  categoryOverrides: getInitialCategoryOverrides(),
  customProviders: getInitialCustomProviders(),
})

// Auto-save effects

createEffect(() => {
  if (settingsState.model) {
    localStorage.setItem('story-model', settingsState.model)
  }
})

createEffect(() => {
  localStorage.setItem('story-setting', settingsState.storySetting)
})

createEffect(() => {
  localStorage.setItem('story-context-size', settingsState.contextSize.toString())
})

createEffect(() => {
  localStorage.setItem('story-chars-per-token', settingsState.charsPerToken.toString())
})

createEffect(() => {
  localStorage.setItem('story-provider', settingsState.provider)
})

createEffect(() => {
  localStorage.setItem('story-openrouter-api-key', settingsState.openrouterApiKey)
})

createEffect(() => {
  localStorage.setItem('story-anthropic-api-key', settingsState.anthropicApiKey)
})

createEffect(() => {
  localStorage.setItem('story-openai-api-key', settingsState.openaiApiKey)
})

createEffect(() => {
  localStorage.setItem('story-cloudflare-api-key', settingsState.cloudflareApiKey)
})

createEffect(() => {
  localStorage.setItem('story-cloudflare-endpoint', settingsState.cloudflareEndpoint)
})

createEffect(() => {
  localStorage.setItem('story-llamacpp-api-key', settingsState.llamaCppApiKey)
})

createEffect(() => {
  localStorage.setItem('story-person', settingsState.person)
})

createEffect(() => {
  localStorage.setItem('story-tense', settingsState.tense)
})

createEffect(() => {
  localStorage.setItem('story-auto-generate', settingsState.autoGenerate.toString())
})

createEffect(() => {
  localStorage.setItem('story-show-event-messages', settingsState.showEventMessages.toString())
})

createEffect(() => {
  localStorage.setItem('story-thinking-budget', settingsState.thinkingBudget.toString())
})

createEffect(() => {
  localStorage.setItem('story-refine-cliches', settingsState.refineClichés.toString())
})

createEffect(() => {
  localStorage.setItem('story-include-name-suggestions', settingsState.includeNameSuggestions.toString())
})

createEffect(() => {
  localStorage.setItem('story-max-tokens', settingsState.maxTokens.toString())
})

createEffect(() => {
  localStorage.setItem('story-category-overrides', JSON.stringify(settingsState.categoryOverrides))
})

createEffect(() => {
  localStorage.setItem('story-custom-providers', JSON.stringify(settingsState.customProviders))
})

// --- Backend sync ---

/** Non-secret keys synced to the backend in plaintext. */
const SYNCED_KEYS = [
  'provider',
  'model',
  'maxTokens',
  'thinkingBudget',
  'contextSize',
  'cloudflareEndpoint',
  'categoryOverrides',
] as const

/** Secret keys that are encrypted before syncing to the backend. */
const SECRET_KEYS: (keyof SecretKeys)[] = ['openrouterApiKey', 'anthropicApiKey', 'openaiApiKey', 'cloudflareApiKey']

/** Whether we've loaded preferences from the backend (prevents saving defaults back on boot). */
let backendLoaded = false
/** Whether a backend save is in flight. */
let syncInFlight = false
/** Queued state to save after the current save completes. */
let syncQueued = false
let syncTimer: ReturnType<typeof setTimeout> | undefined

// --- Encryption state (session-only, never persisted) ---
let _encryptionKey: CryptoKey | null = null
let _encryptionSalt: Uint8Array | null = null
/** Cached encrypted blob from backend, used when we need to decrypt later. */
let _pendingEncryptedSecrets: EncryptedSecrets | null = null

const [needsDecryption, setNeedsDecryption] = createSignal(false)

/**
 * Whether Web Crypto (SubtleCrypto) is usable in this context. It is only
 * exposed in a secure context (HTTPS, localhost, or file://). On a plain-HTTP
 * origin (e.g. a LAN/Tailscale IP) `crypto.subtle` is undefined and any
 * encrypt/decrypt/deriveKey call throws. When this is false we keep API keys
 * device-local (plaintext localStorage) and never prompt for a password.
 */
function isEncryptionAvailable(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext === true && !!window.crypto?.subtle
}

function collectSecretKeys(): SecretKeys {
  const secrets: SecretKeys = {}
  if (settingsState.openrouterApiKey) secrets.openrouterApiKey = settingsState.openrouterApiKey
  if (settingsState.anthropicApiKey) secrets.anthropicApiKey = settingsState.anthropicApiKey
  if (settingsState.openaiApiKey) secrets.openaiApiKey = settingsState.openaiApiKey
  if (settingsState.cloudflareApiKey) secrets.cloudflareApiKey = settingsState.cloudflareApiKey

  // Collect custom provider keys
  const cpKeys: Record<string, string> = {}
  for (const p of settingsState.customProviders) {
    if (p.apiKey) cpKeys[p.id] = p.apiKey
  }
  if (Object.keys(cpKeys).length > 0) secrets.customProviderKeys = cpKeys

  return secrets
}

function hasAnySecretKeys(): boolean {
  return !!(
    settingsState.openrouterApiKey ||
    settingsState.anthropicApiKey ||
    settingsState.openaiApiKey ||
    settingsState.cloudflareApiKey ||
    settingsState.customProviders.some((p) => p.apiKey)
  )
}

async function buildSyncPayload() {
  const payload: Record<string, unknown> = {}
  for (const key of SYNCED_KEYS) {
    payload[key] = settingsState[key]
  }

  // Sync custom providers without API keys (those go in the encrypted blob)
  payload.customProviders = settingsState.customProviders.map(({ apiKey: _, ...rest }) => rest)

  // Encrypt secrets if we have the key
  if (_encryptionKey && _encryptionSalt) {
    const secrets = collectSecretKeys()
    if (Object.keys(secrets).length > 0) {
      try {
        payload.encryptedSecrets = await encryptSecrets(_encryptionKey, _encryptionSalt, secrets)
      } catch (err) {
        console.warn('[settingsStore] Failed to encrypt secrets:', err)
      }
    }
  }

  return payload
}

async function doBackendSync() {
  if (syncInFlight) {
    syncQueued = true
    return
  }
  syncInFlight = true
  try {
    const payload = await buildSyncPayload()
    await putMyPreferences({ body: payload as any })
  } catch (err) {
    console.warn('[settingsStore] Backend sync failed:', err)
  } finally {
    syncInFlight = false
    if (syncQueued) {
      syncQueued = false
      doBackendSync()
    }
  }
}

function scheduleSyncToBackend() {
  if (!backendLoaded) return
  clearTimeout(syncTimer)
  syncTimer = setTimeout(doBackendSync, 500)
}

// Watch all synced keys and schedule a backend save when they change.
// JSON.stringify is used to deep-track object values (e.g. categoryOverrides)
// so nested property changes also trigger the sync.
for (const key of SYNCED_KEYS) {
  createEffect(() => {
    const val = settingsState[key]
    if (typeof val === 'object' && val !== null) {
      JSON.stringify(val)
    }
    scheduleSyncToBackend()
  })
}
// Also watch secret keys and custom providers — these trigger encryption + sync
for (const key of SECRET_KEYS) {
  createEffect(() => {
    void settingsState[key as keyof typeof settingsState]
    scheduleSyncToBackend()
  })
}
createEffect(() => {
  JSON.stringify(settingsState.customProviders)
  scheduleSyncToBackend()
})

export const settingsStore = {
  // Getters
  get model() {
    return settingsState.model
  },
  get storySetting() {
    return settingsState.storySetting
  },
  get contextSize() {
    return settingsState.contextSize
  },
  get charsPerToken() {
    return settingsState.charsPerToken
  },
  get showSettings() {
    return settingsState.showSettings
  },
  get provider() {
    return settingsState.provider
  },
  get openrouterApiKey() {
    return settingsState.openrouterApiKey
  },
  get anthropicApiKey() {
    return settingsState.anthropicApiKey
  },
  get openaiApiKey() {
    return settingsState.openaiApiKey
  },
  get cloudflareApiKey() {
    return settingsState.cloudflareApiKey
  },
  get cloudflareEndpoint() {
    return settingsState.cloudflareEndpoint
  },
  get person() {
    return settingsState.person
  },
  get tense() {
    return settingsState.tense
  },
  get autoGenerate() {
    return settingsState.autoGenerate
  },
  get showEventMessages() {
    return settingsState.showEventMessages
  },
  get thinkingBudget() {
    return settingsState.thinkingBudget
  },
  get refineClichés() {
    return settingsState.refineClichés
  },
  get includeNameSuggestions() {
    return settingsState.includeNameSuggestions
  },
  get maxTokens() {
    return settingsState.maxTokens
  },
  get categoryOverrides() {
    return settingsState.categoryOverrides
  },
  get customProviders() {
    return settingsState.customProviders
  },
  get llamaCppApiKey() {
    return settingsState.llamaCppApiKey
  },

  // Actions
  setModel: (model: string) => {
    setSettingsState('model', model)
  },
  setStorySetting: (setting: string) => setSettingsState('storySetting', setting),
  setContextSize: (size: number) => setSettingsState('contextSize', size),
  setCharsPerToken: (ratio: number) => setSettingsState('charsPerToken', ratio),
  setShowSettings: (show: boolean) => setSettingsState('showSettings', show),
  toggleSettings: () => setSettingsState('showSettings', !settingsState.showSettings),
  setProvider: (provider: string) => {
    setSettingsState('provider', provider)
    // Clear model selection when switching providers since models are provider-specific
    setSettingsState('model', '')
  },
  setOpenrouterApiKey: (key: string) => setSettingsState('openrouterApiKey', key),
  setAnthropicApiKey: (key: string) => setSettingsState('anthropicApiKey', key),
  setOpenaiApiKey: (key: string) => setSettingsState('openaiApiKey', key),
  setCloudflareApiKey: (key: string) => setSettingsState('cloudflareApiKey', key),
  setCloudflareEndpoint: (endpoint: string) => setSettingsState('cloudflareEndpoint', endpoint),
  setLlamaCppApiKey: (key: string) => {
    setSettingsState('llamaCppApiKey', key)
    import('../utils/llm/LLMClientFactory').then(({ LLMClientFactory }) => {
      LLMClientFactory.clearClientCache('llamacpp')
    })
  },
  setPerson: (person: string) => setSettingsState('person', person),
  setTense: (tense: string) => setSettingsState('tense', tense),
  setAutoGenerate: (enabled: boolean) => setSettingsState('autoGenerate', enabled),
  setShowEventMessages: (show: boolean) => setSettingsState('showEventMessages', show),
  toggleEventMessages: () => setSettingsState('showEventMessages', !settingsState.showEventMessages),
  setThinkingBudget: (budget: number) => setSettingsState('thinkingBudget', budget),
  setRefineClichés: (enabled: boolean) => setSettingsState('refineClichés', enabled),
  setIncludeNameSuggestions: (enabled: boolean) => setSettingsState('includeNameSuggestions', enabled),
  setMaxTokens: (tokens: number) => setSettingsState('maxTokens', tokens),
  addCustomProvider: (provider: CustomProvider) => {
    setSettingsState('customProviders', (prev) => [...prev.filter((p) => p.id !== provider.id), provider])
    // Clear cached client so it picks up new config
    import('../utils/llm/LLMClientFactory').then(({ LLMClientFactory }) => {
      LLMClientFactory.clearClientCache(`custom:${provider.id}`)
    })
  },
  updateCustomProvider: (id: string, updates: Partial<Omit<CustomProvider, 'id'>>) => {
    setSettingsState('customProviders', (p) => p.id === id, updates as any)
  },
  removeCustomProvider: (id: string) => {
    setSettingsState('customProviders', (prev) => prev.filter((p) => p.id !== id))
    // Clear the LLMClientFactory cache for this provider
    import('../utils/llm/LLMClientFactory').then(({ LLMClientFactory }) => {
      LLMClientFactory.clearClientCache(`custom:${id}`)
    })
  },
  getCustomProvider: (id: string): CustomProvider | undefined => {
    return settingsState.customProviders.find((p) => p.id === id)
  },
  setCategoryOverride: (
    category: string,
    override: {
      provider?: string | null
      model?: string | null
      thinkingBudget?: number | null
      maxTokens?: number | null
    } | null,
  ) => {
    if (override) {
      setSettingsState('categoryOverrides', category as keyof CategoryOverrides, override as any)
    } else {
      // Remove the override — reconcile to actually remove the key from the store proxy
      const current = { ...settingsState.categoryOverrides }
      delete current[category as keyof CategoryOverrides]
      setSettingsState('categoryOverrides', reconcile(current))
    }
  },

  /**
   * Load preferences from the backend (called on session restore).
   * Only applies values that actually exist in the backend payload —
   * anything not set on the server falls back to the localStorage value.
   */
  loadFromBackend: (prefs: Record<string, unknown>) => {
    // Non-secret fields
    if (prefs.provider != null) setSettingsState('provider', prefs.provider as string)
    if (prefs.model != null) setSettingsState('model', prefs.model as string)
    if (prefs.maxTokens != null) setSettingsState('maxTokens', prefs.maxTokens as number)
    if (prefs.thinkingBudget != null) setSettingsState('thinkingBudget', prefs.thinkingBudget as number)
    if (prefs.contextSize != null) setSettingsState('contextSize', prefs.contextSize as number)
    if (prefs.cloudflareEndpoint != null) setSettingsState('cloudflareEndpoint', prefs.cloudflareEndpoint as string)
    if (prefs.categoryOverrides != null)
      setSettingsState('categoryOverrides', reconcile(prefs.categoryOverrides as CategoryOverrides))

    // Custom providers (metadata only — API keys live in the encrypted blob).
    // Union-merge backend + local by id so a locally-defined provider is never
    // dropped just because the backend copy is missing/stale, and any local
    // API key is preserved. This is what keeps a provider from vanishing when
    // decryption is skipped/unavailable — you lose the key, not the provider.
    if (prefs.customProviders != null) {
      const backendProviders = prefs.customProviders as Array<Omit<CustomProvider, 'apiKey'> & { apiKey?: string }>
      const byId = new Map<string, CustomProvider>()
      // Seed with local providers (preserves local-only entries and their keys)
      for (const lp of settingsState.customProviders) byId.set(lp.id, { ...lp })
      // Overlay backend metadata, keeping any local API key
      for (const bp of backendProviders) {
        const local = byId.get(bp.id)
        byId.set(bp.id, { ...bp, apiKey: local?.apiKey ?? bp.apiKey ?? '' })
      }
      setSettingsState('customProviders', reconcile(Array.from(byId.values())))
    }

    // Handle encrypted secrets
    const encrypted = prefs.encryptedSecrets as EncryptedSecrets | undefined
    if (encrypted?.salt && encrypted?.iv && encrypted?.ciphertext) {
      _pendingEncryptedSecrets = encrypted
      _encryptionSalt = extractSalt(encrypted)

      // Check if localStorage already has keys — if so, no decryption needed.
      // Also skip the prompt when Web Crypto is unavailable (insecure origin) —
      // we cannot decrypt here, so prompting would only ever fail.
      if (hasAnySecretKeys() || !isEncryptionAvailable()) {
        // Local keys exist (or we can't decrypt anyway). Don't prompt.
      } else {
        // No local keys and backend has encrypted secrets → need decryption
        setNeedsDecryption(true)
      }
    }

    // Legacy: handle plaintext API keys from old preferences format
    // (will be cleared on first encrypted sync)
    if (!encrypted) {
      if (prefs.openrouterApiKey != null) setSettingsState('openrouterApiKey', prefs.openrouterApiKey as string)
      if (prefs.anthropicApiKey != null) setSettingsState('anthropicApiKey', prefs.anthropicApiKey as string)
      if (prefs.openaiApiKey != null) setSettingsState('openaiApiKey', prefs.openaiApiKey as string)
      if (prefs.cloudflareApiKey != null) setSettingsState('cloudflareApiKey', prefs.cloudflareApiKey as string)
    }

    // Mark that we've loaded from backend — now changes will sync back
    backendLoaded = true
  },

  // --- Encryption ---

  /** Whether the backend has encrypted secrets that need the user's password to decrypt. */
  needsDecryption,

  /**
   * Whether Web Crypto is usable here (secure context). When false, encrypted
   * key sync is disabled and keys stay device-local — used to hide the
   * encrypt/decrypt prompts on plain-HTTP origins.
   */
  isEncryptionAvailable,

  /**
   * Dismiss the decryption prompt for the rest of this session without decrypting.
   * Used when the user closes/skips the unlock dialog. The encrypted blob is kept
   * in memory so the prompt can be re-triggered later if needed.
   */
  dismissDecryption: () => setNeedsDecryption(false),

  /** Whether we currently have an encryption key in memory. */
  hasEncryptionKey: () => _encryptionKey !== null,

  /** Get the encryption salt (if one exists from the backend). */
  getEncryptionSalt: () => _encryptionSalt,

  /**
   * Set the encryption key (derived from user password).
   * If there are pending encrypted secrets from the backend, decrypts them immediately.
   * Throws if the password is wrong (AES-GCM authentication failure).
   */
  setEncryptionKey: async (key: CryptoKey) => {
    _encryptionKey = key

    // If we have pending encrypted secrets, try to decrypt them
    if (_pendingEncryptedSecrets) {
      const secrets = await decryptSecrets(key, _pendingEncryptedSecrets)
      // Apply decrypted keys to the store
      if (secrets.openrouterApiKey) setSettingsState('openrouterApiKey', secrets.openrouterApiKey)
      if (secrets.anthropicApiKey) setSettingsState('anthropicApiKey', secrets.anthropicApiKey)
      if (secrets.openaiApiKey) setSettingsState('openaiApiKey', secrets.openaiApiKey)
      if (secrets.cloudflareApiKey) setSettingsState('cloudflareApiKey', secrets.cloudflareApiKey)

      // Merge custom provider keys
      if (secrets.customProviderKeys) {
        setSettingsState('customProviders', (providers) =>
          providers.map((p) => ({
            ...p,
            apiKey: secrets.customProviderKeys?.[p.id] ?? p.apiKey,
          })),
        )
      }

      _pendingEncryptedSecrets = null
      setNeedsDecryption(false)
    }
  },

  /**
   * Derive an encryption key from a password (uses the stored salt or generates a new one).
   * Returns the derived CryptoKey. Does NOT store it — call setEncryptionKey after.
   */
  deriveKey: async (password: string): Promise<CryptoKey> => {
    if (!_encryptionSalt) {
      _encryptionSalt = generateSalt()
    }
    return cryptoDeriveKey(password, _encryptionSalt)
  },

  /**
   * Force re-encryption and sync to backend.
   * Call after setEncryptionKey when the user provides their password for the first time.
   */
  encryptAndSync: () => {
    scheduleSyncToBackend()
  },
}
