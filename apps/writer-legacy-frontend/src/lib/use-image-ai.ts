import { unwrap } from 'solid-js/store'
import { OpenAI } from './llm/openai'
import { addNotification } from './stores/notifications'
import { settingsState } from './stores/settings'

let openaiInstance: OpenAI | null = null

async function getOpenAIInstance(): Promise<OpenAI> {
  if (!openaiInstance) {
    openaiInstance = new OpenAI()
    await openaiInstance.init()
  }
  return openaiInstance
}

export interface ImageGenerationResult {
  imageBase64: string
  responseId: string
  dataUrl: string // data:image/png;base64,{imageBase64}
}

export interface ImageGenerationOptions {
  model?: string
  basedOnPrevious?: boolean
}

/**
 * Generate an image using OpenAI's image generation API
 * @param prompt The text prompt for image generation
 * @param options Configuration options including whether to base on previous generation
 * @returns Promise with image data and metadata
 */
export async function useImageAi(prompt: string, options: ImageGenerationOptions = {}): Promise<ImageGenerationResult> {
  const imageAiSource = unwrap(settingsState).imageAiSource

  if (!imageAiSource) {
    throw new Error('No image generation provider selected. Please select an image AI provider in settings.')
  }

  if (imageAiSource !== 'openai') {
    throw new Error('Image generation is currently only supported with OpenAI')
  }

  try {
    const openai = await getOpenAIInstance()
    const result = await openai.generateImage(prompt, options)

    return {
      imageBase64: result.imageBase64,
      responseId: result.responseId,
      dataUrl: `data:image/png;base64,${result.imageBase64}`,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    addNotification({
      type: 'error',
      title: 'Image Generation Failed',
      message: errorMessage,
    })
    throw error
  }
}

/**
 * Check if there's an image generation history for follow-up generations
 */
export async function hasImageHistory(): Promise<boolean> {
  if (unwrap(settingsState).imageAiSource !== 'openai') {
    return false
  }

  try {
    const openai = await getOpenAIInstance()
    return openai.hasImageHistory()
  } catch {
    return false
  }
}

/**
 * Clear the image generation history
 */
export async function clearImageHistory(): Promise<void> {
  if (unwrap(settingsState).imageAiSource !== 'openai') {
    return
  }

  try {
    const openai = await getOpenAIInstance()
    openai.clearImageHistory()
  } catch (error) {
    console.warn('Failed to clear image history:', error)
  }
}
