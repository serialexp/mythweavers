import type {
  ImageClient,
  ImageGenerateOptions,
  ImageGenerateResult,
  ImageModelInfo,
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
export class CloudflareClient implements LLMClient, ImageClient {
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
    this.openaiClient = new OpenAICompatibleClient({
      apiKey: config.apiKey,
      endpoint: `${this.getBaseUrl()}/v1`,
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

  // ---- ImageClient implementation ----

  async listImageModels(): Promise<{ models: ImageModelInfo[] }> {
    const apiKey = resolve(this.config.apiKey)
    if (!apiKey) return { models: [] }

    const extra = this.config.extraHeaders
      ? resolve(this.config.extraHeaders)
      : {}

    const response = await fetch(
      `${this.getBaseUrl()}/models/search?task=Text-to-Image`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}`, ...extra },
      },
    )

    if (!response.ok) {
      console.error(
        "[cloudflare] Failed to fetch image models:",
        response.status,
      )
      return { models: [] }
    }

    const data: any = await response.json()
    if (!data.success || !Array.isArray(data.result)) return { models: [] }

    const models: ImageModelInfo[] = data.result
      .filter((m: any) => !isDeprecated(m.properties ?? []))
      .map((m: any) => ({
        name: m.name,
        displayName: m.name,
        description: m.description || m.name,
      }))

    return { models }
  }

  /**
   * Run a Cloudflare Workers AI image model. Endpoint shape is
   * `POST {base}/run/<model>` where `model` is e.g. `@cf/black-forest-labs/flux-1-schnell`.
   *
   * Cloudflare returns *either* a JSON envelope `{ result: { image: <base64> }, success }`
   * for older Flux 1 models, *or* raw binary bytes (Content-Type: image/png|jpeg|webp)
   * for newer Flux 2 / Klein models. We handle both shapes.
   */
  async generateImage(
    options: ImageGenerateOptions,
  ): Promise<ImageGenerateResult> {
    const apiKey = resolve(this.config.apiKey)
    if (!apiKey) throw new Error("Cloudflare API key not configured")

    const extra = this.config.extraHeaders
      ? resolve(this.config.extraHeaders)
      : {}

    const body: Record<string, unknown> = { prompt: options.prompt }
    if (options.steps != null) body.num_steps = options.steps
    if (options.width != null) body.width = options.width
    if (options.height != null) body.height = options.height
    if (options.negativePrompt) body.negative_prompt = options.negativePrompt
    if (options.seed != null) body.seed = options.seed
    if (options.providerOptions) Object.assign(body, options.providerOptions)

    const url = `${this.getBaseUrl()}/run/${options.model}`
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...extra,
      },
      body: JSON.stringify(body),
      signal: options.signal,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw new Error(
        `Cloudflare image gen failed (${response.status}): ${text.slice(0, 500)}`,
      )
    }

    const contentType = response.headers.get("content-type") || ""

    // Newer models stream raw binary back.
    if (contentType.startsWith("image/")) {
      const buf = new Uint8Array(await response.arrayBuffer())
      return {
        buffer: buf,
        mimeType: contentType.split(";")[0]!.trim(),
        width: options.width,
        height: options.height,
      }
    }

    // Older models return JSON envelope with base64 image.
    const data = (await response.json()) as any
    if (!data.success) {
      const errs = Array.isArray(data.errors)
        ? data.errors.map((e: any) => e.message).join("; ")
        : "Unknown error"
      throw new Error(`Cloudflare image gen failed: ${errs}`)
    }
    const b64 = data.result?.image
    if (typeof b64 !== "string") {
      throw new Error(
        "Cloudflare image gen response missing result.image (base64)",
      )
    }
    const buf = base64ToBytes(b64)
    return {
      buffer: buf,
      mimeType: "image/png", // Flux 1 Schnell returns PNG by default
      width: options.width,
      height: options.height,
    }
  }
}

/** Decode a base64 string to a Uint8Array. atob is available in Node ≥16 and all browsers. */
function base64ToBytes(b64: string): Uint8Array {
  // Strip optional data: URI prefix.
  const clean = b64.replace(/^data:[^;]+;base64,/, "")
  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}
