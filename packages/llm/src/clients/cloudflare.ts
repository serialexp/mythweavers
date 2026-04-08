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

/**
 * Cloudflare Workers AI SSE format:
 *   data: {"response":"token","p":"..."}
 *   data: {"response":"","usage":{"prompt_tokens":N,"completion_tokens":N,"total_tokens":N,...}}
 *   data: [DONE]
 */
function parseStreamChunk(parsed: any): LLMStreamEvent[] {
  const events: LLMStreamEvent[] = []

  if (parsed.usage) {
    events.push({
      type: "usage",
      usage: {
        prompt_tokens: parsed.usage.prompt_tokens,
        completion_tokens: parsed.usage.completion_tokens,
        total_tokens: parsed.usage.total_tokens,
      },
    })
  }

  if (parsed.response) {
    events.push({ type: "chunk", text: parsed.response })
  }

  return events
}

// ---- Model list helpers ----

function extractModelPricing(
  properties: Array<{ property_id: string; value: any }>,
): ModelPricing | undefined {
  const priceEntry = properties.find((p) => p.property_id === "price")
  if (!priceEntry || !Array.isArray(priceEntry.value)) return undefined

  const input = priceEntry.value.find((p: any) =>
    p.unit?.includes("input"),
  )
  const output = priceEntry.value.find((p: any) =>
    p.unit?.includes("output"),
  )

  if (!input && !output) return undefined
  return { input: input?.price ?? 0, output: output?.price ?? 0 }
}

function extractContextWindow(
  properties: Array<{ property_id: string; value: any }>,
): number | undefined {
  const entry = properties.find((p) => p.property_id === "context_window")
  if (!entry) return undefined
  const n = Number.parseInt(String(entry.value), 10)
  return Number.isNaN(n) ? undefined : n
}

function isDeprecated(
  properties: Array<{ property_id: string; value: any }>,
): boolean {
  const entry = properties.find(
    (p) => p.property_id === "planned_deprecation_date",
  )
  if (!entry) return false
  return new Date(entry.value).getTime() < Date.now()
}

/**
 * Cloudflare Workers AI client.
 *
 * Uses the standard LLMClientConfig interface:
 * - `apiKey`   — Cloudflare API token (Bearer)
 * - `endpoint` — full base URL including the account ID, e.g.
 *   `https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/ai`
 *
 * Generate URL:  `{endpoint}/run/{model}`
 * Models URL:    `{endpoint}/models/search?task=Text+Generation`
 */
export class CloudflareClient implements LLMClient {
  private config: LLMClientConfig

  constructor(config: LLMClientConfig) {
    if (!config.endpoint) {
      throw new Error(
        "CloudflareClient requires an endpoint URL including the account ID, e.g. " +
          "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/ai",
      )
    }
    this.config = config
  }

  private getBaseUrl(): string {
    return (this.config.endpoint ?? "").replace(/\/+$/, "")
  }

  async list(): Promise<{ models: LLMModel[] }> {
    const apiKey = resolve(this.config.apiKey)
    if (!apiKey) return { models: [] }

    const extra = this.config.extraHeaders
      ? resolve(this.config.extraHeaders)
      : {}

    const response = await fetch(
      `${this.getBaseUrl()}/models/search?task=Text+Generation`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}`, ...extra },
      },
    )

    if (!response.ok) {
      console.error("[cloudflare] Failed to fetch models:", response.status)
      return { models: [] }
    }

    const data: any = await response.json()
    if (!data.success || !Array.isArray(data.result)) return { models: [] }

    const models: LLMModel[] = data.result
      .filter((m: any) => !isDeprecated(m.properties ?? []))
      .map((m: any) => ({
        name: m.name,
        description: m.description || m.name,
        context_length: extractContextWindow(m.properties ?? []),
        pricing: extractModelPricing(m.properties ?? []),
      }))

    return { models }
  }

  async *generate(
    options: LLMGenerateOptions,
  ): AsyncGenerator<LLMStreamEvent> {
    const apiKey = resolve(this.config.apiKey)
    if (!apiKey) throw new Error("Cloudflare API key not configured")

    const extra = this.config.extraHeaders
      ? resolve(this.config.extraHeaders)
      : {}

    const requestBody: Record<string, unknown> = {
      messages: options.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      stream: true,
    }

    if (options.max_tokens) requestBody.max_tokens = options.max_tokens
    if (options.temperature !== undefined)
      requestBody.temperature = options.temperature

    const response = await fetch(
      `${this.getBaseUrl()}/run/${options.model}`,
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
        error: `Cloudflare AI error: ${response.status} ${errorText}`,
      }
      yield { type: "done" }
      return
    }

    if (!response.body) {
      yield { type: "error", error: "No response body from Cloudflare" }
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

    if (!sawDone) {
      yield { type: "done" }
    }
  }
}
