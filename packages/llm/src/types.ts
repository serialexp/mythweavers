// ---- Stream event discriminated union ----

/**
 * Discriminated union for all events emitted by LLM streaming generators.
 * Replaces the old bag-of-optional-fields `LLMGenerateResponse`.
 *
 * `tool_call` is emitted once per *completed* tool call, after streaming
 * deltas have been concatenated and the arguments JSON has been parsed by
 * the client. Consumers that don't pass `tools` will never see this event.
 */
export type LLMStreamEvent =
  | { type: "chunk"; text: string }
  | { type: "tool_call"; id: string; name: string; arguments: unknown }
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

/**
 * Definition of a tool the model may call. Modeled on the OpenAI function
 * tool shape (Anthropic uses the same JSON Schema for `input_schema`).
 *
 * `parameters` is an arbitrary JSON Schema object. The client passes it
 * through verbatim to the provider; failure modes when the schema is bad
 * are upstream's problem, not ours.
 */
export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
}

/**
 * How the model should pick a tool.
 * - `"auto"` (default): model decides whether to call a tool
 * - `"required"`: model must call at least one tool
 * - `"none"`: model must not call any tool (equivalent to omitting tools)
 * - `{ name }`: model must call this specific tool
 */
export type ToolChoice =
  | "auto"
  | "required"
  | "none"
  | { name: string }

export interface LLMGenerateOptions {
  model: string
  messages: LLMMessage[]
  temperature?: number
  max_tokens?: number
  thinking_budget?: number
  /**
   * Tool definitions the model may invoke. Each call to a tool produces a
   * `tool_call` event after its arguments JSON has been fully streamed and
   * parsed. Currently supported only by the OpenAI-compatible client; other
   * clients throw `Error("Tool calls not supported by provider X")` when
   * tools are non-empty.
   */
  tools?: ToolDefinition[]
  /** Constrain how aggressively the model picks tools. Default `"auto"`. */
  tool_choice?: ToolChoice
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

// ---- Image generation ----

/**
 * Options for a one-shot image-generation request. Non-streaming — providers
 * either return the bytes directly (Cloudflare's `/run/@cf/<model>`) or a
 * URL/base64 payload (OpenAI's `/v1/images/generations`). Either way the
 * client is responsible for normalizing back to a `Uint8Array` + mimeType.
 */
export interface ImageGenerateOptions {
  /** Model ID as understood by the provider (e.g. "@cf/black-forest-labs/flux-1-schnell", "gpt-image-1"). */
  model: string
  prompt: string
  /** Output width in pixels. Provider clamps if it doesn't support arbitrary sizes. */
  width?: number
  /** Output height in pixels. Provider clamps if it doesn't support arbitrary sizes. */
  height?: number
  /** Number of denoising steps (Flux/SD style). Ignored by step-less APIs (gpt-image-1). */
  steps?: number
  negativePrompt?: string
  /** Seed for reproducibility. May be ignored. */
  seed?: number
  signal?: AbortSignal
  /** Provider-specific knobs (e.g. OpenAI quality/style). */
  providerOptions?: Record<string, unknown>
}

/** Optional usage breakdown from the provider — used for billing snapshotting. */
export interface ImageUsage {
  /** Number of 512x512 tiles billed (Cloudflare). */
  tiles?: number
  /** Steps billed (Cloudflare PER_TILE_STEP models). */
  steps?: number
  /** Output megapixels (Cloudflare PER_MP_TIERED models). */
  megapixels?: number
}

/**
 * Normalized image-generation result. Always returns the raw bytes so the
 * backend can pipe straight into `saveBuffer()` without worrying about
 * base64 vs URL fetches. mimeType is whatever the provider emitted —
 * varies between PNG/JPEG/WebP per model.
 */
export interface ImageGenerateResult {
  buffer: Uint8Array
  mimeType: string
  width?: number
  height?: number
  usage?: ImageUsage
}

/** Lightweight model info for picker UIs. */
export interface ImageModelInfo {
  name: string
  displayName?: string
  description?: string
  maxWidth?: number
  maxHeight?: number
  defaultSteps?: number
}

/**
 * Image-generation client interface. Separate from `LLMClient` because the
 * shape is fundamentally different (non-streaming, single result). A single
 * provider class may implement both — see `CloudflareClient` and `OpenAIClient`.
 */
export interface ImageClient {
  listImageModels(): Promise<{ models: ImageModelInfo[] }>
  generateImage(options: ImageGenerateOptions): Promise<ImageGenerateResult>
}
