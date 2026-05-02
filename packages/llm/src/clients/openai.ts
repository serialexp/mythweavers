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
} from "../types"
import { resolve } from "../types"
import { OpenAICompatibleClient } from "./openai-compatible"

const DEFAULT_ENDPOINT = "https://api.openai.com/v1"

/**
 * Curated list of OpenAI image models with their default capabilities.
 * Returned from `listImageModels()` because OpenAI's `/v1/models` endpoint
 * doesn't usefully distinguish image models from text models.
 */
const OPENAI_IMAGE_MODELS: ImageModelInfo[] = [
  {
    name: "gpt-image-1",
    displayName: "GPT Image 1",
    description: "OpenAI's flagship image model. High quality, slower.",
    maxWidth: 1792,
    maxHeight: 1792,
  },
  {
    name: "dall-e-3",
    displayName: "DALL·E 3",
    description: "Older but still strong; cheaper than gpt-image-1.",
    maxWidth: 1792,
    maxHeight: 1024,
  },
]

/**
 * Map a requested (width, height) to the closest OpenAI-supported size string.
 * gpt-image-1 supports 1024x1024, 1024x1536 (portrait), 1536x1024 (landscape), and "auto".
 * dall-e-3 supports 1024x1024, 1024x1792 (portrait), 1792x1024 (landscape).
 *
 * We snap to the nearest aspect; falling back to 1024x1024.
 */
function pickOpenAISize(
  model: string,
  width?: number,
  height?: number,
): string {
  if (!width || !height) return "1024x1024"
  const aspect = width / height

  if (model === "gpt-image-1") {
    if (aspect > 1.2) return "1536x1024"
    if (aspect < 0.85) return "1024x1536"
    return "1024x1024"
  }
  // dall-e-3 / dall-e-2 fallback
  if (aspect > 1.2) return "1792x1024"
  if (aspect < 0.85) return "1024x1792"
  return "1024x1024"
}

/**
 * OpenAI client. Implements both `LLMClient` (chat completions, delegated to
 * the openai-compatible client) and `ImageClient` (`/v1/images/generations`).
 *
 * Use this when you specifically want OpenAI; for OpenRouter, Moonshot, etc.
 * use `OpenAICompatibleClient` directly with a custom endpoint.
 */
export class OpenAIClient implements LLMClient, ImageClient {
  private config: LLMClientConfig
  private chatClient: OpenAICompatibleClient

  constructor(config: LLMClientConfig) {
    this.config = config
    this.chatClient = new OpenAICompatibleClient({
      apiKey: config.apiKey,
      endpoint: config.endpoint,
      extraHeaders: config.extraHeaders,
    })
  }

  private getBaseUrl(): string {
    return (this.config.endpoint ?? DEFAULT_ENDPOINT).replace(/\/+$/, "")
  }

  // ---- LLMClient (delegated) ----

  async list(): Promise<{ models: LLMModel[] }> {
    return this.chatClient.list()
  }

  async *generate(
    options: LLMGenerateOptions,
  ): AsyncGenerator<LLMStreamEvent> {
    yield* this.chatClient.generate(options)
  }

  // ---- ImageClient ----

  async listImageModels(): Promise<{ models: ImageModelInfo[] }> {
    return { models: OPENAI_IMAGE_MODELS }
  }

  async generateImage(
    options: ImageGenerateOptions,
  ): Promise<ImageGenerateResult> {
    const apiKey = resolve(this.config.apiKey)
    if (!apiKey) throw new Error("OpenAI API key not configured")

    const extra = this.config.extraHeaders
      ? resolve(this.config.extraHeaders)
      : {}

    const size = pickOpenAISize(options.model, options.width, options.height)
    const body: Record<string, unknown> = {
      model: options.model,
      prompt: options.prompt,
      n: 1,
      size,
    }
    // gpt-image-1 returns base64 by default; dall-e-3 needs explicit response_format.
    if (options.model.startsWith("dall-e")) {
      body.response_format = "b64_json"
    }
    if (options.providerOptions) Object.assign(body, options.providerOptions)

    const response = await fetch(`${this.getBaseUrl()}/images/generations`, {
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
        `OpenAI image gen failed (${response.status}): ${text.slice(0, 500)}`,
      )
    }

    const data = (await response.json()) as any
    const item = data?.data?.[0]
    if (!item || typeof item.b64_json !== "string") {
      throw new Error("OpenAI image gen response missing data[0].b64_json")
    }

    const buf = base64ToBytes(item.b64_json)
    const [w, h] = size.split("x").map((n) => Number.parseInt(n, 10))
    return {
      buffer: buf,
      mimeType: "image/png",
      width: w,
      height: h,
    }
  }
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/^data:[^;]+;base64,/, "")
  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}
