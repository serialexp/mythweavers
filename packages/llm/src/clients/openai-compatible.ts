import type {
  LLMClient,
  LLMClientConfig,
  LLMGenerateOptions,
  LLMMessage,
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
 * Whether the upstream is genuine OpenAI (api.openai.com). OpenAI-specific
 * request fields like `prompt_cache_key` must only be sent there — other
 * OpenAI-compatible providers (OpenRouter, Moonshot, vLLM, proxies, ...)
 * may reject unknown fields.
 */
function isOpenAIEndpoint(baseUrl: string): boolean {
  try {
    return new URL(baseUrl).hostname.toLowerCase() === "api.openai.com"
  } catch {
    return baseUrl.replace(/\/+$/, "") === DEFAULT_ENDPOINT
  }
}

/**
 * Whether an OpenAI model supports explicit prompt-cache breakpoints
 * (`prompt_cache_options` / `prompt_cache_breakpoint`). These were introduced
 * with the GPT-5.6 family; earlier OpenAI models return `400` when these fields
 * are present, so we only emit them for gpt-5.6 and any later family (gpt-6, …).
 *
 * Why breakpoints matter: OpenAI's *implicit* caching only auto-places a
 * breakpoint on the LAST message, so a prompt whose tail changes every turn
 * (a live conversation) never caches its stable prefix. An explicit breakpoint
 * at the end of the stable content lets that prefix be cached and reused even
 * as the tail changes — verified empirically against gpt-5.6.
 */
function supportsCacheBreakpoints(model: string): boolean {
  const m = /^gpt-(\d+)(?:\.(\d+))?/.exec(model.toLowerCase())
  if (!m) return false
  const major = Number(m[1])
  const minor = m[2] ? Number(m[2]) : 0
  return major > 5 || (major === 5 && minor >= 6)
}

/**
 * Small, fast, browser-safe non-crypto hash (FNV-1a, 32-bit → hex). Used only
 * to derive a `prompt_cache_key` for routing; there is no security requirement,
 * and key collisions only affect cache-routing distribution, not correctness.
 */
function fnv1aHex(s: string): string {
  let h = 0x811c9dc5 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, "0")
}

/**
 * Derive a stable `prompt_cache_key` from the cached prefix — the message
 * content up to and including the first breakpoint. Requests sharing that
 * stable prefix hash to the same key and therefore route to the same cache,
 * which GPT-5.6+ requires for reliable explicit-breakpoint matching.
 */
