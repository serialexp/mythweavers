import {
  AnthropicClient,
  CloudflareClient,
  OllamaClient,
  OpenAICompatibleClient,
  type LLMClient,
  type LLMGenerateOptions,
  type LLMStreamEvent,
  type TokenUsage,
  normalizeTokenUsage,
} from '@mythweavers/llm'
import { llmActivityStore } from '../../stores/llmActivityStore'
import { settingsStore } from '../../stores/settingsStore'
import type { LLMProvider } from '../../types/llm'
import { generateMessageId } from '../id'
import { ServerLLMClient } from './ServerLLMClient'

interface LlmMetadata {
  callType?: string
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

/**
 * Merge two TokenUsage snapshots.
 * Input tokens (including cache) are reported once but may appear in multiple events
 * so we take the max. Output tokens accumulate during streaming so we sum them.
 */
const mergeUsage = (current: TokenUsage | undefined, next: TokenUsage | undefined): TokenUsage | undefined => {
  if (!next) return current
  if (!current) return { ...next }

  return {
    prompt_tokens: Math.max(current.prompt_tokens ?? 0, next.prompt_tokens ?? 0),
    completion_tokens: (current.completion_tokens ?? 0) + (next.completion_tokens ?? 0),
    total_tokens:
      Math.max(current.prompt_tokens ?? 0, next.prompt_tokens ?? 0) +
      (current.completion_tokens ?? 0) +
      (next.completion_tokens ?? 0),
    cache_creation_input_tokens: Math.max(
      current.cache_creation_input_tokens ?? 0,
      next.cache_creation_input_tokens ?? 0,
    ),
    cache_read_input_tokens: Math.max(current.cache_read_input_tokens ?? 0, next.cache_read_input_tokens ?? 0),
  }
}

/**
 * Wraps any LLMClient to log all generate() calls to llmActivityStore.
 */
class LoggedLLMClient implements LLMClient {
  constructor(
    private readonly inner: LLMClient,
    private readonly provider: LLMProvider,
  ) {}

  async list() {
    return this.inner.list()
  }

  async *generate(options: LLMGenerateOptions): AsyncGenerator<LLMStreamEvent> {
    const start = now()
    const id = generateMessageId()
    const metadata = (options.metadata ?? {}) as LlmMetadata
    const requestMessages = options.messages.map((message) => ({ ...message }))
    let aggregatedUsage: TokenUsage | undefined
    let combinedResponse = ''
    let error: Error | undefined

    const delegate = this.inner.generate(options)

    try {
      for await (const event of delegate) {
        if (event.type === 'chunk') {
          combinedResponse += event.text
        }
        if (event.type === 'usage') {
          aggregatedUsage = mergeUsage(aggregatedUsage, event.usage)
        }
        yield event
      }
    } catch (err) {
      error = err as Error
      throw err
    } finally {
      const durationMs = now() - start
      const rawUsage = aggregatedUsage ? { ...aggregatedUsage } : undefined
      const usage = normalizeTokenUsage(aggregatedUsage)

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
  private static clients: Map<string, LLMClient> = new Map()

  static getClient(provider: string): LLMClient {
    // Handle custom providers (prefixed with "custom:")
    if (provider.startsWith('custom:')) {
      return LLMClientFactory.getOrCreateCustomClient(provider)
    }

    // Validate built-in provider
    if (!['ollama', 'anthropic', 'openrouter', 'openai', 'cloudflare', 'server'].includes(provider)) {
      console.warn(`Unknown provider "${provider}", defaulting to ollama`)
      return LLMClientFactory.getClient('ollama')
    }

    // Return cached client if exists
    const existingClient = LLMClientFactory.clients.get(provider)
    if (existingClient) {
      return existingClient
    }

    // Create new client using shared @mythweavers/llm implementations
    let client: LLMClient

    switch (provider) {
      case 'ollama':
        client = new OllamaClient({
          host: `${window.location.origin}/ollama`,
        })
        break
      case 'anthropic':
        client = new AnthropicClient({
          apiKey: () => settingsStore.anthropicApiKey,
          extraHeaders: { 'anthropic-dangerous-direct-browser-access': 'true' },
        })
        break
      case 'openrouter':
        client = new OpenAICompatibleClient({
          apiKey: () => settingsStore.openrouterApiKey,
          endpoint: 'https://openrouter.ai/api/v1',
          extraHeaders: () => ({
            'HTTP-Referer': window.location.origin,
            'X-Title': 'Story Writing App',
          }),
          unfiltered: true,
        })
        break
      case 'openai':
        client = new OpenAICompatibleClient({
          apiKey: () => settingsStore.openaiApiKey,
        })
        break
      case 'cloudflare':
        client = new CloudflareClient({
          apiKey: () => settingsStore.cloudflareApiKey,
          endpoint: settingsStore.cloudflareEndpoint,
        })
        break
      case 'server':
        client = new ServerLLMClient()
        break
      default:
        client = new OllamaClient({
          host: `${window.location.origin}/ollama`,
        })
    }

    const loggedClient = new LoggedLLMClient(client, provider as LLMProvider)
    LLMClientFactory.clients.set(provider, loggedClient)
    return loggedClient
  }

  /**
   * Get or create a client for a custom OpenAI-compatible provider.
   * Custom provider IDs are formatted as "custom:{id}".
   */
  private static getOrCreateCustomClient(providerKey: string): LLMClient {
    const existingClient = LLMClientFactory.clients.get(providerKey)
    if (existingClient) {
      return existingClient
    }

    const customId = providerKey.slice('custom:'.length)
    const config = settingsStore.getCustomProvider(customId)

    if (!config) {
      console.warn(`Custom provider "${customId}" not found, defaulting to ollama`)
      return LLMClientFactory.getClient('ollama')
    }

    const client = new OpenAICompatibleClient({
      apiKey: config.apiKey,
      endpoint: config.endpoint,
    })
    const loggedClient = new LoggedLLMClient(client, providerKey as LLMProvider)

    LLMClientFactory.clients.set(providerKey, loggedClient)
    return loggedClient
  }

  /** Remove a specific provider from the cache. */
  static clearClientCache(providerKey: string) {
    LLMClientFactory.clients.delete(providerKey)
  }

  static clearCache() {
    LLMClientFactory.clients.clear()
  }
}
