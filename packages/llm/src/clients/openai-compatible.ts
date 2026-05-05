import type {
  LLMClient,
  LLMClientConfig,
  LLMGenerateOptions,
  LLMModel,
  LLMStreamEvent,
  ModelPricing,
} from "../types"
import { resolve } from "../types"
import { parseSSEStream } from "../utils/sse-parser"

const DEFAULT_ENDPOINT = "https://api.openai.com/v1"

// ---- Pricing & context length maps ----
// Only used when listing models from the built-in OpenAI endpoint.
// Custom endpoints and OpenRouter provide their own data.

const OPENAI_PRICING: Record<string, ModelPricing> = {
  "gpt-4o": { input: 2.5, output: 10.0, input_cache_read: 1.25 },
  "gpt-4o-2024-05-13": { input: 5.0, output: 15.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6, input_cache_read: 0.075 },
  "gpt-4-turbo": { input: 10.0, output: 30.0 },
  "gpt-4-turbo-2024-04-09": { input: 10.0, output: 30.0 },
  "gpt-4": { input: 30.0, output: 60.0 },
  "gpt-4-32k": { input: 60.0, output: 120.0 },
  "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
  "gpt-3.5-turbo-0125": { input: 0.5, output: 1.5 },
  "gpt-3.5-turbo-16k": { input: 3.0, output: 4.0 },
  o1: { input: 15.0, output: 60.0, input_cache_read: 7.5 },
  "o1-mini": { input: 1.1, output: 4.4, input_cache_read: 0.55 },
  "gpt-5": { input: 1.25, output: 10.0, input_cache_read: 0.125 },
  "gpt-5-mini": { input: 0.25, output: 2.0, input_cache_read: 0.025 },
  "gpt-5-nano": { input: 0.05, output: 0.4, input_cache_read: 0.005 },
  "gpt-5-chat-latest": {
    input: 1.25,
    output: 10.0,
    input_cache_read: 0.125,
  },
}

const OPENAI_CONTEXT_LENGTHS: Record<string, number> = {
  "gpt-4o": 128000,
  "gpt-4o-mini": 128000,
  "gpt-4-turbo": 128000,
  "gpt-4": 8192,
  "gpt-3.5-turbo": 16385,
  "gpt-5": 400000,
  "gpt-5-mini": 400000,
  "gpt-5-nano": 400000,
  "gpt-5-chat-latest": 400000,
}

function lookupPricing(modelId: string): ModelPricing | undefined {
  if (OPENAI_PRICING[modelId]) return OPENAI_PRICING[modelId]
  for (const [key, value] of Object.entries(OPENAI_PRICING)) {
    if (modelId.includes(key)) return value
  }
  return undefined
}

function lookupContextLength(modelId: string): number {
  if (OPENAI_CONTEXT_LENGTHS[modelId])
    return OPENAI_CONTEXT_LENGTHS[modelId]
  for (const [key, value] of Object.entries(OPENAI_CONTEXT_LENGTHS)) {
    if (modelId.includes(key)) return value
  }
  return 8192
}

/** Whether a model uses `max_completion_tokens` instead of `max_tokens`. */
function usesMaxCompletionTokens(model: string): boolean {
  return (
    model.startsWith("o1") ||
    model.includes("gpt-4o") ||
    model.includes("gpt-4-turbo") ||
    model.includes("gpt-5")
  )
}

/**
 * Map an Anthropic-style `thinking_budget` (token count) to a discrete
 * `reasoning_effort` bucket used by OpenAI's o-series, gpt-5, and most
 * other OpenAI-compatible reasoning endpoints.
 */
function budgetToEffort(budget: number): "low" | "medium" | "high" {
  if (budget < 4096) return "low"
  if (budget < 16384) return "medium"
  return "high"
}

/**
 * Whether a model name looks like a reasoning model that accepts
 * `reasoning_effort`. Used as a guard so we don't tack the field onto
 * non-reasoning models (which can 400 on strict providers).
 */
function looksLikeReasoningModel(model: string): boolean {
  const m = model.toLowerCase()
  return (
    /^o[1-9]/.test(m) ||
    m.startsWith("gpt-5") ||
    m.includes("gpt-oss") ||
    m.includes("thinking") ||
    m.includes("-r1") ||
    m.includes("reasoner") ||
    m.includes("reasoning")
  )
}

