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

const DEFAULT_ENDPOINT = "https://api.anthropic.com"

// Pricing map for Anthropic models (prices per million tokens).
// Kept in the shared package so both frontend and backend can look up pricing
// when listing models.
const ANTHROPIC_PRICING: Record<string, ModelPricing> = {
  "claude-opus-4-5": {
    input: 5,
    output: 25,
    input_cache_write: 6.25,
    input_cache_read: 0.5,
  },
  "claude-opus-4-6": {
    input: 5,
    output: 25,
    input_cache_write: 6.25,
    input_cache_read: 0.5,
  },
  "claude-opus-4-1": {
    input: 15,
    output: 75,
    input_cache_write: 18.75,
    input_cache_read: 1.5,
  },
  "claude-opus-4-20250514": {
    input: 15,
    output: 75,
    input_cache_write: 18.75,
    input_cache_read: 1.5,
  },
  "claude-sonnet-4-20250514": {
    input: 3,
    output: 15,
    input_cache_write: 3.75,
    input_cache_read: 0.3,
  },
  "claude-3-7-sonnet-20250219": {
    input: 3,
    output: 15,
    input_cache_write: 3.75,
    input_cache_read: 0.3,
  },
  "claude-3-7-sonnet-latest": {
    input: 3,
    output: 15,
    input_cache_write: 3.75,
    input_cache_read: 0.3,
  },
  "claude-haiku-4-5": {
    input: 1,
    output: 5,
    input_cache_write: 1.25,
    input_cache_read: 0.1,
  },
  "claude-3-5-haiku-20241022": {
    input: 0.8,
    output: 4,
    input_cache_write: 1,
    input_cache_read: 0.08,
  },
  "claude-3-5-haiku-latest": {
    input: 0.8,
    output: 4,
    input_cache_write: 1,
    input_cache_read: 0.08,
  },
  "claude-3-5-sonnet-20241022": {
    input: 3,
    output: 15,
    input_cache_write: 3.75,
    input_cache_read: 0.3,
  },
  "claude-3-5-sonnet-latest": {
    input: 3,
    output: 15,
    input_cache_write: 3.75,
    input_cache_read: 0.3,
  },
  "claude-3-5-sonnet-20240620": {
    input: 3,
    output: 15,
    input_cache_write: 3.75,
    input_cache_read: 0.3,
  },
  "claude-3-haiku-20240307": {
    input: 0.25,
    output: 1.25,
    input_cache_write: 0.3,
    input_cache_read: 0.03,
  },
  // Short aliases
  "claude-sonnet-4": {
    input: 3,
    output: 15,
    input_cache_write: 3.75,
    input_cache_read: 0.3,
  },
  "claude-opus-4": {
    input: 5,
    output: 25,
    input_cache_write: 6.25,
    input_cache_read: 0.5,
  },
  "claude-3-5-sonnet": {
    input: 3,
    output: 15,
    input_cache_write: 3.75,
    input_cache_read: 0.3,
  },
  "claude-3-5-haiku": {
    input: 0.8,
    output: 4,
    input_cache_write: 1,
    input_cache_read: 0.08,
  },
  "claude-3-opus": {
    input: 5,
    output: 25,
    input_cache_write: 6.25,
    input_cache_read: 0.5,
  },
  "claude-3-haiku": {
    input: 0.25,
    output: 1.25,
    input_cache_write: 0.3,
    input_cache_read: 0.03,
  },
}

function lookupPricing(modelId: string): ModelPricing | undefined {
  // Exact match first
  if (ANTHROPIC_PRICING[modelId]) return ANTHROPIC_PRICING[modelId]
  // Pattern match — some IDs include date suffixes
  for (const [key, value] of Object.entries(ANTHROPIC_PRICING)) {
    if (modelId.includes(key)) return value
  }
  return undefined
}

/** Map a raw Anthropic SSE event to zero or more LLMStreamEvents. */
function parseStreamEvent(event: any): LLMStreamEvent[] {
  const events: LLMStreamEvent[] = []

  switch (event.type) {
    case "message_start": {
      const u = event.message?.usage
      if (u) {
        events.push({
          type: "usage",
          usage: {
            prompt_tokens: u.input_tokens,
            completion_tokens: u.output_tokens,
            total_tokens:
              (u.input_tokens ?? 0) + (u.output_tokens ?? 0),
            cache_creation_input_tokens: u.cache_creation_input_tokens,
            cache_read_input_tokens: u.cache_read_input_tokens,
          },
        })
      }
      break
    }
    case "content_block_delta": {
      const text = event.delta?.text
      if (text) {
        events.push({ type: "chunk", text })
      }
      break
    }
    case "message_delta": {
      const u = event.usage
      if (u) {
        events.push({
          type: "usage",
          usage: {
            completion_tokens: u.output_tokens,
            cache_creation_input_tokens: u.cache_creation_input_tokens,
            cache_read_input_tokens: u.cache_read_input_tokens,
          },
        })
      }
      break
    }
    case "message_stop":
      events.push({ type: "done" })
      break
    case "error":
      events.push({
        type: "error",
        error: event.error?.message || "Unknown Anthropic stream error",
      })
      break
    // content_block_start, content_block_stop, ping — ignored
  }

  return events
}

