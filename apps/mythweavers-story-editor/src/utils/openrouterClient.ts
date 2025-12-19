import { settingsStore } from '../stores/settingsStore'

interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system'
  content:
    | string
    | Array<{
        type: 'text'
        text: string
        cache_control?: {
          type: 'ephemeral'
          ttl?: '5m' | '1h' // Optional TTL, defaults to 5m
        }
      }>
  cache_control?: {
    type: 'ephemeral'
    ttl?: '5m' | '1h' // Optional TTL, defaults to 5m
  }
}

interface OpenRouterResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message?: {
      role: string
      content: string
    }
    delta?: {
      content?: string
    }
    finish_reason: string | null
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
    // Cache-related token counts
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
  }
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  cache_control?: {
    type: 'ephemeral'
    ttl?: '5m' | '1h' // Optional TTL, defaults to 5m
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
}

// Global storage for debugging
let lastOpenRouterRequest: any = null
let lastOpenRouterMessages: any[] = []

export const getLastOpenRouterDebugInfo = () => ({
  request: lastOpenRouterRequest,
  messagesWithCache: lastOpenRouterMessages,
})

export class OpenRouterClient {
  private apiKey: string
  private baseUrl = 'https://openrouter.ai/api/v1'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async list() {
    let response: Response
    try {
      response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Story App',
        },
      })
    } catch (error) {
      console.error('OpenRouter fetch error:', error)
      throw new Error(`Failed to connect to OpenRouter: ${error instanceof Error ? error.message : 'Network error'}`)
    }

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
      throw new Error(`OpenRouter API error: ${errorDetails}`)
    }

    const data = await response.json()

    // Sort models by provider (extracted from model ID), then by recency (created date)
    const sortedModels = data.data.sort((a: any, b: any) => {
      // Extract provider from model ID (e.g., "openai/gpt-4" -> "openai")
      const providerA = a.id.split('/')[0] || a.id
      const providerB = b.id.split('/')[0] || b.id

      // First sort by provider name
      if (providerA !== providerB) {
        return providerA.localeCompare(providerB)
      }

      // Then sort by recency (newer first)
      const createdA = a.created || 0
      const createdB = b.created || 0
      return createdB - createdA
    })

    return {
      models: sortedModels.map((model: any) => ({
        name: model.id,
        size: 0, // OpenRouter doesn't provide size info
        digest: '', // Not applicable for OpenRouter
        modified_at: model.created ? new Date(model.created * 1000).toISOString() : new Date().toISOString(),
        context_length: model.context_length || 4096,
        pricing: model.pricing
          ? {
              prompt: model.pricing.prompt,
              completion: model.pricing.completion,
              request: model.pricing.request,
              image: model.pricing.image,
              input_cache_read: model.pricing.input_cache_read,
              input_cache_write: model.pricing.input_cache_write,
            }
          : undefined,
      })),
    }
  }

  async *generate(options: GenerateOptions): AsyncGenerator<GenerateResponse> {
    const { model, prompt, messages, stream, options: genOptions } = options

    // Debug: Log what we received
    console.log('OpenRouter generate called with:', {
      model,
      hasPrompt: !!prompt,
      hasMessages: !!messages,
      messageCount: messages?.length,
    })

    // Use either messages or convert prompt to messages for backward compatibility
    const chatMessages: OpenRouterMessage[] = messages
      ? messages.map((msg) => {
          // For Anthropic models, always use multipart content format
          // This is required for cache control to work properly
          if (model.includes('anthropic')) {
            return {
              role: msg.role,
              content: [
                {
                  type: 'text',
                  text: msg.content,
                  ...(msg.cache_control && { cache_control: msg.cache_control }),
                },
              ],
            }
          }
          // For other models with cache control, include it at message level
          if (msg.cache_control) {
            return {
              role: msg.role,
              content: msg.content,
              cache_control: msg.cache_control,
            }
          }
          // For messages without cache control
          return {
            role: msg.role,
            content: msg.content,
          }
        })
      : [{ role: 'user', content: prompt || '' }]

    const requestBody: any = {
      model: model,
      messages: chatMessages,
      stream: stream,
      max_tokens: genOptions?.num_ctx || 4096,
      temperature: 0.7,
      // Enable usage tracking to get cache information
      usage: {
        include: true,
      },
    }

    // Note: OpenRouter doesn't support Anthropic beta features like extended cache TTL

    // Only store debug info for story generation (multiple messages), not summarization (single message)
    const isStoryGeneration = chatMessages.length > 2 // Story gen has system + history + context + instruction
    if (isStoryGeneration) {
      lastOpenRouterRequest = JSON.parse(JSON.stringify(requestBody)) // Deep copy
      lastOpenRouterMessages = chatMessages
        .filter(
          (msg) => msg.cache_control || (Array.isArray(msg.content) && msg.content.some((c: any) => c.cache_control)),
        )
        .map((msg) => ({
          role: msg.role,
          hasCache: true,
          contentLength: typeof msg.content === 'string' ? msg.content.length : msg.content[0]?.text?.length || 0,
          cacheControl: msg.cache_control || (Array.isArray(msg.content) ? msg.content[0]?.cache_control : null),
        }))
    }

    // Debug logging for cache control
    console.log('OpenRouter request body:', JSON.stringify(requestBody, null, 2))
    console.log('Messages with cache control:', lastOpenRouterMessages)
    console.log('Total messages:', chatMessages.length)
    console.log(
      'Cache control summary:',
      chatMessages.map((msg, i) => ({
        index: i,
        role: msg.role,
        contentType: Array.isArray(msg.content) ? 'multipart' : 'string',
        hasCache: !!(msg.cache_control || (Array.isArray(msg.content) && msg.content[0]?.cache_control)),
      })),
    )

    let response: Response
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Story App',
        },
        body: JSON.stringify(requestBody),
      })
    } catch (error) {
      console.error('OpenRouter fetch error:', error)
      throw new Error(`Failed to connect to OpenRouter: ${error instanceof Error ? error.message : 'Network error'}`)
    }

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
      throw new Error(`OpenRouter API error: ${errorDetails}`)
    }

    if (stream) {
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let totalTokens = 0
      let promptTokens = 0
      let cacheCreationTokens: number | undefined
      let cacheReadTokens: number | undefined

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
              if (data === '[DONE]') {
                yield {
                  done: true,
                  eval_count: totalTokens,
                  prompt_eval_count: promptTokens,
                  cache_creation_input_tokens: cacheCreationTokens,
                  cache_read_input_tokens: cacheReadTokens,
                }
                return
              }

              try {
                const parsed: OpenRouterResponse = JSON.parse(data)
                const choice = parsed.choices[0]

                if (choice?.delta?.content) {
                  totalTokens++
                  yield {
                    response: choice.delta.content,
                  }
                }

                if (parsed.usage) {
                  promptTokens = parsed.usage.prompt_tokens
                  totalTokens = parsed.usage.completion_tokens
                  cacheCreationTokens = parsed.usage.cache_creation_input_tokens
                  cacheReadTokens = parsed.usage.cache_read_input_tokens

                  // Debug cache information
                  if (cacheCreationTokens || cacheReadTokens) {
                    console.log('Cache tokens detected:', { cacheCreationTokens, cacheReadTokens })
                  }
                }
              } catch (_e) {}
            }
          }
        }
      } finally {
        reader.releaseLock()
      }
    } else {
      const data: OpenRouterResponse = await response.json()
      console.log('OpenRouter non-streaming response:', JSON.stringify(data, null, 2))
      const content = data.choices[0]?.message?.content || ''
      yield {
        response: content,
        done: true,
        eval_count: data.usage?.completion_tokens || 0,
        prompt_eval_count: data.usage?.prompt_tokens || 0,
        cache_creation_input_tokens: data.usage?.cache_creation_input_tokens,
        cache_read_input_tokens: data.usage?.cache_read_input_tokens,
      }
    }
  }

  async ps() {
    // OpenRouter doesn't have a process status endpoint
    // Return empty to indicate no running processes
    return { models: [] }
  }
}

export const createOpenRouterClient = (): OpenRouterClient => {
  const apiKey = settingsStore.openrouterApiKey
  if (!apiKey) {
    throw new Error('OpenRouter API key not configured')
  }
  return new OpenRouterClient(apiKey)
}
