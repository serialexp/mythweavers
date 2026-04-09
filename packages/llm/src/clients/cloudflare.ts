import type {
  LLMClient,
  LLMClientConfig,
  LLMGenerateOptions,
  LLMModel,
  LLMStreamEvent,
  ModelPricing,
} from "../types"
import { resolve } from "../types"
import { OpenAICompatibleClient } from "./openai-compatible"

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
 * Generation is delegated to an OpenAI-compatible client using Cloudflare's
 * `/v1/chat/completions` endpoint, which all current models support.
 *
 * Model listing uses the Cloudflare-specific `/models/search` API.
 */
export class CloudflareClient implements LLMClient {
  private config: LLMClientConfig
  private openaiClient: OpenAICompatibleClient

  constructor(config: LLMClientConfig) {
    if (!config.endpoint) {
      throw new Error(
        "CloudflareClient requires an endpoint URL including the account ID, e.g. " +
          "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/ai",
      )
    }
    this.config = config

    // Cloudflare exposes an OpenAI-compatible endpoint at {base}/v1
    // The OpenAICompatibleClient will append /v1/chat/completions itself,
    // so we pass {base} as the endpoint.
    this.openaiClient = new OpenAICompatibleClient({
      apiKey: config.apiKey,
      endpoint: this.getBaseUrl(),
      extraHeaders: config.extraHeaders,
      unfiltered: true,
    })
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
    yield* this.openaiClient.generate(options)
  }
}
