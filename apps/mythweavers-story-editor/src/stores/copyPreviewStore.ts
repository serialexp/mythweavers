import { createStore } from 'solid-js/store'
import { createAnthropicClient } from '../utils/anthropicClient'
import { settingsStore } from './settingsStore'

interface CopyPreviewState {
  isOpen: boolean
  isLoading: boolean
  tokens: number | null
  error: string | null
  text: string
  showFallback: boolean
}

const [copyPreviewState, setCopyPreviewState] = createStore<CopyPreviewState>({
  isOpen: false,
  isLoading: false,
  tokens: null,
  error: null,
  text: '',
  showFallback: false,
})

const resetState = () => {
  setCopyPreviewState({
    isOpen: false,
    isLoading: false,
    tokens: null,
    error: null,
    text: '',
    showFallback: false,
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

  async requestCopy(text: string): Promise<boolean> {
    const trimmed = text.trim()
    if (!trimmed) {
      return false
    }

    const provider = settingsStore.provider
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
    })

    try {
      const model = settingsStore.model
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
    })
  },

  cancel() {
    resetState()
  },
}