/** Whether the upstream looks like Moonshot's Kimi platform. */
function isMoonshotEndpoint(baseUrl: string): boolean {
  const u = baseUrl.toLowerCase()
  return (
    u.includes("moonshot.ai") ||
    u.includes("moonshot.cn") ||
    u.includes("kimi.ai")
  )
}

/**
 * Apply `thinking_budget` to an OpenAI-compatible request body, translating
 * to the parameter shape the upstream provider expects.
 *
 * - **OpenRouter**: unified `reasoning: { max_tokens }` API — closest analogue
 *   to Anthropic's `budget_tokens`. Budget 0/undefined → omit (provider default).
 * - **OpenAI reasoning models / gpt-oss / DeepSeek R1 / Qwen-thinking / etc.**:
 *   `reasoning_effort: "low" | "medium" | "high"` bucketed from the budget.
 * - **Moonshot / Kimi reasoning models**: only a binary `thinking: { type:
 *   "enabled" | "disabled" }` is supported — no token budget. Default upstream
 *   is enabled, which can blow through `max_tokens` before producing any
 *   visible answer. We treat budget=0/undefined as an explicit "disable", and
 *   any positive budget as "enable". This is the only knob Moonshot exposes.
 * - **Non-reasoning models on other endpoints**: leave the field off.
 */
function applyThinkingBudget(
  requestBody: Record<string, unknown>,
  options: LLMGenerateOptions,
  baseUrl: string,
): void {
  const budget = options.thinking_budget
  const url = baseUrl.toLowerCase()

  // Moonshot/Kimi: binary toggle, opt-in only. We honor budget=0/undefined as
  // "off" so users can actually stop the model from burning their max_tokens
  // budget on reasoning before it ever produces an answer.
  if (isMoonshotEndpoint(url)) {
    requestBody.thinking = {
      type: budget && budget > 0 ? "enabled" : "disabled",
    }
    return
  }

  // From here on, no budget = nothing to do.
  if (!budget || budget <= 0) return

  // OpenRouter: pass the budget through verbatim as max_tokens of reasoning.
  if (url.includes("openrouter.ai")) {
    requestBody.reasoning = { max_tokens: budget }
    return
  }

  if (looksLikeReasoningModel(options.model)) {
    requestBody.reasoning_effort = budgetToEffort(budget)
  }
  // Otherwise: silently drop. The model probably doesn't reason at all.
}

/** Map a raw OpenAI-compatible streaming chunk to LLMStreamEvents. */
function parseStreamChunk(parsed: any): LLMStreamEvent[] {
  const events: LLMStreamEvent[] = []

  // Usage info (usually in the final chunk when stream_options.include_usage is set).
  // Different OpenAI-compatible providers report cached input tokens in different
  // fields, so we accept several common shapes:
  //   - OpenAI / Azure OpenAI:        usage.prompt_tokens_details.cached_tokens
  //   - Moonshot (Kimi):              usage.cached_tokens                       (top-level)
  //   - DeepSeek:                     usage.prompt_cache_hit_tokens
  //   - OpenRouter → Anthropic:       usage.cache_read_input_tokens
  //                                   usage.cache_creation_input_tokens
  if (parsed.usage) {
    const u = parsed.usage
    const cacheRead =
      u.prompt_tokens_details?.cached_tokens ??
      u.cached_tokens ??
      u.prompt_cache_hit_tokens ??
      u.cache_read_input_tokens
    const cacheWrite = u.cache_creation_input_tokens
    events.push({
      type: "usage",
      usage: {
        prompt_tokens: u.prompt_tokens,
        completion_tokens: u.completion_tokens,
        total_tokens: u.total_tokens,
        ...(cacheRead != null ? { cache_read_input_tokens: cacheRead } : {}),
        ...(cacheWrite != null
          ? { cache_creation_input_tokens: cacheWrite }
          : {}),
      },
    })
  }

  // Content delta
  const choice = parsed.choices?.[0]
  if (choice) {
    const text = choice.delta?.content
    if (text) {
      events.push({ type: "chunk", text })
    }

    // finish_reason signals the end
    if (choice.finish_reason) {
      events.push({ type: "done" })
    }
  }

  // Empty choices + usage = done (OpenAI sends this as the final event)
  if (
    parsed.usage &&
    (!parsed.choices || parsed.choices.length === 0)
  ) {
    events.push({ type: "done" })
  }

  return events
}

