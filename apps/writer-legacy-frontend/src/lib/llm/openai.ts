import { OpenAI as OpenAIAPI } from 'openai'
import { unwrap } from 'solid-js/store'
import { instructions } from '../ai-instructions.ts'
import { settingsState } from '../stores/settings.ts'
import type { LlmInterface } from './llm-interface'

export class OpenAI implements LlmInterface {
  api?: OpenAIAPI
  model?: string
  initialized = false
  lastImageResponseId?: string

  async init() {
    if (this.initialized) {
      return
    }
    const key = unwrap(settingsState).openaiKey
    this.model = unwrap(settingsState).aiModel ?? undefined
    if (!key) {
      throw new Error('No openai key set')
    }
    this.api = new OpenAIAPI({
      apiKey: key,
      timeout: 30000,
      dangerouslyAllowBrowser: true,
    })
    this.initialized = true
  }

  async listModels() {
    await this.init()
    if (!this.api) {
      throw new Error('Not initialized yet')
    }
    const result = await this.api.models.list()
    return result.data.map((m) => m.id)
  }

  async chat(
    kind: keyof typeof instructions,
    text: string,
    options?: {
      additionalInstructions?: string
    },
  ) {
    await this.init()
    if (!this.api) {
      throw new Error('Not initialized yet')
    }
    const result = await this.api.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: instructions[kind],
        },
        {
          role: 'user',
          content: options?.additionalInstructions ? `${options?.additionalInstructions}\n\n${text}` : text,
        },
      ],
      max_completion_tokens: 2000,
      temperature: 1,
      model: this.model ?? '',
    })

    return result.choices[0].message.content ?? ''
  }

  async generateImage(
    prompt: string,
    options?: {
      model?: string
      basedOnPrevious?: boolean
    },
  ): Promise<{ imageBase64: string; responseId: string }> {
    await this.init()
    if (!this.api) {
      throw new Error('Not initialized yet')
    }

    const model = options?.model || 'gpt-4.1-mini'

    const requestParams: any = {
      model: model,
      input: prompt,
      tools: [{ type: 'image_generation' }],
    }

    // If we want to base on previous and have a previous response ID, include it
    if (options?.basedOnPrevious && this.lastImageResponseId) {
      requestParams.previous_response_id = this.lastImageResponseId
    }

    try {
      // Cast to any since this is a newer API endpoint that might not be in current types
      const response = await (this.api as any).responses.create(requestParams)

      // Store the response ID for potential follow-up generations
      this.lastImageResponseId = response.id

      // Extract image data from the response
      const imageData = response.output
        .filter((output: any) => output.type === 'image_generation_call')
        .map((output: any) => output.result)

      if (imageData.length === 0) {
        throw new Error('No image generated in response')
      }

      return {
        imageBase64: imageData[0],
        responseId: response.id,
      }
    } catch (error) {
      console.error('Image generation failed:', error)
      throw new Error(`Image generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  clearImageHistory() {
    this.lastImageResponseId = undefined
  }

  hasImageHistory(): boolean {
    return !!this.lastImageResponseId
  }
}