interface AnthropicContentBlock {
  type: "text"
  text: string
  cache_control?: { type: "ephemeral"; ttl?: "5m" | "1h" }
}

interface AnthropicFormattedMessage {
  role: "user" | "assistant" | "system"
  content: AnthropicContentBlock[]
}

export class AnthropicClient implements LLMClient {
  private config: LLMClientConfig

  constructor(config: LLMClientConfig) {
    this.config = config
  }

  async list(): Promise<{ models: LLMModel[] }> {
    const apiKey = resolve(this.config.apiKey)
    if (!apiKey) return { models: [] }

    const endpoint = this.config.endpoint ?? DEFAULT_ENDPOINT
    const extra = this.config.extraHeaders
      ? resolve(this.config.extraHeaders)
      : {}

    const response = await fetch(`${endpoint}/v1/models`, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta":
          "prompt-caching-2024-07-31,extended-cache-ttl-2025-04-11",
        ...extra,
      },
    })

    if (!response.ok) {
      console.error(
        "[anthropic] Failed to fetch models:",
        response.status,
      )
      return { models: [] }
    }

    const data: any = await response.json()

    const models: LLMModel[] = (data.data ?? []).map((m: any) => ({
      name: m.id,
      context_length: m.max_input_tokens || 200000,
      description: m.display_name || m.id,
      pricing: lookupPricing(m.id),
    }))

    return { models }
  }

  async *generate(
    options: LLMGenerateOptions,
  ): AsyncGenerator<LLMStreamEvent> {
    const apiKey = resolve(this.config.apiKey)
    if (!apiKey) throw new Error("Anthropic API key not configured")

    const endpoint = this.config.endpoint ?? DEFAULT_ENDPOINT
    const extra = this.config.extraHeaders
      ? resolve(this.config.extraHeaders)
      : {}

    const formatted = formatMessages(options.messages)
    const systemMessage = formatted.find((m) => m.role === "system")
    const nonSystemMessages = formatted.filter((m) => m.role !== "system")

    const requestBody: Record<string, unknown> = {
      model: options.model,
      messages: nonSystemMessages,
      system: systemMessage?.content,
      max_tokens: options.max_tokens || 4096,
      temperature: options.temperature ?? 1,
      stream: true,
    }

    if (options.thinking_budget && options.thinking_budget > 0) {
      requestBody.thinking = {
        type: "enabled",
        budget_tokens: options.thinking_budget,
      }
    }

    const response = await fetch(`${endpoint}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta":
          "prompt-caching-2024-07-31,extended-cache-ttl-2025-04-11",
        ...extra,
      },
      body: JSON.stringify(requestBody),
      signal: options.signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      yield {
        type: "error",
        error: `Anthropic API error: ${response.status} ${errorText}`,
      }
      yield { type: "done" }
      return
    }

    if (!response.body) {
      yield { type: "error", error: "No response body from Anthropic" }
      yield { type: "done" }
      return
    }

    for await (const raw of parseSSEStream(response.body)) {
      for (const event of parseStreamEvent(raw)) {
        yield event
      }
    }

    // Guarantee a done event even if the stream didn't emit message_stop
    // (The caller's for-await will see it and break out.)
  }
}

// ---- Message formatting ----

function formatMessages(
  messages: LLMGenerateOptions["messages"],
): AnthropicFormattedMessage[] {
  return messages.map((msg) => {
    const contentBlock: AnthropicContentBlock = {
      type: "text",
      text: msg.content,
    }

    if (msg.cache_control) {
      const cc: { type: "ephemeral"; ttl?: "5m" | "1h" } = {
        type: "ephemeral",
      }
      if (typeof msg.cache_control.ttl === "number") {
        cc.ttl = msg.cache_control.ttl >= 3600 ? "1h" : "5m"
      } else if (
        msg.cache_control.ttl === "5m" ||
        msg.cache_control.ttl === "1h"
      ) {
        cc.ttl = msg.cache_control.ttl
      }
      contentBlock.cache_control = cc
    }

    return {
      role: msg.role,
      content: [contentBlock],
    }
  })
}