export interface OpenAICompatibleClientConfig extends LLMClientConfig {
  /**
   * If true, the model list is returned as-is from the API without filtering.
   * When false (default), only GPT models are returned (for the built-in OpenAI endpoint).
   */
  unfiltered?: boolean
}

/**
 * Client for OpenAI-compatible APIs.
 *
 * This single class replaces the old OpenAILLMClient and OpenRouterLLMClient.
 * OpenRouter is simply a different endpoint + extra headers.
 */
export class OpenAICompatibleClient implements LLMClient {
  private config: OpenAICompatibleClientConfig

  constructor(config: OpenAICompatibleClientConfig) {
    this.config = config
  }

  private getBaseUrl(): string {
    return (this.config.endpoint ?? DEFAULT_ENDPOINT).replace(/\/+$/, "")
  }

  /** Build the full URL for an API path. */
  private buildUrl(path: string): string {
    return `${this.getBaseUrl()}${path}`
  }

  async list(): Promise<{ models: LLMModel[] }> {
    const apiKey = resolve(this.config.apiKey)
    if (!apiKey) return { models: [] }

    const extra = this.config.extraHeaders
      ? resolve(this.config.extraHeaders)
      : {}

    const response = await fetch(this.buildUrl("/models"), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...extra,
      },
    })

    if (!response.ok) {
      console.error(
        "[openai-compatible] Failed to fetch models:",
        response.status,
      )
      return { models: [] }
    }

    const data: any = await response.json()
    const isCustom = !!this.config.endpoint && this.config.endpoint !== DEFAULT_ENDPOINT

    // For the built-in OpenAI endpoint, filter to GPT models only
    // unless the caller opts into unfiltered mode.
    const rawModels: any[] = data.data ?? []
    const filtered =
      isCustom || this.config.unfiltered
        ? rawModels
        : rawModels.filter(
            (m: any) =>
              m.id.includes("gpt") &&
              !m.id.includes("vision") &&
              !m.id.includes("instruct"),
          )

    const models: LLMModel[] = filtered.map((m: any) => ({
      name: m.id,
      context_length: m.context_length || lookupContextLength(m.id),
      description: m.id,
      pricing: lookupPricing(m.id),
    }))

    return { models }
  }

  async *generate(
    options: LLMGenerateOptions,
  ): AsyncGenerator<LLMStreamEvent> {
    const apiKey = resolve(this.config.apiKey)
    if (!apiKey) throw new Error("API key not configured")

    const extra = this.config.extraHeaders
      ? resolve(this.config.extraHeaders)
      : {}

    const formattedMessages = options.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))

    const requestBody: Record<string, unknown> = {
      model: options.model,
      messages: formattedMessages,
      temperature: options.temperature ?? 1,
      stream: true,
      stream_options: { include_usage: true },
    }

    // Newer OpenAI models use max_completion_tokens
    const maxTokens = options.max_tokens || 4096
    if (usesMaxCompletionTokens(options.model)) {
      requestBody.max_completion_tokens = maxTokens
    } else {
      requestBody.max_tokens = maxTokens
    }

    // Translate Anthropic-style thinking_budget into the right shape for
    // whatever OpenAI-compatible upstream we're talking to.
    applyThinkingBudget(requestBody, options, this.getBaseUrl())

    const response = await fetch(
      this.buildUrl("/chat/completions"),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          ...extra,
        },
        body: JSON.stringify(requestBody),
        signal: options.signal,
      },
    )

    if (!response.ok) {
      const errorText = await response.text()
      yield {
        type: "error",
        error: `OpenAI-compatible API error: ${response.status} ${errorText}`,
      }
      yield { type: "done" }
      return
    }

    if (!response.body) {
      yield { type: "error", error: "No response body" }
      yield { type: "done" }
      return
    }

    let sawDone = false
    for await (const raw of parseSSEStream(response.body)) {
      for (const event of parseStreamChunk(raw)) {
        if (event.type === "done") sawDone = true
        yield event
      }
    }

    // Guarantee done if the stream didn't already produce one
    if (!sawDone) {
      yield { type: "done" }
    }
  }
}
