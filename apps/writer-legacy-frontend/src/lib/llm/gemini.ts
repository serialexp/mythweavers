import { unwrap } from 'solid-js/store'
import { instructions } from '../ai-instructions.ts'
import { settingsState } from '../stores/settings.ts'
import type { LlmInterface } from './llm-interface'

export class Gemini implements LlmInterface {
  apiKey?: string
  model?: string
  initialized = false

  async init() {
    if (this.initialized) {
      return
    }
    const key = unwrap(settingsState).geminiKey
    this.model = unwrap(settingsState).aiModel ?? undefined
    if (!key) {
      throw new Error('No Gemini key set')
    }
    this.apiKey = key
    this.initialized = true
  }

  async listModels() {
    await this.init()
    return [
      'gemini-2.5-flash-preview-04-17',
      'gemini-2.5-pro-preview-05-06',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-1.5-flash',
      'gemini-2.5-pro-exp-03-25',
      'gemini-1.5-pro',
    ]
  }

  async chat(
    kind: keyof typeof instructions,
    text: string,
    options?: {
      additionalInstructions?: string
    },
  ) {
    await this.init()
    if (!this.apiKey) {
      throw new Error('Not initialized yet')
    }

    const model = this.model || 'gemini-2.5-pro-exp-03-25'
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`

    const systemPrompt = options?.additionalInstructions
      ? `${instructions[kind]}\n\n${options.additionalInstructions}`
      : instructions[kind]

    const requestBody = {
      contents: [
        {
          parts: [{ text: systemPrompt }, { text: text }],
        },
      ],
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 2000,
      },
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Gemini API error: ${JSON.stringify(errorData)}`)
      }

      const data = await response.json()

      if (
        data.candidates &&
        data.candidates.length > 0 &&
        data.candidates[0].content &&
        data.candidates[0].content.parts &&
        data.candidates[0].content.parts.length > 0
      ) {
        return data.candidates[0].content.parts[0].text
      }

      throw new Error('Unexpected response format from Gemini API')
    } catch (error) {
      console.error('Error calling Gemini API:', error)
      throw error
    }
  }
}
