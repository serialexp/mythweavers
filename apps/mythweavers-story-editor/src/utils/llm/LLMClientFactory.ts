import { llmActivityStore } from '../../stores/llmActivityStore'
import type { TokenUsage } from '../../types/core'
import { LLMClient, LLMGenerateOptions, LLMGenerateResponse, LLMProvider, convertToTokenUsage } from '../../types/llm'
import { generateMessageId } from '../id'
import { AnthropicLLMClient } from './AnthropicLLMClient'
import { OllamaLLMClient } from './OllamaLLMClient'
import { OpenAILLMClient } from './OpenAILLMClient'
import { OpenRouterLLMClient } from './OpenRouterLLMClient'

interface LlmMetadata {
  callType?: string
}

type UsageAccumulator = LLMGenerateResponse['usage'] | undefined

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

const mergeUsage = (current: UsageAccumulator, next: LLMGenerateResponse['usage'] | undefined): UsageAccumulator => {
  if (!next) {
    return current
  }
  if (!current) {
    return {
      ...next,
      cache_creation: next.cache_creation ? { ...next.cache_creation } : undefined,
    }
  }
  const cacheCreation: Record<string, number> = {}
  if (current.cache_creation) {
    for (const [key, value] of Object.entries(current.cache_creation)) {
      cacheCreation[key] = (cacheCreation[key] ?? 0) + (value ?? 0)
    }
  }
  if (next.cache_creation) {
    for (const [key, value] of Object.entries(next.cache_creation)) {
      cacheCreation[key] = (cacheCreation[key] ?? 0) + (value ?? 0)
    }
  }

  const merged: LLMGenerateResponse['usage'] = {
    prompt_tokens: (current.prompt_tokens ?? 0) + (next.prompt_tokens ?? 0),
    completion_tokens: (current.completion_tokens ?? 0) + (next.completion_tokens ?? 0),
    total_tokens: (current.total_tokens ?? 0) + (next.total_tokens ?? 0),
    cache_creation_input_tokens: (current.cache_creation_input_tokens ?? 0) + (next.cache_creation_input_tokens ?? 0),
    cache_read_input_tokens: (current.cache_read_input_tokens ?? 0) + (next.cache_read_input_tokens ?? 0),
  }

  if (Object.keys(cacheCreation).length > 0) {
    merged.cache_creation = cacheCreation
  }

  return merged
}

class LoggedLLMClient implements LLMClient {
  constructor(
    private readonly inner: LLMClient,
    private readonly provider: LLMProvider,
  ) {}

  getProvider(): string {
    return this.inner.getProvider()
  }

  async list() {
    return this.inner.list()
  }

  async *generate(options: LLMGenerateOptions): AsyncGenerator<LLMGenerateResponse> {
    const start = now()
    const id = generateMessageId()
    const metadata = (options.metadata ?? {}) as LlmMetadata
    const requestMessages = options.messages.map((message) => ({ ...message }))
    let aggregatedUsage: UsageAccumulator
    let combinedResponse = ''
    let error: Error | undefined

    const delegate = this.inner.generate(options)

    try {
      for await (const chunk of delegate) {
        if (chunk.response) {
          combinedResponse += chunk.response
        }
        if (chunk.usage) {
          aggregatedUsage = mergeUsage(aggregatedUsage, chunk.usage)
        }
        yield chunk
      }
    } catch (err) {
      error = err as Error
      throw err
    } finally {
      const durationMs = now() - start
      const rawUsage = aggregatedUsage
        ? {
            ...aggregatedUsage,
            cache_creation: aggregatedUsage.cache_creation ? { ...aggregatedUsage.cache_creation } : undefined,
          }
        : undefined

      const usage: TokenUsage | undefined = aggregatedUsage ? convertToTokenUsage(aggregatedUsage) : undefined

      llmActivityStore.log({
        id,
        timestamp: Date.now(),
        type: metadata.callType ?? 'llm',
        model: options.model,
        provider: this.provider,
        durationMs,
        requestMessages,
        response: combinedResponse,
        usage,
        rawUsage,
        error: error ? (error instanceof Error ? error.message : String(error)) : undefined,
      })
    }
  }
}

export class LLMClientFactory {
  private static clients: Map<LLMProvider, LLMClient> = new Map()

  static getClient(provider: string): LLMClient {
    // Validate provider
    const validProvider = provider as LLMProvider
    if (!['ollama', 'anthropic', 'openrouter', 'openai'].includes(provider)) {
      console.warn(`Unknown provider "${provider}", defaulting to ollama`)
      return LLMClientFactory.getClient('ollama')
    }

    // Return cached client if exists
    const existingClient = LLMClientFactory.clients.get(validProvider)
    if (existingClient) {
      return existingClient
    }

    // Create new client
    let client: LLMClient

    switch (validProvider) {
      case 'ollama':
        client = new OllamaLLMClient()
        break
      case 'anthropic':
        client = new AnthropicLLMClient()
        break
      case 'openrouter':
        client = new OpenRouterLLMClient()
        break
      case 'openai':
        client = new OpenAILLMClient()
        break
      default:
        // This should never happen due to validation above
        client = new OllamaLLMClient()
    }
    const loggedClient = new LoggedLLMClient(client, validProvider)

    // Cache the client
    LLMClientFactory.clients.set(validProvider, loggedClient)
    return loggedClient
  }

  static clearCache() {
    LLMClientFactory.clients.clear()
  }
}
