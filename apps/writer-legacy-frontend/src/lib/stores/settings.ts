import { load } from '@tauri-apps/plugin-store'
import debounce from 'debounce'
import { createStore } from 'solid-js/store'
import type { LLMName } from '../llm'

export interface ServerAuth {
  url: string
  token: string
}

export interface SettingsState {
  clientToken: string // Legacy field, kept for backward compatibility
  openaiKey: string
  groqKey: string
  cerebrasKey: string
  anthropicKey: string
  geminiKey: string
  serverUrl: string
  serverAuths: ServerAuth[] // New field to store auth per server
  aiSource: LLMName | ''
  imageAiSource: 'openai' | ''
  aiModel: string
  royalRoadEmail: string
  royalRoadPassword: string
  recentStories: { name: string; path: string }[]
}

const initialSettings: SettingsState = {
  clientToken: '',
  openaiKey: '',
  groqKey: '',
  cerebrasKey: '',
  anthropicKey: '',
  geminiKey: '',
  serverUrl: 'https://writer.serial-experiments.com/trpc',
  serverAuths: [],
  aiSource: '',
  imageAiSource: '',
  aiModel: '',
  royalRoadEmail: '',
  royalRoadPassword: '',
  recentStories: [],
}

export const [settingsState, setSettingsState] = createStore(initialSettings)

export const resetSettingsState = () => {
  setSettingsState({ ...initialSettings })
}

export const tauriSettingsStore = await load('global-settings.bin')

const debounceSave = debounce(() => {
  tauriSettingsStore.save()
}, 1000)

const setSetting = <T extends keyof SettingsState>(key: T, value: SettingsState[T]) => {
  setSettingsState(key, value)
  tauriSettingsStore.set(key, value)
  debounceSave()
}

const setSettings = (settings: SettingsState) => {
  setSettingsState(settings)
  for (const key of Object.keys(settings)) {
    tauriSettingsStore.set(key, settings[key as keyof SettingsState])
  }
  // when we set the whole store at once, we can save immediately (as additional events of the same kind are unlikely)
  tauriSettingsStore.save()
}

// Helper function to get the token for a specific server URL
export const getTokenForServer = (url: string): string => {
  const auth = settingsState.serverAuths.find((auth) => auth.url === url)
  return auth?.token || ''
}

// Helper function to set the token for a specific server URL
export const setTokenForServer = (url: string, token: string) => {
  const currentAuths = [...settingsState.serverAuths]
  const existingIndex = currentAuths.findIndex((auth) => auth.url === url)

  if (existingIndex >= 0) {
    // Update existing auth
    currentAuths[existingIndex] = { url, token }
  } else {
    // Add new auth
    currentAuths.push({ url, token })
  }

  setSetting('serverAuths', currentAuths)

  // Also update the legacy clientToken if this is the current server
  if (url === settingsState.serverUrl) {
    setSetting('clientToken', token)
  }
}

export { setSetting, setSettings }
