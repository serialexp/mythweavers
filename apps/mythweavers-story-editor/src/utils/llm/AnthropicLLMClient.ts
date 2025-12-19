import { settingsStore } from '../../stores/settingsStore'
import { LLMGenerateOptions, LLMGenerateResponse, LLMMessage, LLMModel, ModelPricing } from '../../types/llm'
import { BaseLLMClient } from './BaseLLMClient'

interface AnthropicMessage {
  role: 'user' | 'assistant' | 'system'
  content: Array<{
    type: 'text'
    text: string
    cache_control?: {
      type: 'ephemeral'
      ttl?: '5m' | '1h'
    }
  }>
}

export class AnthropicLLMClient extends BaseLLMClient {
  protected provider = 'anthropic'

  async list(): Promise<{ models: LLMModel[] }> {
    try {
      const apiKey = settingsStore.anthropicApiKey
      if (!apiKey) {
        console.log('No Anthropic API key configured, returning empty model list')
        return { models: [] }
      }

      this.log('Fetching models from Anthropic...')

      const response = await fetch('https://api.anthropic.com/v1/models', {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'prompt-caching-2024-07-31,extended-cache-ttl-2025-04-11',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        this.logError('Failed to fetch models:', response.status, errorData)
        throw new Error(`Failed to fetch models: ${response.statusText}`)
      }

      const data = await response.json()
      this.log('Models response:', data)

      // Pricing map for different models (prices per million tokens)
      const pricingMap: Record<string, ModelPricing> = {
        // Claude Opus 4.1
        'claude-opus-4-1-20250805': {
          input: 15,
          output: 75,
          input_cache_write: 18.75,
          input_cache_read: 1.5,
        },
        // Claude Opus 4
        'claude-opus-4-20250514': {
          input: 15,
          output: 75,
          input_cache_write: 18.75,
          input_cache_read: 1.5,
        },
        // Claude Sonnet 4
        'claude-sonnet-4-20250514': {
          input: 3,
          output: 15,
          input_cache_write: 3.75,
          input_cache_read: 0.3,
        },
        // Claude Sonnet 3.7
        'claude-3-7-sonnet-20250219': {
          input: 3,
          output: 15,
          input_cache_write: 3.75,
          input_cache_read: 0.3,
        },
        'claude-3-7-sonnet-latest': {
          input: 3,
          output: 15,
          input_cache_write: 3.75,
          input_cache_read: 0.3,
        },
        // Claude Haiku 3.5
        'claude-3-5-haiku-20241022': {
          input: 0.8,
          output: 4,
          input_cache_write: 1,
          input_cache_read: 0.08,
        },
        'claude-3-5-haiku-latest': {
          input: 0.8,
          output: 4,
          input_cache_write: 1,
          input_cache_read: 0.08,
        },
        // Claude Sonnet 3.5 v2
        'claude-3-5-sonnet-20241022': {
          input: 3,
          output: 15,
          input_cache_write: 3.75,
          input_cache_read: 0.3,
        },
        'claude-3-5-sonnet-latest': {
          input: 3,
          output: 15,
          input_cache_write: 3.75,
          input_cache_read: 0.3,
        },
        // Claude Sonnet 3.5
        'claude-3-5-sonnet-20240620': {
          input: 3,
          output: 15,
          input_cache_write: 3.75,
          input_cache_read: 0.3,
        },
        // Claude Haiku 3
        'claude-3-haiku-20240307': {
          input: 0.25,
          output: 1.25,
          input_cache_write: 0.3,
          input_cache_read: 0.03,
        },
        // Legacy patterns for backward compatibility
        'claude-sonnet-4': {
          input: 3,
          output: 15,
          input_cache_write: 3.75,
          input_cache_read: 0.3,
        },
        'claude-opus-4': {
          input: 15,
          output: 75,
          input_cache_write: 18.75,
          input_cache_read: 1.5,
        },
        'claude-3-5-sonnet': {
          input: 3,
          output: 15,
          input_cache_write: 3.75,
          input_cache_read: 0.3,
        },
        'claude-3-5-haiku': {
          input: 0.8,
          output: 4,
          input_cache_write: 1,
          input_cache_read: 0.08,
        },
        'claude-3-opus': {
          input: 15,
          output: 75,
          input_cache_write: 18.75,
          input_cache_read: 1.5,
        },
        'claude-3-haiku': {
          input: 0.25,
          output: 1.25,
          input_cache_write: 0.3,
          input_cache_read: 0.03,
        },
      }

      // Map response to our model format
      const models: LLMModel[] = data.data.map((model: any) => {
        // Find pricing - try exact match first, then pattern matching
        let pricing = pricingMap[model.id]

        if (!pricing) {
          // Fall back to pattern matching for partial matches
          for (const [key, value] of Object.entries(pricingMap)) {
            if (model.id.includes(key)) {
              pricing = value
              break
            }
          }
        }

        return {
          name: model.id,
          context_length: model.max_tokens || 200000,
          description: model.display_name || model.id,
          pricing: pricing,
        }
      })

      this.log(`Found ${models.length} models`)
      return { models }
    } catch (error) {
      this.logError('Error fetching models:', error)
      // Return empty list on error instead of throwing
      return { models: [] }
    }
  }

  async *generate(options: LLMGenerateOptions): AsyncGenerator<LLMGenerateResponse> {
    const { model, messages, max_tokens } = options
    const apiKey = settingsStore.anthropicApiKey

    if (!apiKey) {
      throw new Error('Anthropic API key not configured')
    }

    try {
      const anthropicMessages = this.formatMessages(messages)
      const systemMessage = anthropicMessages.find((m) => m.role === 'system')
      const nonSystemMessages = anthropicMessages.filter((m) => m.role !== 'system')

      // Check if thinking should be enabled (Sonnet and Opus models support it)
      const maxTokens = max_tokens || 4096

      const requestBody: any = {
        model,
        messages: nonSystemMessages,
        system: systemMessage?.content,
        max_tokens: maxTokens,
        temperature: options.temperature ?? 1,
        stream: true,
      }

      // Add thinking budget if specified
      if (options.thinking_budget && options.thinking_budget > 0) {
        requestBody.thinking = {
          type: 'enabled',
          budget_tokens: options.thinking_budget,
        }
      }

      this.log('Request:', { model, messageCount: messages.length })

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'prompt-caching-2024-07-31,extended-cache-ttl-2025-04-11',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify(requestBody),
        signal: options.signal,
      })

      if (!response.ok) {
        const errorText = await response.text()
        this.logError('API error:', response.status, errorText)
        throw new Error(`Anthropic API error: ${response.status} ${errorText}`)
      }

      // Always use streaming for this implementation
      yield* this.handleStream(response)
    } catch (error) {
      this.handleError(error)
    }
  }

  protected formatMessages(messages: LLMMessage[]): AnthropicMessage[] {
    return messages.map((msg) => {
      const contentBlock: AnthropicMessage['content'][number] = {
        type: 'text',
        text: msg.content,
      }

      if (msg.cache_control) {
        const cacheControl: { type: 'ephemeral'; ttl?: '5m' | '1h' } = {
          type: 'ephemeral',
        }
        if (typeof msg.cache_control.ttl === 'number') {
          cacheControl.ttl = msg.cache_control.ttl >= 3600 ? '1h' : '5m'
        } else if (msg.cache_control.ttl === '5m' || msg.cache_control.ttl === '1h') {
          cacheControl.ttl = msg.cache_control.ttl
        }
        contentBlock.cache_control = cacheControl
      }

      return {
        role: msg.role as any,
        content: [contentBlock],
      }
    })
  }

  protected parseResponse(data: any): LLMGenerateResponse {
    // Log the event type for debugging
    this.log('Parsing response type:', data.type)

    if (data.type === 'message_start') {
      // Start of stream - may contain initial usage data
      if (data.message?.usage) {
        this.log('message_start usage data:', data.message.usage)
      }
      return {
        response: '',
        done: false,
        usage: data.message?.usage
          ? {
              prompt_tokens: data.message.usage.input_tokens,
              completion_tokens: data.message.usage.output_tokens,
              total_tokens: (data.message.usage.input_tokens || 0) + (data.message.usage.output_tokens || 0),
              cache_creation_input_tokens: data.message.usage.cache_creation_input_tokens,
              cache_read_input_tokens: data.message.usage.cache_read_input_tokens,
              cache_creation: data.message.usage.cache_creation ? { ...data.message.usage.cache_creation } : undefined,
            }
          : undefined,
      }
    }
    if (data.type === 'content_block_start') {
      // Start of content block
      return { response: '', done: false }
    }
    if (data.type === 'content_block_delta') {
      // Streaming chunk with actual content
      return {
        response: data.delta?.text || '',
        done: false,
      }
    }
    if (data.type === 'content_block_stop') {
      // End of content block
      return { response: '', done: false }
    }
    if (data.type === 'message_delta') {
      // Usage info in stream - check if message is complete
      const isDone = data.delta?.stop_reason !== null && data.delta?.stop_reason !== undefined

      // Log the usage data for debugging
      if (data.usage) {
        this.log('message_delta usage data:', data.usage)
      }

      return {
        response: '',
        done: isDone,
        usage: data.usage
          ? {
              prompt_tokens: data.usage.input_tokens,
              completion_tokens: data.usage.output_tokens,
              total_tokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
              cache_creation_input_tokens: data.usage.cache_creation_input_tokens,
              cache_read_input_tokens: data.usage.cache_read_input_tokens,
              cache_creation: data.usage.cache_creation ? { ...data.usage.cache_creation } : undefined,
            }
          : undefined,
      }
    }
    if (data.type === 'message_stop') {
      // End of message
      return { response: '', done: true }
    }

    // Log unknown types
    this.logError('Unknown response type:', data.type, data)
    return { response: '', done: false }
  }

  private async *handleStream(response: Response): AsyncGenerator<LLMGenerateResponse> {
    let eventCount = 0
    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            eventCount++

            // Log first 10 events for debugging
            if (eventCount <= 10) {
              this.log(`Event ${eventCount}:`, parsed)
            }

            yield this.parseResponse(parsed)
          } catch (e) {
            this.logError('Failed to parse streaming response:', e)
          }
        }
      }
    }
  }
}
