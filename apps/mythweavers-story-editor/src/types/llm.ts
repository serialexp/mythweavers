// Re-export shared LLM types from the @mythweavers/llm package
export type {
  LLMStreamEvent,
  TokenUsage,
  NormalizedTokenUsage,
  LLMMessage,
  LLMGenerateOptions,
  ModelPricing,
  LLMModel,
  LLMClient,
} from '@mythweavers/llm'

export { normalizeTokenUsage } from '@mythweavers/llm'

/** Built-in provider IDs. Custom providers use "custom:{id}" format. */
export type BuiltinProvider = 'ollama' | 'llamacpp' | 'openrouter' | 'anthropic' | 'openai' | 'cloudflare' | 'server'
export type LLMProvider = BuiltinProvider | `custom:${string}`
