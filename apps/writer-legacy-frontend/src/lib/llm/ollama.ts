import axios from 'axios'
import { instructions } from '../ai-instructions.ts'
import { settingsState } from '../stores/settings.ts'
import type { LlmInterface } from './llm-interface'

export class Ollama implements LlmInterface {
  model?: string
  initialized = false

  async init() {
    if (this.initialized) {
      return
    }
    this.model = settingsState.aiModel ?? undefined
  }
  async listModels() {
    await this.init()
    const result = await axios.get('http://localhost:11434/api/tags')
    return result.data.models.map((m: { name: string }) => m.name)
  }
  async chat(
    kind: keyof typeof instructions,
    text: string,
    options?: {
      additionalInstructions?: string
    },
  ) {
    await this.init()
    const response = await axios.post(
      'http://localhost:11434/api/chat',
      {
        model: this.model ?? '',
        stream: false,
        messages: [
          {
            role: 'system',
            content: instructions[kind],
          },
          {
            role: 'user',
            content: options?.additionalInstructions ? `${options.additionalInstructions}\n\n${text}` : text,
          },
        ],
      },
      {
        timeout: 20000,
      },
    )
    return response.data.message.content
  }
}