function derivePromptCacheKey(messages: LLMMessage[]): string {
  let acc = ""
  for (const m of messages) {
    acc += `${m.role}\n${m.content}\n`
    if (m.cache_control) break
  }
  return `mw-${fnv1aHex(acc)}`
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
    const enabled = !!(budget && budget > 0)
    requestBody.thinking = { type: enabled ? "enabled" : "disabled" }
    // Moonshot's reasoning models reject any temperature other than 0.6 when
    // thinking is disabled (the non-thinking decoder path is locked to that
    // value upstream). Force it here so the request doesn't 400.
    if (!enabled) {
      requestBody.temperature = 0.6
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

/**
 * Streaming tool-call accumulator. OpenAI streams `delta.tool_calls[i]`
 * fragments where the same `index` may appear across many chunks: the first
 * fragment carries `id` and `function.name`; subsequent fragments carry
 * `function.arguments` deltas that must be concatenated.
 *
 * We hold one entry per index, then emit a single `tool_call` event per
 * index when the stream ends — cleanest contract for consumers (no need to
 * re-assemble argument deltas themselves).
 */
interface ToolCallAccumulator {
  id: string
  name: string
  argumentsRaw: string
}

/**
 * Map a raw OpenAI-compatible streaming chunk to LLMStreamEvents. Tool-call
 * fragments are mutated into the shared `toolCallsByIndex` map so we can
 * flush them at end-of-stream as a single event per call.
 */
function parseStreamChunk(
  parsed: any,
  toolCallsByIndex: Map<number, ToolCallAccumulator>,
): LLMStreamEvent[] {
  const events: LLMStreamEvent[] = []

  // Usage info (usually in the final chunk when stream_options.include_usage is set).
  // Different OpenAI-compatible providers report cached input tokens in different
  // fields, so we accept several common shapes:
  //   - OpenAI / Azure OpenAI:        usage.prompt_tokens_details.cached_tokens
  //   - Moonshot (Kimi):              usage.cached_tokens                       (top-level)
  //   - DeepSeek:                     usage.prompt_cache_hit_tokens
  //   - OpenRouter → Anthropic:       usage.cache_read_input_tokens
  //                                   usage.cache_creation_input_tokens
  // Cache WRITES are reported by OpenAI (gpt-5.6+) in
  // usage.prompt_tokens_details.cache_write_tokens; Anthropic-shaped upstreams
  // use usage.cache_creation_input_tokens. Both map to our cacheCreation field.
  if (parsed.usage) {
    const u = parsed.usage
    const cacheRead =
      u.prompt_tokens_details?.cached_tokens ??
      u.cached_tokens ??
      u.prompt_cache_hit_tokens ??
      u.cache_read_input_tokens
    const cacheWrite =
      u.prompt_tokens_details?.cache_write_tokens ??
      u.cache_creation_input_tokens
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

    // Tool-call fragments — accumulate by index, emit on flush.
    const toolCalls = choice.delta?.tool_calls
    if (Array.isArray(toolCalls)) {
      for (const tc of toolCalls) {
        const idx = typeof tc.index === "number" ? tc.index : 0
        const existing = toolCallsByIndex.get(idx) ?? {
          id: "",
          name: "",
          argumentsRaw: "",
        }
        if (tc.id) existing.id = tc.id
        if (tc.function?.name) existing.name = tc.function.name
        if (typeof tc.function?.arguments === "string") {
          existing.argumentsRaw += tc.function.arguments
        }
        toolCallsByIndex.set(idx, existing)
      }
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

/**
 * Flush accumulated tool calls into `tool_call` events. Called once at
 * end-of-stream. Sorts by index so the order matches what the model emitted.
 * Arguments are JSON-parsed; if parsing fails we still emit the event with
 * the raw string so the consumer can decide how to handle malformed output.
 */
function flushToolCalls(
  toolCallsByIndex: Map<number, ToolCallAccumulator>,
): LLMStreamEvent[] {
  const sorted = [...toolCallsByIndex.entries()].sort(([a], [b]) => a - b)
  return sorted.map(([, tc]) => {
    let parsed: unknown = tc.argumentsRaw
    try {
      parsed = tc.argumentsRaw ? JSON.parse(tc.argumentsRaw) : {}
    } catch {
      // Leave parsed as the raw string so consumers can surface a useful error.
    }
    return {
      type: "tool_call" as const,
      id: tc.id,
      name: tc.name,
      arguments: parsed,
    }
  })
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

    // Explicit prompt-cache breakpoints: only on genuine OpenAI, only on models
    // that support them (gpt-5.6+), and only when the caller actually marked
    // breakpoints via `cache_control` (the same markers we set for Anthropic).
    // Otherwise we keep flattening to plain string content (cache_control is
    // dropped) so nothing changes for other providers / older models.
    const onOpenAI = isOpenAIEndpoint(this.getBaseUrl())
    const useBreakpoints =
      onOpenAI &&
      supportsCacheBreakpoints(options.model) &&
      options.messages.some((m) => m.cache_control)

    const formattedMessages = options.messages.map((msg) => {
      if (useBreakpoints && msg.cache_control) {
        // Chat Completions supports the breakpoint marker on a `text` block.
        // The marker caches this block and everything rendered before it;
        // content after it can change without invalidating the cached prefix.
        return {
          role: msg.role,
          content: [
            {
              type: "text",
              text: msg.content,
              prompt_cache_breakpoint: { mode: "explicit" },
            },
          ],
        }
      }
      return { role: msg.role, content: msg.content }
    })

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

    // OpenAI prompt caching. A stable routing key steers same-prefix traffic to
    // the same cache; gpt-5.6+ *requires* one for reliable explicit-breakpoint
    // matching. Prefer the caller's key; otherwise derive a stable one from the
    // cached prefix so same-prefix requests still route together. Genuine
    // OpenAI endpoints only (other providers may reject the field).
    if (onOpenAI) {
      if (options.prompt_cache_key) {
        requestBody.prompt_cache_key = options.prompt_cache_key
      } else if (useBreakpoints) {
        requestBody.prompt_cache_key = derivePromptCacheKey(options.messages)
      }
    }

    // Explicit mode: only the breakpoints we marked are written to cache — so we
    // pay the (1.25×) cache-write on the stable prefix, not on the volatile tail
    // every turn. Without this, implicit mode would also breakpoint the last
    // message each request.
    if (useBreakpoints) {
      requestBody.prompt_cache_options = { mode: "explicit" }
    }

    // Tools — passed through in OpenAI's `function` shape. Empty/undefined
    // tools means the field is omitted entirely (some providers reject an
    // empty `tools: []` array).
    if (options.tools && options.tools.length > 0) {
      requestBody.tools = options.tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }))
      const choice = options.tool_choice
      if (choice === "none" || choice === "auto" || choice === "required") {
        requestBody.tool_choice = choice
      } else if (choice && typeof choice === "object" && choice.name) {
        requestBody.tool_choice = {
          type: "function",
          function: { name: choice.name },
        }
      }
    }

    // --- Upstream request with timeout ---
    // Some proxies can hang before the first byte or drop mid-stream.
    // Abort after 30s of no data so the error surfaces as an SSE event
    // instead of a silent empty response or a hanging connection.
    const upstreamTimeoutMs = 30_000
    const upstreamAbort = new AbortController()
    const upstreamTimer = setTimeout(
      () => upstreamAbort.abort(new DOMException('Upstream request timed out', 'TimeoutError')),
      upstreamTimeoutMs,
    )
    // Forward the caller's abort signal so user cancellation works normally.
    const callerSignal = options.signal
    if (callerSignal) {
      callerSignal.addEventListener(
        'abort',
        () => upstreamAbort.abort(callerSignal.reason),
        { once: true },
      )
    }

    let response: Response
    try {
      response = await fetch(
        this.buildUrl("/chat/completions"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            ...extra,
          },
          body: JSON.stringify(requestBody),
          signal: upstreamAbort.signal,
        },
      )
    } catch (err: unknown) {
      clearTimeout(upstreamTimer)
      const name = (err as Error).name
      if (name === 'TimeoutError' || name === 'AbortError') {
        yield {
          type: 'error',
          error: (err as Error).message || 'Upstream request timed out or was cancelled',
        }
        yield { type: 'done' }
        return
      }
      throw err
    }
    clearTimeout(upstreamTimer)

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

    const toolCallsByIndex = new Map<number, ToolCallAccumulator>()
    let hadSseContent = false
    for await (const raw of parseSSEStream(response.body)) {
      hadSseContent = true
      for (const event of parseStreamChunk(raw, toolCallsByIndex)) {
        // Hold off on emitting `done` until after tool calls are flushed,
        // so consumers see all tool_call events first.
        if (event.type === "done") continue
        yield event
      }
    }

    // Flush any accumulated tool calls before signaling done.
    for (const event of flushToolCalls(toolCallsByIndex)) {
      yield event
      hadSseContent = true
    }

    // If the HTTP response was 200 but the body contained no parseable SSE
    // data, the upstream likely returned a non-streaming error page (e.g. a
    // reverse-proxy timeout page wrapped in 200).  Emit a meaningful error
    // instead of a silent empty response.
    if (!hadSseContent) {
      yield {
        type: "error",
        error:
          "The upstream returned an empty or non-SSE response — " +
          "the request may have timed out or the proxy dropped the connection.",
      }
    }

    // Guarantee done — covers both the case where finish_reason was sent
    // (we suppressed that done above so tool calls flush first) and the
    // case where the stream ended without one.
    yield { type: "done" }
  }
}
