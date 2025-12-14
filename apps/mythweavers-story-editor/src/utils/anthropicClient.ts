import { settingsStore } from '../stores/settingsStore'

interface AnthropicMessage {
  role: 'user' | 'assistant' | 'system'
  content: string | Array<{
    type: 'text'
    text: string
    cache_control?: {
      type: 'ephemeral'
    }
  }>
}

interface AnthropicResponse {
  id: string
  type: string
  role: 'assistant'
  content: Array<{
    type: 'text'
    text: string
  }>
  model: string
  stop_reason: string | null
  stop_sequence: string | null
  usage: {
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
  }
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  cache_control?: {
    type: 'ephemeral'
  }
}

interface GenerateOptions {
  model: string
  prompt?: string // Keep for backward compatibility
  messages?: ChatMessage[]
  stream: boolean
  options?: {
    num_ctx?: number
  }
}

interface GenerateResponse {
  response?: string
  done?: boolean
  eval_count?: number
  prompt_eval_count?: number
  context?: any[]
  // Cache-related information
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
  // Error information
  error?: string
}

export class AnthropicClient {
  private apiKey: string
  private baseUrl = 'https://api.anthropic.com/v1'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  private prepareMessages(
    messages?: ChatMessage[],
    prompt?: string,
  ): { anthropicMessages: AnthropicMessage[]; systemContent: string | Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }> | '' } {
    const anthropicMessages: AnthropicMessage[] = []
    let systemContent: Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }> | string = ''

    if (messages && messages.length > 0) {
      for (const msg of messages) {
        if (msg.role === 'system') {
          if (msg.cache_control) {
            if (!msg.content || msg.content.trim() === '') {
              console.error('Empty system content with cache_control, ignoring cache hint')
              systemContent = msg.content || ''
            } else {
              systemContent = [{
                type: 'text',
                text: msg.content,
                cache_control: msg.cache_control
              }]
            }
          } else {
            systemContent = msg.content
          }
        } else if (msg.cache_control) {
          if (!msg.content || msg.content.trim() === '') {
            console.error(`Empty content with cache_control in ${msg.role} message, skipping cache_control`)
            anthropicMessages.push({
              role: msg.role as 'user' | 'assistant',
              content: msg.content || ''
            })
          } else {
            anthropicMessages.push({
              role: msg.role as 'user' | 'assistant',
              content: [{
                type: 'text',
                text: msg.content,
                cache_control: msg.cache_control
              }]
            })
          }
        } else {
          anthropicMessages.push({
            role: msg.role as 'user' | 'assistant',
            content: msg.content
          })
        }
      }
    } else if (prompt) {
      anthropicMessages.push({ role: 'user', content: prompt })
    }

    return { anthropicMessages, systemContent }
  }

  async list() {
    try {
      // Get the latest API key from settings
      const currentApiKey = settingsStore.anthropicApiKey
      if (!currentApiKey) {
        console.log('No Anthropic API key configured, returning empty model list')
        return { models: [] }
      }
      
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'x-api-key': currentApiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'prompt-caching-2024-07-31',
          'anthropic-dangerous-direct-browser-access': 'true'
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        console.error('Failed to fetch Anthropic models:', response.status, errorData)
        throw new Error(`Failed to fetch models: ${response.statusText}`)
      }

      const data = await response.json()
      console.log('Anthropic models response:', data)

      // Map the API response to our model format
      // Add pricing info based on model ID (since API doesn't return pricing)
      const pricingMap: Record<string, any> = {
        'claude-3-5-sonnet': {
          prompt: '0.000003',
          completion: '0.000015',
          input_cache_write: '0.00000375',
          input_cache_read: '0.0000003'
        },
        'claude-3-5-haiku': {
          prompt: '0.0000008',
          completion: '0.000004',
          input_cache_write: '0.000001',
          input_cache_read: '0.00000008'
        },
        'claude-3-opus': {
          prompt: '0.000015',
          completion: '0.000075',
          input_cache_write: '0.00001875',
          input_cache_read: '0.0000015'
        },
        'claude-3-haiku': {
          prompt: '0.00000025',
          completion: '0.00000125',
          input_cache_write: '0.0000003',
          input_cache_read: '0.000000025'
        },
        'claude-3-sonnet': {
          prompt: '0.000003',
          completion: '0.000015',
          input_cache_write: '0.00000375',
          input_cache_read: '0.0000003'
        }
      }

      const models = data.data.map((model: any) => {
        // Try to match pricing based on model ID prefix
        let pricing = null
        for (const [prefix, price] of Object.entries(pricingMap)) {
          if (model.id.startsWith(prefix)) {
            pricing = price
            break
          }
        }

        return {
          name: model.id,
          size: 0, // Not applicable
          digest: '', // Not applicable
          modified_at: model.created_at || new Date().toISOString(),
          context_length: 200000, // Default context length for Claude models
          pricing: pricing || {
            prompt: '0.000003',
            completion: '0.000015',
            input_cache_write: '0.00000375',
            input_cache_read: '0.0000003'
          },
          display_name: model.display_name
        }
      })

      return { models }
    } catch (error) {
      console.error('Error fetching Anthropic models:', error)
      // Return empty list on error instead of throwing
      return { models: [] }
    }
  }

  async *generate(options: GenerateOptions): AsyncGenerator<GenerateResponse> {
    // Get the latest API key from settings
    const currentApiKey = settingsStore.anthropicApiKey
    if (!currentApiKey) {
      throw new Error('Anthropic API key not configured. Please set your API key in settings.')
    }
    // Update the instance API key in case it changed
    this.apiKey = currentApiKey

    const { model, prompt, messages, stream, options: genOptions } = options

    // Convert messages to Anthropic format
    const { anthropicMessages, systemContent } = this.prepareMessages(messages, prompt)

    // Check if thinking should be enabled (Sonnet and Opus models support it)
    // Disable thinking for very small token budgets
    const maxTokens = genOptions?.num_ctx || 8192
    const isThinkingEnabled = (model.includes('sonnet') || model.includes('opus')) && maxTokens > 128
    
    const requestBody = {
      model: model,
      messages: anthropicMessages,
      max_tokens: maxTokens,
      temperature: isThinkingEnabled ? 1 : 0.7,
      stream: stream,
      ...(systemContent && { system: systemContent }),
      // Add thinking budget for models that support it
      // Only enable if we have enough tokens for the minimum budget (1024)
      ...(isThinkingEnabled && maxTokens >= 4096 && {
        thinking: {
          type: 'enabled' as const,
          budget_tokens: Math.max(1024, Math.floor(maxTokens / 4))
        }
      })
    }
    
    // Log cache control points for debugging
    const cachePoints: string[] = []
    if (typeof systemContent === 'object' && Array.isArray(systemContent)) {
      systemContent.forEach((block, i) => {
        if (block.cache_control) {
          cachePoints.push(`System block ${i}: ${block.text.substring(0, 50)}...`)
        }
      })
    }
    anthropicMessages.forEach((msg, i) => {
      if (Array.isArray(msg.content)) {
        msg.content.forEach((block, j) => {
          if (block.cache_control) {
            cachePoints.push(`${msg.role} message ${i} block ${j}: ${block.text.substring(0, 50)}...`)
          }
        })
      }
    })
    if (cachePoints.length > 0) {
      console.log('Anthropic cache control points:', cachePoints)
    }

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31,extended-cache-ttl-2025-04-11',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      let errorDetails = `${response.status} ${response.statusText}`
      try {
        const errorBody = await response.text()
        if (errorBody) {
          try {
            const errorJson = JSON.parse(errorBody)
            errorDetails += `\n\nDetails: ${errorJson.error?.message || errorJson.message || errorBody}`
          } catch {
            errorDetails += `\n\nResponse: ${errorBody}`
          }
        }
      } catch (e) {
        console.error('Failed to parse error response:', e)
      }
      throw new Error(`Anthropic API error: ${errorDetails}`)
    }

    if (stream) {
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let accumulatedText = ''
      let usage: any = null

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim()
              if (data === '[DONE]') continue

              try {
                const event = JSON.parse(data)
                
                // Debug logging for all event types
                if (event.type !== 'content_block_delta' && event.type !== 'ping') {
                  console.log('Anthropic SSE event:', event.type, event)
                }
                
                if (event.type === 'error') {
                  // Handle error events from Anthropic
                  const errorMessage = event.error?.message || 'Unknown error'
                  const errorType = event.error?.type || 'unknown_error'
                  console.error('Anthropic streaming error:', errorType, errorMessage)
                  
                  // Only add newlines if we've already accumulated some text
                  const prefix = accumulatedText.length > 0 ? '\n\n' : ''
                  
                  // Yield an error response that will be shown to the user
                  yield {
                    response: `${prefix}⚠️ Anthropic API Error: ${errorMessage}`,
                    done: true,
                    error: errorType // Add error type to response
                  }
                  
                  // If it's an overloaded error, provide helpful context
                  if (errorType === 'overloaded_error') {
                    yield {
                      response: '\n\nThe Anthropic API is currently overloaded. Please try again in a few moments.',
                      done: true,
                      error: errorType
                    }
                  }
                  
                  // Stop processing further events
                  return
                } else if (event.type === 'content_block_delta' && event.delta?.text) {
                  accumulatedText += event.delta.text
                  yield {
                    response: event.delta.text
                  }
                } else if (event.type === 'message_start' && event.message?.usage) {
                  // Initial usage data (including cache info) comes in message_start
                  usage = event.message.usage
                  console.log('Message start usage:', usage)
                } else if (event.type === 'message_delta' && event.usage) {
                  // Merge usage data from message_delta with existing usage
                  // message_start has cache info, message_delta has updated token counts
                  usage = {
                    ...usage,
                    ...event.usage,
                    // Preserve cache information from message_start
                    cache_creation_input_tokens: usage?.cache_creation_input_tokens || event.usage.cache_creation_input_tokens,
                    cache_read_input_tokens: usage?.cache_read_input_tokens || event.usage.cache_read_input_tokens
                  }
                } else if (event.type === 'message_stop') {
                  // Message has ended, usage should have been collected
                  console.log('Message stop event, final usage:', usage)
                }
              } catch (e) {
                console.error('Failed to parse SSE event:', e)
              }
            }
          }
        }
      } finally {
        reader.releaseLock()
      }

      // Yield final response with usage data (no content, just metadata)
      yield {
        done: true,
        eval_count: usage?.output_tokens || 0,
        prompt_eval_count: usage?.input_tokens || 0,
        cache_creation_input_tokens: usage?.cache_creation_input_tokens,
        cache_read_input_tokens: usage?.cache_read_input_tokens
      }
    } else {
      const data: AnthropicResponse = await response.json()
      const content = data.content[0]?.text || ''
      
      yield {
        response: content,
        done: true,
        eval_count: data.usage.output_tokens,
        prompt_eval_count: data.usage.input_tokens,
        cache_creation_input_tokens: data.usage.cache_creation_input_tokens,
        cache_read_input_tokens: data.usage.cache_read_input_tokens
      }
    }
  }

  async ps() {
    // Anthropic doesn't have a process status endpoint
    // Return empty to indicate no running processes
    return { models: [] }
  }

  async countTokens(messages: ChatMessage[], model: string): Promise<number> {
    // Ensure the latest API key is used
    const currentApiKey = settingsStore.anthropicApiKey
    if (!currentApiKey) {
      throw new Error('Anthropic API key not configured. Please set your API key in settings.')
    }
    this.apiKey = currentApiKey

    const { anthropicMessages, systemContent } = this.prepareMessages(messages)

    const requestBody: Record<string, unknown> = {
      model,
      messages: anthropicMessages,
    }

    if (systemContent) {
      requestBody.system = systemContent
    }

    const response = await fetch(`${this.baseUrl}/messages/count_tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31,extended-cache-ttl-2025-04-11',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      let errorDetails = `${response.status} ${response.statusText}`
      try {
        const errorBody = await response.text()
        if (errorBody) {
          try {
            const errorJson = JSON.parse(errorBody)
            errorDetails += `\n\nDetails: ${errorJson.error?.message || errorJson.message || errorBody}`
          } catch {
            errorDetails += `\n\nResponse: ${errorBody}`
          }
        }
      } catch (e) {
        console.error('Failed to parse error response:', e)
      }
      throw new Error(`Anthropic token count error: ${errorDetails}`)
    }

    const data = await response.json()
    return data.input_tokens ?? 0
  }
}

export const createAnthropicClient = (): AnthropicClient => {
  const apiKey = settingsStore.anthropicApiKey
  // Return a client even if API key is not set - we'll check when actually making requests
  return new AnthropicClient(apiKey || '')
}
