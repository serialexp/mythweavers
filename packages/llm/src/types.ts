// ---- Stream event discriminated union ----

/**
 * Discriminated union for all events emitted by LLM streaming generators.
 * Replaces the old bag-of-optional-fields `LLMGenerateResponse`.
 */
export type LLMStreamEvent =
  | { type: "chunk"; text: string }
  | { type: "usage"; usage: TokenUsage }
  | { type: "done" }
  | { type: "error"; error: string }

// ---- Token usage ----

/** Raw token counts as reported by providers (prompt includes cache tokens). */
export interface TokenUsage {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

/**
 * Normalized token usage that separates cache tokens from regular input.
 * This is the "final" form used for display and billing on the frontend.
 */
export interface NormalizedTokenUsage {
  input_normal: number
  input_cache_read: number
  input_cache_write: number
  output_normal: number
}

/** Convert raw provider TokenUsage to the normalized form. */
export function normalizeTokenUsage(
  usage: TokenUsage | undefined,
): NormalizedTokenUsage | undefined {
  if (!usage) return undefined

  const totalPromptTokens = usage.prompt_tokens ?? 0
  const cacheReadTokens = usage.cache_read_input_tokens ?? 0
  const cacheWriteTokens = usage.cache_creation_input_tokens ?? 0
  const regularInputTokens = Math.max(
    0,
    totalPromptTokens - cacheReadTokens - cacheWriteTokens,
  )

  return {
    input_normal: regularInputTokens,
    input_cache_read: cacheReadTokens,
    input_cache_write: cacheWriteTokens,
    output_normal: usage.completion_tokens ?? 0,
  }
}

// ---- Messages ----

export interface LLMMessage {
  role: "system" | "user" | "assistant"
  content: string
  cache_control?: {
    type: "ephemeral"
    ttl?: "5m" | "1h" | number // number in seconds
  }
}

// ---- Generation options ----

export interface LLMGenerateOptions {
  model: string
  messages: LLMMessage[]
  temperature?: number
  max_tokens?: number
  thinking_budget?: number
  /** Provider-specific options (e.g. Ollama num_ctx, repeat_penalty). */
  providerOptions?: Record<string, unknown>
  metadata?: Record<string, unknown>
  signal?: AbortSignal
}

// ---- Models ----

/** Pricing per million tokens. */
export interface ModelPricing {
  input: number
  output: number
  request?: number
  image?: number
  input_cache_read?: number
  input_cache_write?: number
}

export interface LLMModel {
  name: string
  context_length?: number
  description?: string
  /** Ollama-specific */
  size?: number
  digest?: string
  modified_at?: string
  pricing?: ModelPricing
}

// ---- Client interface ----

/**
 * Accept a static value or a zero-arg getter.
 * Lets frontend pass reactive getters (`() => settingsStore.apiKey`)
 * while backend passes plain strings.
 */
export type ConfigOrGetter<T> = T | (() => T)

/** Resolve a ConfigOrGetter to its value. */
export function resolve<T>(v: ConfigOrGetter<T>): T {
  return typeof v === "function" ? (v as () => T)() : v
}

export interface LLMClientConfig {
  apiKey: ConfigOrGetter<string>
  /** Base URL (no trailing slash). Defaults vary per client. */
  endpoint?: string
  /** Extra headers merged into every request. */
  extraHeaders?: ConfigOrGetter<Record<string, string>>
}

export interface LLMClient {
  list(): Promise<{ models: LLMModel[] }>
  generate(options: LLMGenerateOptions): AsyncGenerator<LLMStreamEvent>
}
