import { createStore } from 'solid-js/store'
import { createAnthropicClient } from '../utils/anthropicClient'
import { effectiveSettings } from './effectiveSettingsStore'

interface CopyPreviewState {
  isOpen: boolean
  isLoading: boolean
  tokens: number | null
  error: string | null
  text: string
  showFallback: boolean
  contextProgress: { completed: number; total: number } | null
}

const [copyPreviewState, setCopyPreviewState] = createStore<CopyPreviewState>({
  isOpen: false,
  isLoading: false,
  tokens: null,
  error: null,
  text: '',
  showFallback: false,
  contextProgress: null,
})

const resetState = () => {
  setCopyPreviewState({
    isOpen: false,
    isLoading: false,
    tokens: null,
    error: null,
    text: '',
    showFallback: false,
    contextProgress: null,
  })
}

const copyTextToClipboard = async (text: string) => {
  if (!navigator.clipboard) {
    throw new Error('Clipboard access is not available in this browser.')
  }
  await navigator.clipboard.writeText(text)
}

export const copyPreviewStore = {
  get state() {
    return copyPreviewState
  },

  beginContextPreparation(total: number) {
    setCopyPreviewState({
      isOpen: true,
      isLoading: true,
      tokens: null,
      error: null,
      text: '',
      showFallback: false,
      contextProgress: { completed: 0, total },
    })
  },

  updateContextPreparation(completed: number, total: number) {
    setCopyPreviewState('contextProgress', { completed, total })
  },

  finishContextPreparation() {
    if (copyPreviewState.contextProgress) resetState()
  },

  async requestCopy(text: string): Promise<boolean> {
    const trimmed = text.trim()
    if (!trimmed) {
      return false
    }

    const provider = effectiveSettings.provider
    if (provider !== 'anthropic') {
      try {
        await copyTextToClipboard(trimmed)
        return true
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Unable to copy text to clipboard.')
        return false
      }
    }

    setCopyPreviewState({
      isOpen: true,
      isLoading: true,
      tokens: null,
      error: null,
      text: trimmed,
      contextProgress: null,
    })

    try {
      const model = effectiveSettings.model
      if (!model) {
        throw new Error('Please select a Claude model before copying.')
      }

      const client = createAnthropicClient()
      const tokens = await client.countTokens(
        [
          {
            role: 'user',
            content: trimmed,
          },
        ],
        model,
      )

      setCopyPreviewState('tokens', tokens)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Token counting failed. You can still copy the text.'
      setCopyPreviewState('error', message)
    } finally {
      setCopyPreviewState('isLoading', false)
    }

    return false
  },

  async confirmCopy() {
    try {
      await copyTextToClipboard(copyPreviewState.text)
      resetState()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to copy text to clipboard.'
      setCopyPreviewState('error', message)
      setCopyPreviewState('showFallback', true)
    }
  },

  showFallbackDialog(text: string) {
    setCopyPreviewState({
      isOpen: true,
      isLoading: false,
      tokens: null,
      error: null,
      text,
      showFallback: true,
      contextProgress: null,
    })
  },

  cancel() {
    resetState()
  },
}
