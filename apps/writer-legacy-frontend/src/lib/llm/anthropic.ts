import { Anthropic as AnthropicAPI } from '@anthropic-ai/sdk'
import { unwrap } from 'solid-js/store'
import { instructions } from '../ai-instructions.ts'
import { settingsState } from '../stores/settings.ts'
import { setLastGenerationUsage } from '../stores/ui.ts'
import type { LlmInterface } from './llm-interface'

export class Anthropic implements LlmInterface {
  api?: AnthropicAPI
  model?: string
  initialized = false

  async init() {
    if (this.initialized) {
      return
    }
    const key = unwrap(settingsState).anthropicKey
    this.model = unwrap(settingsState).aiModel ?? undefined
    if (!key) {
      throw new Error('No anthropic key set')
    }
    this.api = new AnthropicAPI({
      apiKey: key,
      timeout: 60000,
      dangerouslyAllowBrowser: true,
    })
  }
  async listModels() {
    await this.init()
    return [
      'claude-opus-4-0',
      'claude-sonnet-4-0',
      'claude-opus-4-20250514',
      'claude-sonnet-4-20250514',
      'claude-3-7-sonnet-latest',
      'claude-3-5-sonnet-latest',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-sonnet-20240620',
      'claude-3-opus-latest',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
      'claude-2.1',
      'claude-2.0',
      'claude-instant-1.2',
    ]
  }
  async chat(
    kind: keyof typeof instructions,
    text: string | { text: string; canCache: boolean }[],
    options?: {
      additionalInstructions?: string
    },
  ) {
    await this.init()
    if (!this.api) {
      throw new Error('Not initialized yet')
    }

    const messages = Array.isArray(text)
      ? text.map((t) =>
          t.canCache
            ? {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: t.text,
                    cache_control: { type: 'ephemeral', ttl: '1h' },
                  },
                ],
              }
            : {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: t.text,
                  },
                ],
              },
        )
      : [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text,
              },
            ],
          },
        ]

    console.log('messages', messages)

    const result = await this.api.beta.messages.create({
      system: options?.additionalInstructions
        ? [
            {
              type: 'text',
              text: instructions[kind],
            },
            {
              type: 'text',
              text: options?.additionalInstructions ?? '',
            },
          ]
        : [
            {
              type: 'text',
              text: instructions[kind],
            },
          ],
      messages: messages,
      max_tokens: 3000,
      temperature: 1.0,
      betas: ['extended-cache-ttl-2025-04-11'],
      model: this.model ?? '',
    })

    console.log('anthropic result usage', result.usage)
    setLastGenerationUsage(result.usage as unknown as Record<string, number>)
    return result.content[0].type === 'text' ? result.content[0].text : ''
  }
}
